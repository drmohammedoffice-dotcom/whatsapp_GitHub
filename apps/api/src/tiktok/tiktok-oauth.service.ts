import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Queue } from 'bullmq';
import { TikTokConnectionStatus } from '@watsapp/database';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { QUEUES } from '../queues/queues.constants';
import { TIKTOK_OAUTH_STATE_TTL_MS } from './tiktok.constants';
import { TikTokApiClient } from './tiktok-api.client';
import { TikTokLogService } from './tiktok-log.service';
import { TikTokTokenService } from './tiktok-token.service';
import type { TikTokSyncJob } from './tiktok-sync.processor';

type OAuthStatePayload = { teamId: string; userId: string; advertiserId?: string };

@Injectable()
export class TikTokOAuthService {
  private readonly logger = new Logger(TikTokOAuthService.name);
  private readonly redirectUri: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly api: TikTokApiClient,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
    private readonly logs: TikTokLogService,
    private readonly tokens: TikTokTokenService,
    @InjectQueue(QUEUES.TIKTOK_SYNC) private readonly syncQueue: Queue<TikTokSyncJob>,
  ) {
    this.redirectUri =
      config.get<string>('TIKTOK_REDIRECT_URI') ??
      `${config.getOrThrow<string>('API_PUBLIC_URL')}/api/v1/tiktok/oauth/callback`;
  }

  async startConnect(teamId: string, userId: string, advertiserId?: string) {
    if (!this.api.isConfigured()) {
      throw new BadRequestException('TikTok OAuth is not configured. Set TIKTOK_CLIENT_KEY and TIKTOK_CLIENT_SECRET.');
    }
    const state = await this.jwt.signAsync(
      { teamId, userId, advertiserId } satisfies OAuthStatePayload,
      {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
        expiresIn: Math.floor(TIKTOK_OAUTH_STATE_TTL_MS / 1000),
      },
    );
    await this.prisma.tikTokAccount.upsert({
      where: { teamId },
      update: { status: TikTokConnectionStatus.CONNECTING },
      create: { teamId, status: TikTokConnectionStatus.CONNECTING },
    });
    await this.logs.info(teamId, 'oauth.start', 'TikTok OAuth flow started');
    return { authUrl: this.api.buildAuthUrl(state, this.redirectUri), state };
  }

  async handleCallback(authCode: string | undefined, state: string | undefined) {
    if (!authCode || !state) throw new BadRequestException('Missing auth_code or state');
    let payload: OAuthStatePayload;
    try {
      payload = await this.jwt.verifyAsync<OAuthStatePayload>(state, {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      });
    } catch {
      throw new BadRequestException('Invalid or expired OAuth state');
    }

    const tokenData = await this.api.exchangeAuthCode(authCode);
    const account = await this.prisma.tikTokAccount.upsert({
      where: { teamId: payload.teamId },
      update: {
        status: TikTokConnectionStatus.CONNECTED,
        connectedAt: new Date(),
        advertiserId: payload.advertiserId ?? tokenData.advertiser_ids?.[0] ?? undefined,
      },
      create: {
        teamId: payload.teamId,
        status: TikTokConnectionStatus.CONNECTED,
        connectedAt: new Date(),
        advertiserId: payload.advertiserId ?? tokenData.advertiser_ids?.[0] ?? undefined,
      },
    });

    await this.tokens.storeTokens(account.id, tokenData);

    await this.prisma.tikTokSettings.upsert({
      where: { teamId: payload.teamId },
      update: {},
      create: { teamId: payload.teamId, accountId: account.id },
    });

    await this.syncQueue.add(
      'sync',
      { teamId: payload.teamId },
      { attempts: 3, backoff: { type: 'exponential', delay: 3000 }, removeOnComplete: 50 },
    ).catch((err: unknown) => {
      this.logger.warn(`Post-connect sync enqueue failed: ${err instanceof Error ? err.message : String(err)}`);
    });

    await this.audit.log({
      teamId: payload.teamId,
      actorUserId: payload.userId,
      action: 'tiktok.connect',
      resource: 'tikTokAccount',
      resourceId: account.id,
    });
    await this.logs.info(payload.teamId, 'oauth.callback', 'TikTok account connected', { accountId: account.id });

    const webUrl = this.config.getOrThrow<string>('WEB_PUBLIC_URL');
    return `${webUrl}/tiktok?connected=1`;
  }

  async disconnect(teamId: string, userId: string, reason?: string) {
    const account = await this.prisma.tikTokAccount.findUnique({ where: { teamId } });
    if (!account) return { ok: true };
    await this.prisma.tikTokToken.deleteMany({ where: { accountId: account.id } });
    await this.prisma.tikTokAccount.update({
      where: { id: account.id },
      data: {
        status: TikTokConnectionStatus.DISCONNECTED,
        businessName: null,
        openId: null,
        advertiserId: null,
        businessCenterId: null,
        connectedAt: null,
        lastSyncAt: null,
      },
    });
    await this.audit.log({
      teamId,
      actorUserId: userId,
      action: 'tiktok.disconnect',
      resource: 'tikTokAccount',
      resourceId: account.id,
      metadata: reason ? { reason } : undefined,
    });
    await this.logs.info(teamId, 'oauth.disconnect', reason ?? 'TikTok account disconnected');
    return { ok: true };
  }
}
