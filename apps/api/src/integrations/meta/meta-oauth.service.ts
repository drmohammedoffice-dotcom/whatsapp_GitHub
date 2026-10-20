import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { ChannelProvider, ChannelStatus, OAuthSessionStatus } from '@watsapp/database';
import { AuditService } from '../../audit/audit.service';
import { PlanEntitlementsService } from '../../billing/plan-entitlements.service';
import { ChannelSecretsService } from '../../channels/channel-secrets.service';
import { ChannelTokenService } from '../../channels/channel-token.service';
import { EncryptionService } from '../../security/encryption.service';
import { PrismaService } from '../../prisma/prisma.service';
import { MetaApiClient, MetaPageAccount } from './meta-api.client';
import { META_OAUTH_SESSION_TTL_MS, META_OAUTH_STATE_TTL_MS } from './meta.constants';
import { MetaService } from './meta.service';
export type MetaOAuthTarget = 'messenger' | 'instagram';

type OAuthStatePayload = {
  teamId: string;
  userId: string;
  purpose: 'meta_connect';
  target?: MetaOAuthTarget;
};

type OAuthSessionPayload = {
  userAccessToken: string;
  userTokenExpiresAt?: string;
  pages: Array<{
    id: string;
    name: string;
    accessToken: string;
    pictureUrl?: string;
    instagram?: {
      id: string;
      username?: string;
      name?: string;
      profilePictureUrl?: string;
    };
  }>;
};

export type MetaCompleteConnectDto = {
  sessionId: string;
  pageIds: string[];
  instagramIds?: string[];
  /** When set, only connect the requested channel(s). Defaults to both Messenger + Instagram. */
  mode?: MetaOAuthTarget | 'both';
};

