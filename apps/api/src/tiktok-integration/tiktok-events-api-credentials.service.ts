import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { EncryptionService } from '../security/encryption.service';
import { TikTokAdsService } from '../integrations/tiktok-login-kit/tiktok-ads.service';
import { TikTokMarketingOAuthService } from '../integrations/tiktok-login-kit/tiktok-marketing-oauth.service';

export type EventsApiValidationResult = {
  ok: boolean;
  status: 'connected' | 'invalid_token' | 'pixel_not_found' | 'token_mismatch' | 'permission_denied' | 'events_api_unavailable' | 'disconnected';
  message: string;
  pixelName?: string | null;
  pixelId?: string | null;
  pixelCode?: string | null;
  verifiedAt?: string;
};

@Injectable()
export class TikTokEventsApiCredentialsService {
  private readonly logger = new Logger(TikTokEventsApiCredentialsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
    private readonly ads: TikTokAdsService,
    private readonly marketingOAuth: TikTokMarketingOAuthService,
    private readonly config: ConfigService,
  ) {}

  async saveCredentials(
    userId: string,
    teamId: string,
    integrationId: string,
    input: { pixelId?: string; pixelCode: string; accessToken: string; pixelName?: string },
  ) {
    const integration = await this.requireIntegration(userId, teamId, integrationId);
    const pixelCode = input.pixelCode.trim();
    const accessToken = input.accessToken.trim();
    if (!pixelCode) throw new BadRequestException('Pixel ID / Pixel Code is required');
    if (accessToken.length < 20) throw new BadRequestException('Invalid Access Token');

    const validation = await this.validateCredentials({
      pixelCode,
      pixelId: input.pixelId?.trim() || pixelCode,
      accessToken,
      advertiserId: integration.advertiserId,
      userId,
    });

    if (!validation.ok) {
      throw new BadRequestException(validation.message || 'TikTok Events API validation failed');
    }

    const updated = await this.prisma.tikTokIntegration.update({
      where: { id: integration.id },
      data: {
        pixelCode,
        pixelId: input.pixelId?.trim() || integration.pixelId || pixelCode,
        pixelName: input.pixelName?.trim() || validation.pixelName || integration.pixelName,
        encryptedEventsApiAccessToken: this.encryption.encryptJson(accessToken),
        eventsApiTokenHint: this.hint(accessToken),
        eventsApiConnected: true,
        eventsApiStatus: 'connected',
        eventsApiStatusMessage: 'Connected successfully',
        lastEventsApiVerificationAt: new Date(),
        pixelStatus: 'active',
        pixelStatusMessage: 'Events API verified',
        lastPixelStatusCheckAt: new Date(),
        wizardCompleted: true,
        wizardStep: Math.max(integration.wizardStep, 6),
      },
      include: { eventConfigurations: true },
    });

    return {
      ok: true as const,
      message: '✅ Connected successfully',
      validation,
      integrationId: updated.id,
      pixelName: updated.pixelName,
      pixelId: updated.pixelId,
      pixelCode: updated.pixelCode,
      status: updated.eventsApiStatus,
      createdAt: updated.createdAt.toISOString(),
      lastVerificationTime: updated.lastEventsApiVerificationAt?.toISOString() ?? null,
      hasEventsApiToken: true,
      eventsApiTokenHint: updated.eventsApiTokenHint,
    };
  }

  async testConnection(userId: string, teamId: string, integrationId: string) {
    const integration = await this.requireIntegration(userId, teamId, integrationId);
    const accessToken = this.decryptToken(integration.encryptedEventsApiAccessToken);
    if (!accessToken || !integration.pixelCode) {
      return {
        ok: false as const,
        status: 'disconnected' as const,
        message: 'Pixel ID and Events API Access Token are required',
      };
    }

    const validation = await this.validateCredentials({
      pixelCode: integration.pixelCode,
      pixelId: integration.pixelId ?? integration.pixelCode,
      accessToken,
      advertiserId: integration.advertiserId,
      userId,
    });

    await this.prisma.tikTokIntegration.update({
      where: { id: integration.id },
      data: {
        eventsApiConnected: validation.ok,
        eventsApiStatus: validation.status,
        eventsApiStatusMessage: validation.message,
        lastEventsApiVerificationAt: new Date(),
        ...(validation.ok
          ? {
              pixelStatus: 'active',
              pixelStatusMessage: 'Events API verified',
              lastPixelStatusCheckAt: new Date(),
            }
          : {
              lastApiError: validation.message.slice(0, 2000),
            }),
        ...(validation.pixelName ? { pixelName: validation.pixelName } : {}),
      },
    });

    return {
      ...validation,
      message: validation.ok ? '✅ Connected successfully' : validation.message,
      pixelName: validation.pixelName ?? integration.pixelName,
      pixelId: validation.pixelId ?? integration.pixelId,
      pixelCode: integration.pixelCode,
      lastVerificationTime: new Date().toISOString(),
      createdAt: integration.createdAt.toISOString(),
    };
  }

