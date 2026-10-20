import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@watsapp/database';
import { TokenHashService } from '../security/token-hash.service';
import { PrismaService } from '../prisma/prisma.service';
import { OfficialWhatsAppSenderService } from './official-whatsapp.sender.service';
import { maskPhone, normalizeWaDigits } from './official-whatsapp.util';

export type WhatsAppOtpChallenge = {
  requiresOtp: true;
  verificationId: string;
  channel: 'whatsapp';
  email: string;
  maskedEmail: string;
  maskedPhone: string;
  expiresAt: string;
  emailFallbackAvailable: true;
  reason?: string;
};

@Injectable()
export class OfficialWhatsAppOtpService {
  private readonly logger = new Logger(OfficialWhatsAppOtpService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenHashService,
    private readonly sender: OfficialWhatsAppSenderService,
    private readonly config: ConfigService,
  ) {}

  async getConfig() {
    const row = await this.prisma.officialWhatsAppOtpConfig.upsert({
      where: { id: 'otp' },
      create: { id: 'otp' },
      update: {},
    });
    const envTemplate = this.config.get<string>('CHATLOORA_WHATSAPP_OTP_TEMPLATE')?.trim();
    if (!row.templateName.trim() && envTemplate) {
      return this.prisma.officialWhatsAppOtpConfig.update({
        where: { id: 'otp' },
        data: { templateName: envTemplate },
      });
    }
    return row;
  }

  async saveConfig(input: Partial<{
    enabled: boolean;
    loginEnabled: boolean;
    passwordResetEnabled: boolean;
    templateName: string;
    language: string;
    expirySeconds: number;
    resendCooldownSeconds: number;
    maxAttempts: number;
  }>) {
    const current = await this.getConfig();
    return this.prisma.officialWhatsAppOtpConfig.update({
      where: { id: 'otp' },
      data: {
        enabled: input.enabled ?? current.enabled,
        loginEnabled: input.loginEnabled ?? current.loginEnabled,
        passwordResetEnabled: input.passwordResetEnabled ?? current.passwordResetEnabled,
        templateName: input.templateName?.trim() ?? current.templateName,
        language: input.language?.trim() || current.language,
        expirySeconds: input.expirySeconds ?? current.expirySeconds,
        resendCooldownSeconds: input.resendCooldownSeconds ?? current.resendCooldownSeconds,
        maxAttempts: input.maxAttempts ?? current.maxAttempts,
      },
    });
  }

  async isSignupEnabled() {
    const cfg = await this.getConfig();
    const sender = await this.sender.getPublicStatus();
    return Boolean(cfg.enabled && sender.enabled && sender.hasAccessToken && cfg.templateName.trim());
  }

  async isLoginEnabled() {
    const cfg = await this.getConfig();
    return (await this.isSignupEnabled()) && cfg.loginEnabled;
  }

  async isPasswordResetEnabled() {
    const cfg = await this.getConfig();
    return (await this.isSignupEnabled()) && cfg.passwordResetEnabled;
  }

