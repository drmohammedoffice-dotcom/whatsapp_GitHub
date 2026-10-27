import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { TeamRole } from '@watsapp/database';
import { PrismaService } from '../prisma/prisma.service';
import { PasswordService } from '../security/password.service';
import { TokenHashService } from '../security/token-hash.service';
import { TikTokLifecycleEventsService } from '../tiktok-integration/tiktok-lifecycle-events.service';
import { AuthEmailService } from './auth-email.service';
import { EmailVerificationService, SignupMetadata } from './email-verification.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { FreeTrialService } from '../billing/free-trial.service';
import { OfficialWhatsAppOtpService } from '../official-whatsapp/official-whatsapp.otp.service';
import { normalizeWaDigits } from '../official-whatsapp/official-whatsapp.util';

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
    private readonly authEmail: AuthEmailService,
    private readonly moduleRef: ModuleRef,
    private readonly whatsappOtp: OfficialWhatsAppOtpService,
  ) {}

  private otpEnabled() {
    return this.config.get<boolean>('AUTH_OTP_ENABLED', true);
  }

  private async resolveTeamId(userId: string): Promise<string> {
    const members = await this.prisma.teamMember.findMany({
      where: { userId },
      include: { team: { include: { subscriptions: true } } },
      orderBy: { createdAt: 'asc' },
    });
    if (!members[0]) throw new UnauthorizedException('User is not assigned to a team');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const active = members.find((member) => {
      const sub = member.team.subscriptions[0];
      if (!sub) return false;
      if (sub.status !== 'ACTIVE' && sub.status !== 'TRIAL') return false;
      const end = sub.currentPeriodEnd ?? sub.trialEndsAt;
      if (sub.status === 'TRIAL') return !!end && new Date(end).getTime() > Date.now();
      if (!end) return sub.status === 'ACTIVE';
      const endDay = new Date(end);
      endDay.setHours(0, 0, 0, 0);
      return endDay.getTime() >= today.getTime();
    });
    return active?.teamId ?? members[0].teamId;
  }

  async register(dto: RegisterDto, ipAddress?: string, userAgent?: string) {
    const email = dto.email.toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing?.emailVerifiedAt) throw new ConflictException('Email is already registered');

    const passwordHash = await this.passwords.hash(dto.password);
    const phone = normalizeWaDigits(dto.phone);

    if (phone) {
      const phoneTaken = await this.prisma.user.findFirst({ where: { phone } });
      if (phoneTaken && phoneTaken.email !== email) throw new ConflictException('Phone is already registered');
    }

    if (!this.otpEnabled()) {
      if (existing) throw new ConflictException('Email is already registered');
      return this.createUserAccount(
        email,
        dto.name,
        passwordHash,
        dto.teamName,
        ipAddress,
        userAgent,
        dto.referralCode,
        dto.referralSource,
        phone || undefined,
        false,
      );
    }

    const signupMeta = {
      name: dto.name,
      passwordHash,
      teamName: dto.teamName,
      referralCode: dto.referralCode,
      referralSource: dto.referralSource,
      phone,
    };

    if (phone && (await this.whatsappOtp.isSignupEnabled())) {
      try {
        return await this.whatsappOtp.createChallenge({
          phone,
          email,
          purpose: 'signup',
          userId: existing?.id,
          metadata: signupMeta,
        });
      } catch (error) {
        this.logger.warn(
          `[auth] WhatsApp OTP unavailable, falling back to email: ${error instanceof Error ? error.message : 'unknown'}`,
        );
      }
    }

    return this.otp.createSignupChallenge(email, signupMeta, existing?.id);
  }

  async verifyRegistration(verificationId: string, code: string, ipAddress?: string, userAgent?: string) {
    const wa = await this.prisma.phoneOtpVerification.findUnique({ where: { id: verificationId } });
    if (wa) {
      const verified = await this.whatsappOtp.verify(verificationId, code);
      const metadata = (verified.metadata ?? {}) as SignupMetadata & { phone?: string };
      const phone = verified.phone || metadata.phone;
      if (verified.userId) {
        const user = await this.prisma.user.update({
          where: { id: verified.userId },
          data: {
            emailVerifiedAt: new Date(),
            passwordHash: metadata.passwordHash,
            name: metadata.name,
            phone,
            phoneVerifiedAt: new Date(),
          },
          include: { teamMembers: { orderBy: { createdAt: 'asc' } } },
        });
        const teamId = await this.resolveTeamId(user.id);
        await this.audit(teamId, user.id, 'auth.verify_whatsapp', 'user', user.id, ipAddress, userAgent);
        return this.publicTokens(await this.issueTokens(user.id, teamId, ipAddress, userAgent));
      }
      return this.createUserAccount(
        verified.email || '',
        metadata.name,
        metadata.passwordHash,
        metadata.teamName,
        ipAddress,
        userAgent,
        metadata.referralCode,
        metadata.referralSource,
        phone,
        true,
      );
    }

    const verified = await this.otp.verifySignup(verificationId, code);
    const { email, metadata, existingUserId } = verified;

    if (existingUserId) {
      const user = await this.prisma.user.update({
        where: { id: existingUserId },
        data: { emailVerifiedAt: new Date(), passwordHash: metadata.passwordHash, name: metadata.name },
        include: { teamMembers: { orderBy: { createdAt: 'asc' } } },
      });
      const teamId = await this.resolveTeamId(user.id);
      await this.audit(teamId, user.id, 'auth.verify_email', 'user', user.id, ipAddress, userAgent);
      return this.publicTokens(await this.issueTokens(user.id, teamId, ipAddress, userAgent));
    }

    return this.createUserAccount(
      email,
      metadata.name,
      metadata.passwordHash,
      metadata.teamName,
      ipAddress,
      userAgent,
      metadata.referralCode,
      metadata.referralSource,
      (metadata as SignupMetadata & { phone?: string }).phone,
      false,
    );
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

    const teamId = await this.resolveTeamId(user.id);

    if (this.otpEnabled() && !user.emailVerifiedAt) {
      const passwordHash = user.passwordHash;
      const teamName = user.teamMembers[0]?.team?.name ?? `${user.name}'s workspace`;
      const challenge = await this.otp.createSignupChallenge(
        email,
        { name: user.name, passwordHash, teamName },
        user.id,
      );
      return { ...challenge, reason: 'email_not_verified' as const };
    }

    if (user.phone && (await this.whatsappOtp.isLoginEnabled())) {
      try {
        return await this.whatsappOtp.createChallenge({
          phone: user.phone,
          email,
          purpose: 'login',
          userId: user.id,
        });
      } catch (error) {
        this.logger.warn(
          `[auth] WhatsApp login OTP failed, continuing password login: ${error instanceof Error ? error.message : 'unknown'}`,
        );
      }
    }

    await this.audit(teamId, user.id, 'auth.login', 'user', user.id, ipAddress, userAgent);
    return this.publicTokens(await this.issueTokens(user.id, teamId, ipAddress, userAgent));
  }

  async getAccount(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true,
        adminProfile: { select: { isActive: true } },
      },
    });
    if (!user) throw new NotFoundException('User not found');
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      createdAt: user.createdAt,
      isPlatformAdmin: Boolean(user.adminProfile?.isActive),
    };
  }

  async updateAccount(userId: string, name: string) {
    const trimmed = name.trim();
    if (trimmed.length < 2) throw new BadRequestException('Name is too short');
    return this.prisma.user.update({
      where: { id: userId },
      data: { name: trimmed },
      select: { id: true, name: true, email: true, createdAt: true },
    });
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    if (!newPassword || newPassword.length < 8) {
      throw new BadRequestException('New password must be at least 8 characters');
    }
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    if (!(await this.passwords.verify(currentPassword, user.passwordHash))) {
      throw new UnauthorizedException('Current password is incorrect');
    }
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: await this.passwords.hash(newPassword) },
    });
    return { updated: true };
  }

  async verifyLogin(verificationId: string, code: string, ipAddress?: string, userAgent?: string) {
    const wa = await this.prisma.phoneOtpVerification.findUnique({ where: { id: verificationId } });
    const userId = wa
      ? (await this.whatsappOtp.verify(verificationId, code)).userId
      : (await this.otp.verifyLogin(verificationId, code)).userId;
    if (!userId) throw new UnauthorizedException('Invalid verification session');
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { teamMembers: { orderBy: { createdAt: 'asc' } } },
    });
    if (!user) throw new UnauthorizedException('Invalid verification session');

    const teamId = await this.resolveTeamId(user.id);
    await this.audit(teamId, user.id, 'auth.login', 'user', user.id, ipAddress, userAgent);
    return this.publicTokens(await this.issueTokens(user.id, teamId, ipAddress, userAgent));
  }

  async resendOtp(verificationId: string) {
    const wa = await this.prisma.phoneOtpVerification.findUnique({ where: { id: verificationId } });
    if (wa) return this.whatsappOtp.resend(verificationId);
    return this.otp.resend(verificationId);
  }

  async fallbackOtpToEmail(verificationId: string) {
    const wa = await this.prisma.phoneOtpVerification.findUnique({ where: { id: verificationId } });
    if (!wa?.email) throw new BadRequestException('Email fallback is not available for this session');
    const metadata = (wa.metadata ?? {}) as SignupMetadata;
    if (wa.purpose === 'password_reset' && wa.userId) {
      return this.issueEmailPasswordReset(wa.email);
    }
    if (wa.purpose === 'login' && wa.userId) {
      return this.otp.createLoginChallenge(wa.userId, wa.email, metadata.name || 'user');
    }
    return this.otp.createSignupChallenge(wa.email, metadata, wa.userId ?? undefined);
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
    if (!user) throw new UnauthorizedException('Invalid refresh token');
    const teamId = await this.resolveTeamId(user.id);

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
    if (user.phone && (await this.whatsappOtp.isPasswordResetEnabled())) {
      try {
        return await this.whatsappOtp.createChallenge({
          phone: user.phone,
          email: user.email,
          purpose: 'password_reset',
          userId: user.id,
          metadata: { name: user.name },
        });
      } catch (error) {
        this.logger.warn(
          `[auth] WhatsApp password-reset OTP failed, falling back to email token: ${error instanceof Error ? error.message : 'unknown'}`,
        );
      }
    }
    return this.issueEmailPasswordReset(user.email);
  }

  async verifyPasswordResetOtp(verificationId: string, code: string) {
    const verified = await this.whatsappOtp.verify(verificationId, code);
    if (verified.purpose !== 'password_reset' || !verified.userId) {
      throw new UnauthorizedException('Invalid verification session');
    }
    const token = this.tokenHash.createOpaqueToken();
    await this.prisma.passwordResetToken.create({
      data: {
        userId: verified.userId,
        tokenHash: this.tokenHash.hash(token),
        expiresAt: new Date(Date.now() + 30 * 60_000),
      },
    });
    return { accepted: true, resetToken: token };
  }

  private async issueEmailPasswordReset(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!user) return { accepted: true, channel: 'email' as const };

    const token = this.tokenHash.createOpaqueToken();
    const created = await this.prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: this.tokenHash.hash(token),
        expiresAt: new Date(Date.now() + 30 * 60_000),
      },
    });

    const webUrl = (
      this.config.get<string>('WEB_PUBLIC_URL') ||
      this.config.get<string>('PUBLIC_APP_URL') ||
      'https://www.chatloora.com'
    ).replace(/\/$/, '');
    const resetUrl = `${webUrl}/reset-password?token=${encodeURIComponent(token)}`;

    try {
      await this.authEmail.sendPasswordResetEmail({
        to: user.email,
        name: user.name,
        resetUrl,
      });
    } catch (error) {
      await this.prisma.passwordResetToken.delete({ where: { id: created.id } }).catch(() => undefined);
      throw error;
    }

    // Keep only the latest unused link after the email is sent successfully.
    await this.prisma.passwordResetToken.updateMany({
      where: {
        userId: user.id,
        usedAt: null,
        expiresAt: { gt: new Date() },
        id: { not: created.id },
      },
      data: { usedAt: new Date() },
    });
    this.logger.log(`[auth] Password reset email queued for userId=${user.id}`);

    return { accepted: true, channel: 'email' as const };
  }

  async confirmPasswordReset(token: string, password: string) {
    const stored = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash: this.tokenHash.hash(token) },
    });
    if (!stored || stored.usedAt || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid or expired reset token');
    }
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: stored.userId },
        data: { passwordHash: await this.passwords.hash(password) },
      }),
      this.prisma.passwordResetToken.update({
        where: { id: stored.id },
        data: { usedAt: new Date() },
      }),
      this.prisma.refreshToken.updateMany({
        where: { userId: stored.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
    return { accepted: true };
  }

  private async createUserAccount(
    email: string,
    name: string,
    passwordHash: string,
    teamName: string,
    ipAddress?: string,
    userAgent?: string,
    referralCode?: string,
    referralSource?: 'CODE' | 'LINK',
    phone?: string,
    phoneVerified = false,
  ) {
    const slug = await this.createUniqueSlug(teamName);
    const user = await this.prisma.user.create({
      data: {
        email,
        name,
        passwordHash,
        phone: phone || null,
        phoneVerifiedAt: phone && phoneVerified ? new Date() : null,
        emailVerifiedAt: new Date(),
        teamMembers: {
          create: { role: TeamRole.OWNER, team: { create: { name: teamName, slug } } },
        },
      },
      include: { teamMembers: { include: { team: true } } },
    });

    const teamId = user.teamMembers[0].teamId;
    await this.audit(teamId, user.id, 'auth.register', 'user', user.id, ipAddress, userAgent);
    this.emitCompleteRegistration(teamId, user.id, email);
    try {
      const trials = this.moduleRef.get(FreeTrialService, { strict: false });
      await trials.grant({ teamId, userId: user.id, email, name });
    } catch (err) {
      this.logger.warn(`Free trial grant failed: ${err instanceof Error ? err.message : String(err)}`);
    }
    return this.publicTokens(await this.issueTokens(user.id, teamId, ipAddress, userAgent));
  }

  private emitCompleteRegistration(teamId: string, userId: string, email: string) {
    try {
      const lifecycle = this.moduleRef.get(TikTokLifecycleEventsService, { strict: false });
      void lifecycle
        .sendCompleteRegistration({ teamId, userId, email })
        .catch((err) =>
          this.logger.warn(
            `CompleteRegistration event failed: ${err instanceof Error ? err.message : String(err)}`,
          ),
        );
    } catch (err) {
      this.logger.debug(
        `CompleteRegistration skipped (lifecycle unavailable): ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
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
