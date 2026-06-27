import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { TeamRole } from '@watsapp/database';
import { PrismaService } from '../prisma/prisma.service';
import { PasswordService } from '../security/password.service';
import { TokenHashService } from '../security/token-hash.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly tokenHash: TokenHashService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async register(dto: RegisterDto, ipAddress?: string, userAgent?: string) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email.toLowerCase() } });
    if (existing) throw new ConflictException('Email is already registered');

    const slug = await this.createUniqueSlug(dto.teamName);
    const passwordHash = await this.passwords.hash(dto.password);
    const user = await this.prisma.user.create({
      data: {
        email: dto.email.toLowerCase(),
        name: dto.name,
        passwordHash,
        teamMembers: {
          create: { role: TeamRole.OWNER, team: { create: { name: dto.teamName, slug } } },
        },
      },
      include: { teamMembers: { include: { team: true } } },
    });

    const teamId = user.teamMembers[0].teamId;
    await this.audit(teamId, user.id, 'auth.register', 'user', user.id, ipAddress, userAgent);
    return this.issueTokens(user.id, teamId, ipAddress, userAgent);
  }

  async login(dto: LoginDto, ipAddress?: string, userAgent?: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
      include: { teamMembers: { orderBy: { createdAt: 'asc' } } },
    });
    if (!user || !(await this.passwords.verify(dto.password, user.passwordHash))) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const teamId = user.teamMembers[0]?.teamId;
    if (!teamId) throw new UnauthorizedException('User is not assigned to a team');
    await this.audit(teamId, user.id, 'auth.login', 'user', user.id, ipAddress, userAgent);
    return this.issueTokens(user.id, teamId, ipAddress, userAgent);
  }

  async refresh(refreshToken: string, ipAddress?: string, userAgent?: string) {
    const tokenHash = this.tokenHash.hash(refreshToken);
    const stored = await this.prisma.refreshToken.findUnique({ where: { tokenHash } });
    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) throw new UnauthorizedException('Invalid refresh token');

    const user = await this.prisma.user.findUnique({ where: { id: stored.userId }, include: { teamMembers: true } });
    if (!user?.teamMembers[0]) throw new UnauthorizedException('Invalid refresh token');

    await this.prisma.refreshToken.update({ where: { id: stored.id }, data: { revokedAt: new Date() } });
    return this.issueTokens(user.id, user.teamMembers[0].teamId, ipAddress, userAgent);
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

  private async issueTokens(userId: string, teamId: string, ipAddress?: string, userAgent?: string) {
    const accessToken = await this.jwt.signAsync(
      { sub: userId, teamId },
      { secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'), expiresIn: this.config.get<string>('JWT_ACCESS_TTL', '15m') as any },
    );
    const refreshToken = this.tokenHash.createOpaqueToken();
    const refreshDays = this.config.get<number>('JWT_REFRESH_TTL_DAYS', 30);
    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: this.tokenHash.hash(refreshToken),
        ipAddress,
        userAgent,
        expiresAt: new Date(Date.now() + refreshDays * 24 * 60 * 60_000),
      },
    });
    return { accessToken, refreshToken, teamId };
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