  async createChallenge(input: {
    phone: string;
    email: string;
    purpose: 'signup' | 'login' | 'password_reset';
    userId?: string;
    metadata?: Record<string, unknown>;
  }): Promise<WhatsAppOtpChallenge> {
    const cfg = await this.getConfig();
    if (!cfg.enabled) throw new BadRequestException('WhatsApp OTP is disabled');
    if (input.purpose === 'login' && !cfg.loginEnabled) {
      throw new BadRequestException('WhatsApp login OTP is disabled');
    }
    if (input.purpose === 'password_reset' && !cfg.passwordResetEnabled) {
      throw new BadRequestException('WhatsApp password-reset OTP is disabled');
    }

    const phone = normalizeWaDigits(input.phone);
    if (phone.length < 8) throw new BadRequestException('A valid WhatsApp phone number is required');

    const recent = await this.prisma.phoneOtpVerification.findFirst({
      where: { phone, purpose: input.purpose, verifiedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    if (recent?.lastSentAt) {
      const waitMs = cfg.resendCooldownSeconds * 1000 - (Date.now() - recent.lastSentAt.getTime());
      if (waitMs > 0) {
        throw new HttpException(
          `Please wait ${Math.ceil(waitMs / 1000)} seconds before requesting another code`,
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    }

    const minuteAgo = new Date(Date.now() - 60_000);
    const burst = await this.prisma.phoneOtpVerification.count({
      where: { phone, createdAt: { gte: minuteAgo } },
    });
    if (burst >= 3) {
      throw new HttpException('Too many OTP requests. Please wait a minute.', HttpStatus.TOO_MANY_REQUESTS);
    }

    await this.prisma.phoneOtpVerification.updateMany({
      where: { phone, purpose: input.purpose, verifiedAt: null },
      data: { verifiedAt: new Date(0) },
    });

    const code = String(Math.floor(100_000 + Math.random() * 900_000));
    const record = await this.prisma.phoneOtpVerification.create({
      data: {
        userId: input.userId ?? null,
        phone,
        email: input.email.toLowerCase(),
        purpose: input.purpose,
        otpHash: this.tokens.hash(code),
        expiresAt: new Date(Date.now() + cfg.expirySeconds * 1000),
        maxAttempts: cfg.maxAttempts,
        metadata: (input.metadata ?? {}) as Prisma.InputJsonValue,
      },
    });

    try {
      await this.sender.sendAuthenticationTemplate({
        to: phone,
        templateName: cfg.templateName,
        language: cfg.language,
        code,
      });
    } catch (error) {
      this.logger.warn('[official-wa-otp] WhatsApp delivery failed; caller may use email fallback');
      throw error;
    }

    return {
      requiresOtp: true,
      verificationId: record.id,
      channel: 'whatsapp',
      email: input.email.toLowerCase(),
      maskedEmail: this.maskEmail(input.email),
      maskedPhone: maskPhone(phone),
      expiresAt: record.expiresAt.toISOString(),
      emailFallbackAvailable: true,
    };
  }

  async resend(verificationId: string) {
    const record = await this.prisma.phoneOtpVerification.findUnique({ where: { id: verificationId } });
    if (!record || record.verifiedAt) throw new BadRequestException('Verification session not found');
    const meta = (record.metadata && typeof record.metadata === 'object' ? record.metadata : {}) as Record<string, unknown>;
    return this.createChallenge({
      phone: record.phone,
      email: record.email ?? '',
      purpose: record.purpose as 'signup' | 'login' | 'password_reset',
      userId: record.userId ?? undefined,
      metadata: meta,
    });
  }

  async verify(verificationId: string, code: string) {
    const record = await this.prisma.phoneOtpVerification.findUnique({ where: { id: verificationId } });
    if (!record || record.verifiedAt) {
      throw new BadRequestException('Invalid or expired verification code');
    }
    if (record.expiresAt < new Date()) {
      throw new BadRequestException('Verification code has expired');
    }
    if (record.attempts >= record.maxAttempts) {
      throw new HttpException('Too many verification attempts', HttpStatus.TOO_MANY_REQUESTS);
    }

    const normalized = code.replace(/\D/g, '');
    const valid = normalized.length === 6 && this.tokens.hash(normalized) === record.otpHash;
    if (!valid) {
      const next = record.attempts + 1;
      await this.prisma.phoneOtpVerification.update({
        where: { id: record.id },
        data: { attempts: next },
      });
      if (next >= record.maxAttempts) {
        throw new HttpException('Too many verification attempts', HttpStatus.TOO_MANY_REQUESTS);
      }
      throw new BadRequestException('Invalid verification code');
    }

    await this.prisma.phoneOtpVerification.update({
      where: { id: record.id },
      data: { verifiedAt: new Date(), attempts: record.attempts + 1 },
    });

    if (record.userId) {
      await this.prisma.user.update({
        where: { id: record.userId },
        data: { phone: record.phone, phoneVerifiedAt: new Date() },
      });
    }

    return {
      id: record.id,
      userId: record.userId,
      phone: record.phone,
      email: record.email,
      purpose: record.purpose,
      metadata: record.metadata,
    };
  }

  private maskEmail(email: string) {
    const [local, domain] = email.toLowerCase().split('@');
    if (!local || !domain) return email;
    const visible = local.length <= 2 ? local[0] ?? '*' : `${local[0]}***${local[local.length - 1]}`;
    return `${visible}@${domain}`;
  }
}