@Injectable()
export class MetaOAuthService {
  private readonly logger = new Logger(MetaOAuthService.name);
  private readonly redirectUri: string;
  private readonly publicRedirectUri: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly api: MetaApiClient,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly encryption: EncryptionService,
    private readonly channelTokens: ChannelTokenService,
    private readonly secrets: ChannelSecretsService,
    private readonly audit: AuditService,
    private readonly metaService: MetaService,
    private readonly entitlements: PlanEntitlementsService,
  ) {
    const apiPublicUrl = config.getOrThrow<string>('API_PUBLIC_URL').replace(/\/$/, '');
    this.publicRedirectUri =
      config.get<string>('META_AUTH_REDIRECT_URI') ??
      config.get<string>('META_OAUTH_REDIRECT_URI') ??
      `${apiPublicUrl}/api/auth/meta/callback`;
    this.redirectUri =
      config.get<string>('META_OAUTH_REDIRECT_URI') ?? `${apiPublicUrl}/api/v1/meta/oauth/callback`;
  }

  /** Legacy /api/v1/meta/oauth/start — unchanged for existing clients. */
  async startConnect(teamId: string, userId: string) {
    await this.assertMetaStart(teamId);
    return this.startOAuth(teamId, userId, this.redirectUri);
  }

  /** Production route: POST /api/auth/meta/login */
  async startPublicConnect(teamId: string, userId: string, target?: MetaOAuthTarget) {
    if (target === 'instagram') await this.entitlements.assertInstagram(teamId);
    else if (target === 'messenger') await this.entitlements.assertFacebook(teamId);
    else await this.assertMetaStart(teamId);
    return this.startOAuth(teamId, userId, this.publicRedirectUri, target);
  }

  private async assertMetaStart(teamId: string) {
    const entitlements = await this.entitlements.getTeamEntitlements(teamId);
    if (!entitlements.limits.facebookEnabled && !entitlements.limits.instagramEnabled) {
      throw this.entitlements.planUpgradeError('social_integrations', entitlements);
    }
  }

  private async startOAuth(
    teamId: string,
    userId: string,
    redirectUri: string,
    target?: MetaOAuthTarget,
  ) {
    if (!this.api.isConfigured()) {
      throw new BadRequestException('Meta OAuth is not configured. Set META_APP_ID and META_APP_SECRET.');
    }
    const state = await this.jwt.signAsync(
      { teamId, userId, purpose: 'meta_connect', target } satisfies OAuthStatePayload,
      {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
        expiresIn: Math.floor(META_OAUTH_STATE_TTL_MS / 1000),
      },
    );
    const authUrl = this.api.buildAuthUrl(state, redirectUri);
    this.logger.log(
      `[Meta OAuth start] teamId=${teamId} userId=${userId} redirectUri=${redirectUri}`,
    );
    return { authUrl, state };
  }

  /** Legacy /api/v1/meta/oauth/callback */
  async handleCallback(code: string | undefined, state: string | undefined) {
    return this.finishOAuth(code, state, this.redirectUri);
  }

  /** Production route: GET /api/auth/meta/callback */
  async handlePublicCallback(code: string | undefined, state: string | undefined) {
    return this.finishOAuth(code, state, this.publicRedirectUri);
  }

  private async finishOAuth(code: string | undefined, state: string | undefined, redirectUri: string) {
    if (!code || !state) {
      throw new BadRequestException(
        'لم يكتمل تفويض فيسبوك. إذا ظهرت رسالة Invalid Scopes فالتطبيق يطلب صلاحيات غير مفعّلة في Meta Developer Console. أعد المحاولة بعد إزالة الصلاحيات غير المعتمدة أو تواصل مع الدعم.',
      );
    }
    let payload: OAuthStatePayload;
    try {
      payload = await this.jwt.verifyAsync<OAuthStatePayload>(state, {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      });
    } catch {
      throw new BadRequestException('Invalid or expired OAuth state');
    }
    if (payload.purpose !== 'meta_connect') throw new BadRequestException('Invalid OAuth state purpose');

    const shortLived = await this.api.exchangeCodeForToken(code, redirectUri).catch((error) => {
      throw this.api.toOAuthError('short_token', error);
    });
    this.logger.log('[Meta OAuth callback] short-lived token obtained');
    const longLived = await this.api.exchangeForLongLivedToken(shortLived.access_token).catch((error) => {
      throw this.api.toOAuthError('long_lived_token', error);
    });
    this.logger.log('[Meta OAuth callback] long-lived token obtained');
    const pages = await this.api.getPageAccounts(longLived.access_token).catch((error) => {
      throw this.api.toOAuthError('page_accounts', error);
    });
    const instagramCount = pages.filter((p) => p.instagram_business_account?.id).length;
    this.logger.log(
      `[Meta OAuth callback] fetched ${pages.length} page(s), ${instagramCount} with Instagram via Graph API`,
    );
    if (payload.target === 'instagram') {
      for (const page of pages) {
        this.logger.log(
          `[Meta OAuth callback][instagram-target] pageId=${page.id} name=${JSON.stringify(page.name)} ` +
            `instagram_business_account=${JSON.stringify(page.instagram_business_account ?? null)} ` +
            `connected_instagram_account=${JSON.stringify(page.connected_instagram_account ?? null)}`,
        );
      }
    }
    const userTokenExpiresAt = longLived.expires_in
      ? new Date(Date.now() + longLived.expires_in * 1000)
      : null;

    await this.persistPageCredentials(payload.teamId, longLived.access_token, userTokenExpiresAt, pages);

    const sessionPayload: OAuthSessionPayload = {      userAccessToken: longLived.access_token,
      userTokenExpiresAt: longLived.expires_in
        ? new Date(Date.now() + longLived.expires_in * 1000).toISOString()
        : undefined,
      pages: pages.map((page) => this.mapPage(page)),
    };

    const session = await this.prisma.socialOAuthSession.create({
      data: {
        teamId: payload.teamId,
        userId: payload.userId,
        provider: 'META',
        status: OAuthSessionStatus.PENDING,
        encryptedPayload: this.encryption.encryptJson(sessionPayload),
        expiresAt: new Date(Date.now() + META_OAUTH_SESSION_TTL_MS),
      },
    });

    const webUrl = this.config.getOrThrow<string>('WEB_PUBLIC_URL').replace(/\/$/, '');
    const targetParam = payload.target ? `&target=${payload.target}` : '';
    const selectUrl = `${webUrl}/integrations/meta/select?session=${session.id}${targetParam}`;
    this.logger.log(`[Meta OAuth callback] session=${session.id} pages=${pages.length} target=${payload.target ?? 'both'} redirect=${selectUrl}`);
    return selectUrl;
  }

  /**
   * Persist OAuth tokens and page/Instagram IDs to MetaConnection for each authorized Page.
   * Tokens are encrypted at rest; used for Messenger + Instagram Graph API calls.
   */
  private async persistPageCredentials(
    teamId: string,
    userAccessToken: string,
    userAccessTokenExpiresAt: Date | null,
    pages: MetaPageAccount[],
  ) {
    const encryptedUser = this.encryption.encryptJson(userAccessToken);

    for (const page of pages) {
      const ig = page.instagram_business_account;
      await this.prisma.metaConnection.upsert({
        where: { teamId_pageId: { teamId, pageId: page.id } },
        update: {
          pageName: page.name,
          instagramId: ig?.id ?? null,
          instagramHandle: ig?.username ?? null,
          profilePictureUrl: ig?.profile_picture_url ?? page.picture?.data?.url ?? null,
          encryptedUserAccessToken: encryptedUser,
          encryptedPageAccessToken: this.encryption.encryptJson(page.access_token),
          userAccessTokenExpiresAt: userAccessTokenExpiresAt,
          connectionSource: 'oauth',
          metadata: {
            instagramBusinessAccountId: ig?.id ?? null,
            instagramName: ig?.name ?? null,
          },
        },
        create: {
          teamId,
          pageId: page.id,
          pageName: page.name,
          instagramId: ig?.id ?? null,
          instagramHandle: ig?.username ?? null,
          profilePictureUrl: ig?.profile_picture_url ?? page.picture?.data?.url ?? null,
          encryptedUserAccessToken: encryptedUser,
          encryptedPageAccessToken: this.encryption.encryptJson(page.access_token),
          userAccessTokenExpiresAt: userAccessTokenExpiresAt,
          connectionSource: 'oauth',
          metadata: {
            instagramBusinessAccountId: ig?.id ?? null,
            instagramName: ig?.name ?? null,
          },
        },
      });
    }

    this.logger.log(
      `[Meta OAuth persisted] teamId=${teamId} pages=${pages.length} instagramAccounts=${pages.filter((p) => p.instagram_business_account).length}`,
    );
  }

  async getSessionPages(teamId: string, sessionId: string) {
    const session = await this.loadSession(teamId, sessionId);
    const payload = this.encryption.decryptJson<OAuthSessionPayload>(session.encryptedPayload);
    const pages = payload.pages.map((page) => ({
      id: page.id,
      name: page.name,
      pictureUrl: page.pictureUrl,
      instagram: page.instagram
        ? {
            id: page.instagram.id,
            username: page.instagram.username,
            name: page.instagram.name,
            profilePictureUrl: page.instagram.profilePictureUrl,
          }
        : null,
    }));

    for (const page of pages) {
      this.logger.log(
        `[Meta page audit] ${JSON.stringify({
          source: 'session-pages',
          pageId: page.id,
          pageName: page.name,
          resolvedInstagram: page.instagram,
        })}`,
      );
    }

    return {
      sessionId: session.id,
      expiresAt: session.expiresAt,
      pages,
    };
  }

  async completeConnect(teamId: string, userId: string, dto: MetaCompleteConnectDto) {
    const session = await this.loadSession(teamId, dto.sessionId);
    const payload = this.encryption.decryptJson<OAuthSessionPayload>(session.encryptedPayload);
    const selectedPages = payload.pages.filter((p) => dto.pageIds.includes(p.id));
    if (!selectedPages.length) throw new BadRequestException('No valid pages selected');

    const callbackUrl = `${this.config.getOrThrow<string>('API_PUBLIC_URL').replace(/\/$/, '')}/api/webhooks/meta`;
    const verifyToken = this.config.get<string>('META_VERIFY_TOKEN', 'chatloora_secure_verify_token_2026');
    await this.api.ensureAppWebhookSubscription(callbackUrl, verifyToken);

    const mode = dto.mode ?? 'both';
    const connectMessenger = mode === 'both' || mode === 'messenger';
    const connectInstagram = mode === 'both' || mode === 'instagram';

    const instagramIds =
      dto.instagramIds === undefined
        ? new Set(selectedPages.filter((p) => p.instagram).map((p) => p.instagram!.id))
        : new Set(dto.instagramIds);

    if (connectInstagram && !instagramIds.size) {
      throw new BadRequestException(
        'No Instagram Business account is linked to the selected Facebook Page(s). ' +
          'Connect an Instagram Professional account to your Page in Meta Business settings, then try again.',
      );
    }

    const connected: Array<{ channelId: string; provider: ChannelProvider; name: string }> = [];

    for (const page of selectedPages) {
      try {
        if (connectMessenger) {
          const messenger = await this.connectPageChannel(teamId, page, ChannelProvider.META_MESSENGER);
          connected.push({ channelId: messenger.id, provider: ChannelProvider.META_MESSENGER, name: messenger.name });
        }

        if (connectInstagram && page.instagram && instagramIds.has(page.instagram.id)) {
          const ig = await this.connectInstagramChannel(teamId, page);
          connected.push({ channelId: ig.id, provider: ChannelProvider.META_INSTAGRAM, name: ig.name });
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.error(`[Meta OAuth complete] failed for page ${page.id}: ${message}`);
        throw new BadRequestException(`Failed to connect page "${page.name}": ${message}`);
      }
    }

    await this.prisma.socialOAuthSession.update({
      where: { id: session.id },
      data: { status: OAuthSessionStatus.COMPLETED, completedAt: new Date() },
    });

    await this.audit.log({
      teamId,
      actorUserId: userId,
      action: 'meta.oauth.complete',
      resource: 'socialOAuthSession',
      resourceId: session.id,
      metadata: { connectedCount: connected.length },
    });

    void this.metaService.syncInboxMessages(teamId).catch((err) => {
      this.logger.warn(`[Meta OAuth complete] inbox sync failed: ${err instanceof Error ? err.message : String(err)}`);
    });

    return { connected };
  }

  async reconnect(teamId: string, userId: string) {
    return this.startPublicConnect(teamId, userId);
  }

  private async connectPageChannel(
    teamId: string,
    page: OAuthSessionPayload['pages'][number],
    provider: ChannelProvider,
  ) {
    if (provider === ChannelProvider.META_INSTAGRAM) {
      await this.entitlements.assertInstagram(teamId);
    } else {
      await this.entitlements.assertFacebook(teamId);
    }
    // Page access tokens were issued by /me/accounts during OAuth — no extra Graph call needed.
    // validatePage() requires pages_read_engagement, which we intentionally do not request.
    const channel = await this.prisma.channel.upsert({
      where: { teamId_provider_externalId: { teamId, provider, externalId: page.id } },
      update: {
        name: page.name,
        status: ChannelStatus.CONNECTED,
        lastSeenAt: new Date(),
        metadata: {
          pageId: page.id,
          profilePictureUrl: page.pictureUrl,
          connectionSource: 'oauth',
        },
      },
      create: {
        teamId,
        provider,
        name: page.name,
        status: ChannelStatus.CONNECTED,
        externalId: page.id,
        lastSeenAt: new Date(),
        metadata: {
          pageId: page.id,
          profilePictureUrl: page.pictureUrl,
          connectionSource: 'oauth',
        },
      },
    });

    await this.secrets.setAccessToken(channel.id, page.accessToken, {
      pageId: page.id,
      profilePictureUrl: page.pictureUrl,
      connectionSource: 'oauth',
    });
    try {
      await this.api.subscribePageToWebhooks(page.id, page.accessToken);
    } catch (error) {
      this.logger.warn(`Meta webhook subscription failed for page ${page.id}: ${error instanceof Error ? error.message : String(error)}`);
    }
    return channel;
  }

  private async connectInstagramChannel(teamId: string, page: OAuthSessionPayload['pages'][number]) {
    const ig = page.instagram!;
    const name = ig.name ?? ig.username ?? 'Instagram';
    const channel = await this.prisma.channel.upsert({
      where: { teamId_provider_externalId: { teamId, provider: ChannelProvider.META_INSTAGRAM, externalId: ig.id } },
      update: {
        name,
        status: ChannelStatus.CONNECTED,
        lastSeenAt: new Date(),
        metadata: {
          pageId: page.id,
          instagramUsername: ig.username,
          instagramBusinessAccountId: ig.id,
          profilePictureUrl: ig.profilePictureUrl ?? page.pictureUrl,
          connectionSource: 'oauth',
        },
      },
      create: {
        teamId,
        provider: ChannelProvider.META_INSTAGRAM,
        name,
        status: ChannelStatus.CONNECTED,
        externalId: ig.id,
        lastSeenAt: new Date(),
        metadata: {
          pageId: page.id,
          instagramUsername: ig.username,
          instagramBusinessAccountId: ig.id,
          profilePictureUrl: ig.profilePictureUrl ?? page.pictureUrl,
          connectionSource: 'oauth',
        },
      },
    });

    await this.secrets.setAccessToken(channel.id, page.accessToken, {
      pageId: page.id,
      instagramUsername: ig.username,
      profilePictureUrl: ig.profilePictureUrl ?? page.pictureUrl,
      connectionSource: 'oauth',
    });

    const access = await this.api.inspectInstagramAccess(page.id, page.accessToken);
    if (access.missingScopes.length) {
      this.logger.warn(
        `[Meta OAuth Instagram] missing scopes for page ${page.id}: ${access.missingScopes.join(', ')}`,
      );
    }
    if (access.conversationsError) {
      this.logger.warn(`[Meta OAuth Instagram] conversations API blocked: ${access.conversationsError}`);
    }

    try {
      await this.api.subscribePageToWebhooks(page.id, page.accessToken);
    } catch (error) {
      this.logger.warn(`Instagram webhook subscription failed for IG ${ig.id}: ${error instanceof Error ? error.message : String(error)}`);
    }
    return channel;
  }

  private mapPage(page: MetaPageAccount): OAuthSessionPayload['pages'][number] {
    const ig =
      page.instagram_business_account ??
      (page.connected_instagram_account?.id
        ? {
            id: page.connected_instagram_account.id,
            username: page.connected_instagram_account.username,
          }
        : undefined);

    return {
      id: page.id,
      name: page.name,
      accessToken: page.access_token,
      pictureUrl: page.picture?.data?.url,
      instagram: ig
        ? {
            id: ig.id,
            username: ig.username,
            name: ig.name,
            profilePictureUrl: ig.profile_picture_url,
          }
        : undefined,
    };
  }

  private async loadSession(teamId: string, sessionId: string) {
    const session = await this.prisma.socialOAuthSession.findFirst({
      where: { id: sessionId, teamId, provider: 'META' },
    });
    if (!session) throw new NotFoundException('OAuth session not found');
    if (session.status !== OAuthSessionStatus.PENDING) {
      throw new BadRequestException('OAuth session already completed');
    }
    if (session.expiresAt.getTime() <= Date.now()) {
      await this.prisma.socialOAuthSession.update({
        where: { id: session.id },
        data: { status: OAuthSessionStatus.EXPIRED },
      });
      throw new BadRequestException('OAuth session expired — please reconnect Facebook');
    }
    return session;
  }
}
