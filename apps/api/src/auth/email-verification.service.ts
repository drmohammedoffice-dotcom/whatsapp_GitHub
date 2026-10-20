import { BadRequestException, HttpException, HttpStatus, Injectable, UnauthorizedException } from '@nestjs/common';
import { EmailVerificationType } from '@watsapp/database';
import { PrismaService } from '../prisma/prisma.service';
import { TokenHashService } from '../security/token-hash.service';
import { AuthEmailService } from './auth-email.service';

const OTP_TTL_MS = 10 * 60_000;
const MAX_ATTEMPTS = 5;
const MAX_SENDS_PER_MINUTE = 3;

export type SignupMetadata = {
  name: string;
  passwordHash: string;
  teamName: string;
  referralCode?: string;
  referralSource?: 'CODE' | 'LINK';
};

export type OtpChallengeResponse = {
  requiresOtp: true;
  verificationId: string;
  email: string;
  maskedEmail: string;
  expiresAt: string;
  reason?: 'email_not_verified';
};

@Injectable()
export class EmailVerificationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokenHash: TokenHashService,
    private readonly email: AuthEmailService,
  ) {}

  async createSignupChallenge(email: string, metadata: SignupMetadata, userId?: string) {
    await this.assertSendRateLimit(email);
    await this.invalidatePending(email, EmailVerificationType.SIGNUP);

    const code = this.generateOtp();
    const record = await this.prisma.emailVerification.create({
      data: {
        userId: userId ?? null,
        email: email.toLowerCase(),
        codeHash: this.tokenHash.hash(code),
        type: EmailVerificationType.SIGNUP,
        expiresAt: new Date(Date.now() + OTP_TTL_MS),
        metadata,
      },
    });

    await this.email.sendOtpEmail({ to: email, code, type: 'signup', name: metadata.name });
    return this.toChallenge(record.id, email, record.expiresAt);
  }

  async createLoginChallenge(userId: string, email: string, name: string) {
    await this.assertSendRateLimit(email);
    await this.invalidatePending(email, EmailVerificationType.LOGIN);

    const code = this.generateOtp();
    const record = await this.prisma.emailVerification.create({
      data: {
        userId,
        email: email.toLowerCase(),
        codeHash: this.tokenHash.hash(code),
        type: EmailVerificationType.LOGIN,
        expiresAt: new Date(Date.now() + OTP_TTL_MS),
      },
    });

    await this.email.sendOtpEmail({ to: email, code, type: 'login', name });
    return this.toChallenge(record.id, email, record.expiresAt);
  }

  async resend(verificationId: string) {
    const record = await this.prisma.emailVerification.findUnique({ where: { id: verificationId } });
    if (!record || record.used) throw new BadRequestException('Verification session not found');

    await this.assertSendRateLimit(record.email);

    const code = this.generateOtp();
    const updated = await this.prisma.emailVerification.update({
      where: { id: verificationId },
      data: {
        codeHash: this.tokenHash.hash(code),
        expiresAt: new Date(Date.now() + OTP_TTL_MS),
        attempts: 0,
        used: false,
      },
    });

    const name =
      record.type === EmailVerificationType.SIGNUP && record.metadata && typeof record.metadata === 'object'
        ? String((record.metadata as SignupMetadata).name ?? '')
        : undefined;

    await this.email.sendOtpEmail({
      to: record.email,
      code,
      type: record.type === EmailVerificationType.SIGNUP ? 'signup' : 'login',
      name,
    });

    return this.toChallenge(updated.id, updated.email, updated.expiresAt, record.type === EmailVerificationType.SIGNUP && !record.userId ? 'email_not_verified' : undefined);
  }

  async verifySignup(verificationId: string, code: string) {
    const record = await this.assertValidRecord(verificationId, EmailVerificationType.SIGNUP);
    await this.assertCode(record, code);

    const metadata = record.metadata as SignupMetadata | null;
    if (!metadata?.name || !metadata.passwordHash || !metadata.teamName) {
      throw new BadRequestException('Invalid signup session');
    }

    await this.prisma.emailVerification.update({
      where: { id: record.id },
      data: { used: true, attempts: record.attempts + 1 },
    });

    return { email: record.email, metadata, existingUserId: record.userId };
  }

  async verifyLogin(verificationId: string, code: string) {
    const record = await this.assertValidRecord(verificationId, EmailVerificationType.LOGIN);
    await this.assertCode(record, code);

    await this.prisma.emailVerification.update({
      where: { id: record.id },
      data: { used: true, attempts: record.attempts + 1 },
    });

    if (!record.userId) throw new UnauthorizedException('Invalid verification session');
    return { userId: record.userId, email: record.email };
  }

  private async assertValidRecord(verificationId: string, type: EmailVerificationType) {
    const record = await this.prisma.emailVerification.findUnique({ where: { id: verificationId } });
    if (!record || record.used || record.type !== type) {
      throw new BadRequestException('Invalid or expired verification code');
    }
    if (record.expiresAt < new Date()) {
      throw new BadRequestException('Verification code has expired');
    }
    if (record.attempts >= MAX_ATTEMPTS) {
      throw new HttpException('Too many verification attempts', HttpStatus.TOO_MANY_REQUESTS);
    }
    return record;
  }

  private async assertCode(record: { id: string; codeHash: string; attempts: number }, code: string) {
    const normalized = code.replace(/\D/g, '');
    if (normalized.length !== 6) {
      await this.incrementAttempt(record.id, record.attempts);
      throw new BadRequestException('Invalid verification code');
    }

    const valid = this.tokenHash.hash(normalized) === record.codeHash;
    if (!valid) {
      await this.incrementAttempt(record.id, record.attempts);
      throw new BadRequestException('Invalid verification code');
    }
  }

  private async incrementAttempt(id: string, attempts: number) {
    const next = attempts + 1;
    await this.prisma.emailVerification.update({ where: { id }, data: { attempts: next } });
    if (next >= MAX_ATTEMPTS) {
      throw new HttpException('Too many verification attempts', HttpStatus.TOO_MANY_REQUESTS);
    }
  }

  private async assertSendRateLimit(email: string) {
    const since = new Date(Date.now() - 60_000);
    const count = await this.prisma.emailVerification.count({
      where: { email: email.toLowerCase(), createdAt: { gte: since } },
    });
    if (count >= MAX_SENDS_PER_MINUTE) {
      throw new HttpException('Too many verification emails sent. Please wait a minute.', HttpStatus.TOO_MANY_REQUESTS);
    }
  }

  private async invalidatePending(email: string, type: EmailVerificationType) {
    await this.prisma.emailVerification.updateMany({
      where: { email: email.toLowerCase(), type, used: false },
      data: { used: true },
    });
  }

  private generateOtp() {
    return String(Math.floor(100_000 + Math.random() * 900_000));
  }

  private toChallenge(verificationId: string, email: string, expiresAt: Date, reason?: 'email_not_verified'): OtpChallengeResponse {
    return {
      requiresOtp: true,
      verificationId,
      email,
      maskedEmail: this.maskEmail(email),
      expiresAt: expiresAt.toISOString(),
      ...(reason ? { reason } : {}),
    };
  }

  private maskEmail(email: string) {
    const [local, domain] = email.split('@');
    if (!local || !domain) return email;
    const visible = local.length <= 2 ? local[0] ?? '*' : `${local[0]}***${local[local.length - 1]}`;
    return `${visible}@${domain}`;
  }
}
