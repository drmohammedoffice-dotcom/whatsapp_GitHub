import {
  ConflictException,
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
  forwardRef,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { TeamRole } from '@watsapp/database';
import { PrismaService } from '../prisma/prisma.service';
import { PasswordService } from '../security/password.service';
import { TokenHashService } from '../security/token-hash.service';
import { TikTokLifecycleEventsService } from '../tiktok-integration/tiktok-lifecycle-events.service';
import { EmailVerificationService } from './email-verification.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly tokenHash: TokenHashService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly otp: EmailVerificationService,
    @Inject(forwardRef(() => TikTokLifecycleEventsService))
    private readonly tiktokLifecycle: TikTokLifecycleEventsService,
  ) {}

  private otpEnabled() {
    return this.config.get<boolean>('AUTH_OTP_ENABLED', true);
  }

  async register(dto: RegisterDto, ipAddress?: string, userAgent?: string) {
    const email = dto.email.toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing?.emailVerifiedAt) throw new ConflictException('Email is already registered');

    const passwordHash = await this.passwords.hash(dto.password);

    if (!this.otpEnabled()) {
      if (existing) throw new ConflictException('Email is already registered');
      return this.createUserAccount(email, dto.name, passwordHash, dto.teamName, ipAddress, userAgent);
    }

    return this.otp.createSignupChallenge(
      email,
      { name: dto.name, passwordHash, teamName: dto.teamName },
      existing?.id,
    );
  }

  async verifyRegistration(verificationId: string, code: string, ipAddress?: string, userAgent?: string) {
    const verified = await this.otp.verifySignup(verificationId, code);
    const { email, metadata, existingUserId } = verified;

    if (existingUserId) {
      const user = await this.prisma.user.update({
        where: { id: existingUserId },
        data: { emailVerifiedAt: new Date(), passwordHash: metadata.passwordHash, name: metadata.name },
        include: { teamMembers: { orderBy: { createdAt: 'asc' } } },
      });
      const teamId = user.teamMembers[0]?.teamId;
      if (!teamId) throw new UnauthorizedException('User is not assigned to a team');
      await this.audit(teamId, user.id, 'auth.verify_email', 'user', user.id, ipAddress, userAgent);
      return this.publicTokens(await this.issueTokens(user.id, teamId, ipAddress, userAgent));
    }

    return this.createUserAccount(email, metadata.name, metadata.passwordHash, metadata.teamName, ipAddress, userAgent);
  }

  async login(dto: LoginDto, ipAddress?: string, userAgent?: string) {
    const email = dto.email.toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { teamMembers: { orderBy: { createdAt: 'asc' }, include: { team: true } } },
    });
    if (!user || !(await this.passwords.verify(dto.password, user.passwordHash))) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const teamId = user.teamMembers[0]?.teamId;
    if (!teamId) throw new UnauthorizedException('User is not assigned to a team');

    if (!this.otpEnabled()) {
      await this.audit(teamId, user.id, 'auth.login', 'user', user.id, ipAddress, userAgent);
      return this.publicTokens(await this.issueTokens(user.id, teamId, ipAddress, userAgent));
    }

    if (!user.emailVerifiedAt) {
      const passwordHash = user.passwordHash;
      const teamName = user.teamMembers[0]?.team?.name ?? `${user.name}'s workspace`;
      const challenge = await this.otp.createSignupChallenge(
        email,
        { name: user.name, passwordHash, teamName },
        user.id,
      );
      return { ...challenge, reason: 'email_not_verified' as const };
    }

    return this.otp.createLoginChallenge(user.id, email, user.name);
  }

  async verifyLogin(verificationId: string, code: string, ipAddress?: string, userAgent?: string) {
    const verified = await this.otp.verifyLogin(verificationId, code);
    const user = await this.prisma.user.findUnique({
      where: { id: verified.userId },
      include: { teamMembers: { orderBy: { createdAt: 'asc' } } },
    });
    if (!user) throw new UnauthorizedException('Invalid verification session');

    const teamId = user.teamMembers[0]?.teamId;
    if (!teamId) throw new UnauthorizedException('User is not assigned to a team');
    await this.audit(teamId, user.id, 'auth.login', 'user', user.id, ipAddress, userAgent);
    return this.publicTokens(await this.issueTokens(user.id, teamId, ipAddress, userAgent));
  }

  resendOtp(verificationId: string) {
    return this.otp.resend(verificationId);
  }

  async refresh(refreshToken: string, ipAddress?: string, userAgent?: string) {
    const tokenHash = this.tokenHash.hash(refreshToken);
    const stored = await this.prisma.refreshToken.findUnique({ where: { tokenHash } });
    if (!stored || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: stored.userId },
      include: { teamMembers: true },
    });
    if (!user?.teamMembers[0]) throw new UnauthorizedException('Invalid refresh token');
    const teamId = user.teamMembers[0].teamId;

    // Concurrent tabs often rotate the same refresh token at once. Within a short
    // grace window, issue a fresh session instead of forcing logout.
    if (stored.revokedAt) {
      const graceMs = 60_000;
      if (Date.now() - stored.revokedAt.getTime() > graceMs) {
        throw new UnauthorizedException('Invalid refresh token');
      }
      return this.publicTokens(await this.issueTokens(user.id, teamId, ipAddress, userAgent));
    }

    const tokens = await this.issueTokens(user.id, teamId, ipAddress, userAgent);
    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: {
        revokedAt: new Date(),
        replacedById: tokens.refreshTokenId,
      },
    });
    return this.publicTokens(tokens);
  }

  async logout(refreshToken: string) {
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash: this.tokenHash.hash(refreshToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async requestPasswordReset(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!user) return { accepted: true };
    const token = this.tokenHash.createOpaqueToken();
    await this.prisma.passwordResetToken.create({
      data: { userId: user.id, tokenHash: this.tokenHash.hash(token), expiresAt: new Date(Date.now() + 30 * 60_000) },
    });
    return { accepted: true, resetToken: token };
  }

  async confirmPasswordReset(token: string, password: string) {
    const stored = await this.prisma.passwordResetToken.findUnique({ where: { tokenHash: this.tokenHash.hash(token) } });
    if (!stored || stored.usedAt || stored.expiresAt < new Date()) throw new UnauthorizedException('Invalid reset token');
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: stored.userId }, data: { passwordHash: await this.passwords.hash(password) } }),
      this.prisma.passwordResetToken.update({ where: { id: stored.id }, data: { usedAt: new Date() } }),
      this.prisma.refreshToken.updateMany({ where: { userId: stored.userId, revokedAt: null }, data: { revokedAt: new Date() } }),
    ]);
  }

  private async createUserAccount(
    email: string,
    name: string,
    passwordHash: string,
    teamName: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const slug = await this.createUniqueSlug(teamName);
    const user = await this.prisma.user.create({
      data: {
        email,
        name,
        passwordHash,
        emailVerifiedAt: new Date(),
        teamMembers: {
          create: { role: TeamRole.OWNER, team: { create: { name: teamName, slug } } },
        },
      },
      include: { teamMembers: { include: { team: true } } },
    });

    const teamId = user.teamMembers[0].teamId;
    await this.audit(teamId, user.id, 'auth.register', 'user', user.id, ipAddress, userAgent);
    void this.tiktokLifecycle
      .sendCompleteRegistration({ teamId, userId: user.id, email })
      .catch((err) =>
        this.logger.warn(
          `CompleteRegistration event failed: ${err instanceof Error ? err.message : String(err)}`,
        ),
      );
    return this.publicTokens(await this.issueTokens(user.id, teamId, ipAddress, userAgent));
  }

  private publicTokens(tokens: { accessToken: string; refreshToken: string; teamId: string }) {
    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      teamId: tokens.teamId,
    };
  }

  private async issueTokens(userId: string, teamId: string, ipAddress?: string, userAgent?: string) {
    const accessToken = await this.jwt.signAsync(
      { sub: userId, teamId },
      { secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'), expiresIn: this.config.get<string>('JWT_ACCESS_TTL', '2h') as any },
    );
    const refreshToken = this.tokenHash.createOpaqueToken();
    const refreshDays = this.config.get<number>('JWT_REFRESH_TTL_DAYS', 30);
    const created = await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: this.tokenHash.hash(refreshToken),
        ipAddress,
        userAgent,
        expiresAt: new Date(Date.now() + refreshDays * 24 * 60 * 60_000),
      },
    });
    return { accessToken, refreshToken, teamId, refreshTokenId: created.id };
  }

  private async createUniqueSlug(name: string) {
    const base = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'team';
    let slug = base;
    let counter = 1;
    while (await this.prisma.team.findUnique({ where: { slug } })) slug = `${base}-${counter++}`;
    return slug;
  }

  private audit(teamId: string, actorUserId: string, action: string, resource: string, resourceId: string, ipAddress?: string, userAgent?: string) {
    return this.prisma.auditLog.create({ data: { teamId, actorUserId, action, resource, resourceId, ipAddress, userAgent } });
  }
}