  getAccessTokenForIntegration(integration: {
    encryptedEventsApiAccessToken?: string | null;
  }): string | null {
    return this.decryptToken(integration.encryptedEventsApiAccessToken);
  }

  /** Platform-level Chatloora ads pixel (signup / subscription purchase). */
  getPlatformCredentials(): { pixelCode: string; accessToken: string } | null {
    const pixelCode = this.config.get<string>('TIKTOK_PLATFORM_PIXEL_CODE')?.trim();
    const accessToken = this.config.get<string>('TIKTOK_PLATFORM_EVENTS_ACCESS_TOKEN')?.trim();
    if (!pixelCode || !accessToken) return null;
    return { pixelCode, accessToken };
  }

  private async validateCredentials(input: {
    pixelCode: string;
    pixelId: string;
    accessToken: string;
    advertiserId?: string | null;
    userId: string;
  }): Promise<EventsApiValidationResult> {
    const verifiedAt = new Date().toISOString();
    let resolvedPixelName: string | undefined;

    // Optional: verify pixel exists under advertiser when Marketing OAuth is available.
    if (input.advertiserId) {
      try {
        const marketingToken = await this.marketingOAuth.getValidMarketingAccessToken(input.userId);
        const pixels = await this.ads.listPixels(marketingToken, input.advertiserId);
        const match = pixels.find(
          (p) =>
            p.pixel_id === input.pixelId ||
            p.pixel_id === input.pixelCode ||
            p.pixel_code === input.pixelCode,
        );
        if (!match) {
          return {
            ok: false,
            status: 'pixel_not_found',
            message: 'Pixel not found for this advertiser / Token does not belong to this Pixel',
            verifiedAt,
          };
        }
        resolvedPixelName = match.pixel_name ?? undefined;
        const activity = String(match.activity_status ?? '');
        if (activity && /disable|inactive|delete/i.test(activity)) {
          return {
            ok: false,
            status: 'events_api_unavailable',
            message: 'Pixel is not active',
            pixelName: match.pixel_name,
            pixelId: match.pixel_id,
            pixelCode: match.pixel_code || input.pixelCode,
            verifiedAt,
          };
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (/401|unauthorized|invalid.*token/i.test(message)) {
          // Fall through to Events API probe with the provided token.
          this.logger.warn(`Marketing pixel list skipped: ${message}`);
        } else {
          this.logger.warn(`Pixel list check skipped: ${message}`);
        }
      }
    }

    try {
      const response = await this.ads.trackPixelEvent(input.accessToken, input.pixelCode, {
        event: 'PageView',
        event_id: `verify_${randomUUID()}`,
        event_time: Math.floor(Date.now() / 1000),
        url: `${this.config.getOrThrow<string>('WEB_PUBLIC_URL').replace(/\/$/, '')}/tiktok/integration`,
        properties: { contents: 'chatloora_events_api_verification' },
      });
      const code = Number((response as { code?: number })?.code ?? 0);
      if (code !== 0) {
        return this.mapApiError(String((response as { message?: string })?.message || 'Events API error'), verifiedAt);
      }
      return {
        ok: true,
        status: 'connected',
        message: 'Connected successfully — Pixel and Events API Access Token are valid',
        pixelId: input.pixelId,
        pixelCode: input.pixelCode,
        pixelName: resolvedPixelName ?? null,
        verifiedAt,
      };
    } catch (err) {
      return this.mapApiError(err instanceof Error ? err.message : String(err), verifiedAt);
    }
  }

  private mapApiError(message: string, verifiedAt: string): EventsApiValidationResult {
    const m = message.toLowerCase();
    if (/unauthorized|invalid.?token|401|access.?token/i.test(m)) {
      return { ok: false, status: 'invalid_token', message: 'Invalid Access Token', verifiedAt };
    }
    if (/permission|forbidden|403|scope/i.test(m)) {
      return { ok: false, status: 'permission_denied', message: 'Permission denied', verifiedAt };
    }
    if (/pixel.?not.?found|not.?exist|404/i.test(m)) {
      return { ok: false, status: 'pixel_not_found', message: 'Pixel not found', verifiedAt };
    }
    if (/event.?api|events.?api|unavailable|not.?enabled/i.test(m)) {
      return { ok: false, status: 'events_api_unavailable', message: 'Events API unavailable', verifiedAt };
    }
    return {
      ok: false,
      status: 'events_api_unavailable',
      message: message.slice(0, 300) || 'Events API unavailable',
      verifiedAt,
    };
  }

  private decryptToken(encrypted?: string | null): string | null {
    if (!encrypted) return null;
    try {
      return this.encryption.decryptJson<string>(encrypted);
    } catch {
      return null;
    }
  }

  private hint(token: string) {
    if (token.length <= 8) return '••••';
    return `${token.slice(0, 4)}…${token.slice(-4)}`;
  }

  private async requireIntegration(userId: string, teamId: string, integrationId: string) {
    const integration = await this.prisma.tikTokIntegration.findFirst({
      where: { id: integrationId, userId, teamId },
    });
    if (!integration) throw new NotFoundException('Integration not found');
    return integration;
  }
}
