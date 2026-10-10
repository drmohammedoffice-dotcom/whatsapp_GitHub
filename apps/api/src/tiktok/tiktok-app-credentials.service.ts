import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EncryptionService } from '../security/encryption.service';
import { PrismaService } from '../prisma/prisma.service';

export type TikTokResolvedCredentials = {
  clientKey: string;
  clientSecret: string;
  redirectUri: string;
  source: 'team' | 'env';
};

export type TikTokAppCredentialsView = {
  configured: boolean;
  source: 'team' | 'env' | null;
  clientKey: string | null;
  clientKeyHint: string | null;
  redirectUri: string | null;
  hasClientSecret: boolean;
  envConfigured: boolean;
  teamConfigured: boolean;
};

@Injectable()
export class TikTokAppCredentialsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
    private readonly config: ConfigService,
  ) {}

  defaultRedirectUri(): string {
    return (
      this.config.get<string>('TIKTOK_REDIRECT_URI') ??
      `${this.config.getOrThrow<string>('API_PUBLIC_URL')}/api/auth/tiktok/callback`
    );
  }

  envCredentials(): TikTokResolvedCredentials | null {
    const clientKey = this.config.get<string>('TIKTOK_CLIENT_KEY', '')?.trim();
    const clientSecret = this.config.get<string>('TIKTOK_CLIENT_SECRET', '')?.trim();
    if (!clientKey || !clientSecret) return null;
    return {
      clientKey,
      clientSecret,
      redirectUri: this.defaultRedirectUri(),
      source: 'env',
    };
  }

  async resolve(teamId: string): Promise<TikTokResolvedCredentials | null> {
    try {
      const row = await this.prisma.tikTokAppCredentials.findUnique({ where: { teamId } });
      if (row) {
        return {
          clientKey: this.encryption.decryptJson<string>(row.encryptedClientKey),
          clientSecret: this.encryption.decryptJson<string>(row.encryptedClientSecret),
          redirectUri: row.redirectUri ?? this.defaultRedirectUri(),
          source: 'team',
        };
      }
    } catch (error) {
      const code = (error as { code?: string })?.code;
      if (code !== 'P2021') throw error;
    }
    return this.envCredentials();
  }

  async isConfigured(teamId: string): Promise<boolean> {
    return Boolean(await this.resolve(teamId));
  }

  async getView(teamId: string): Promise<TikTokAppCredentialsView> {
    const env = this.envCredentials();
    let row: Awaited<ReturnType<typeof this.prisma.tikTokAppCredentials.findUnique>> = null;
    try {
      row = await this.prisma.tikTokAppCredentials.findUnique({ where: { teamId } });
    } catch (error) {
      const code = (error as { code?: string })?.code;
      if (code !== 'P2021') throw error;
    }
    if (row) {
      const clientKey = this.encryption.decryptJson<string>(row.encryptedClientKey);
      return {
        configured: true,
        source: 'team',
        clientKey,
        clientKeyHint: row.clientKeyHint ?? this.maskKey(clientKey),
        redirectUri: row.redirectUri ?? this.defaultRedirectUri(),
        hasClientSecret: Boolean(row.encryptedClientSecret),
        envConfigured: Boolean(env),
        teamConfigured: true,
      };
    }
    if (env) {
      return {
        configured: true,
        source: 'env',
        clientKey: null,
        clientKeyHint: this.maskKey(env.clientKey),
        redirectUri: env.redirectUri,
        hasClientSecret: true,
        envConfigured: true,
        teamConfigured: false,
      };
    }
    return {
      configured: false,
      source: null,
      clientKey: null,
      clientKeyHint: null,
      redirectUri: this.defaultRedirectUri(),
      hasClientSecret: false,
      envConfigured: false,
      teamConfigured: false,
    };
  }

  async save(
    teamId: string,
    input: { clientKey: string; clientSecret?: string; redirectUri?: string },
  ) {
    const existing = await this.prisma.tikTokAppCredentials.findUnique({ where: { teamId } });
    const clientKey = input.clientKey.trim();
    const clientSecret = input.clientSecret?.trim() || (existing ? undefined : '');
    if (!clientKey) throw new BadRequestException('Client Key is required');
    if (clientKey.includes('@')) {
      throw new BadRequestException(
        'Client Key must be copied from developers.tiktok.com (Credentials), not an email address.',
      );
    }
    if (!/^[a-z0-9]{8,64}$/i.test(clientKey)) {
      throw new BadRequestException(
        'Invalid Client Key format. Copy the Client key from TikTok Developer Portal → Manage apps → Credentials.',
      );
    }
    if (!clientSecret && !existing) throw new BadRequestException('Client Secret is required');

    const redirectUri = input.redirectUri?.trim() || this.defaultRedirectUri();

    const data = {
      encryptedClientKey: this.encryption.encryptJson(clientKey),
      encryptedClientSecret: clientSecret
        ? this.encryption.encryptJson(clientSecret)
        : existing!.encryptedClientSecret,
      redirectUri,
      clientKeyHint: this.maskKey(clientKey),
    };

    if (existing) {
      return this.prisma.tikTokAppCredentials.update({ where: { teamId }, data });
    }
    return this.prisma.tikTokAppCredentials.create({
      data: { teamId, ...data, encryptedClientSecret: this.encryption.encryptJson(clientSecret!) },
    });
  }

  async clear(teamId: string) {
    await this.prisma.tikTokAppCredentials.deleteMany({ where: { teamId } });
    return { cleared: true };
  }

  private maskKey(key: string) {
    if (key.length <= 4) return '****';
    return `****${key.slice(-4)}`;
  }
}
