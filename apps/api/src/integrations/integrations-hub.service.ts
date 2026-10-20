import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  ChannelProvider,
  ChannelStatus,
  GoogleCalendarConnectionStatus,
  WhatsAppCloudAccountStatus,
  WhatsAppSessionStatus,
} from '@watsapp/database';
import { PlanEntitlementsService } from '../billing/plan-entitlements.service';
import { GoogleCalendarOAuthService } from './google-calendar/google-calendar-oauth.service';
import { GoogleCalendarSyncService } from './google-calendar/google-calendar-sync.service';
import { MetaOAuthService } from './meta/meta-oauth.service';
import { MetaService } from './meta/meta.service';
import { ConnectionsService, ConnectionHealth } from './connections.service';
import { TelegramService } from './telegram/telegram.service';
import { TelegramUserService } from './telegram-user/telegram-user.service';
import { TikTokLoginService } from './tiktok-login-kit/tiktok-login.service';
import { TikTokBusinessService } from './tiktok-login-kit/tiktok-business.service';
import { WhatsAppService } from '../modules/whatsapp/whatsapp.service';
import { PrismaService } from '../prisma/prisma.service';
import { WhatsAppCloudService } from '../platform/whatsapp-cloud/whatsapp-cloud.service';
import {
  INTEGRATION_PROVIDERS,
  IntegrationAccount,
  IntegrationConnectResponse,
  IntegrationConnectionStatus,
  IntegrationHealth,
  IntegrationProvider,
  IntegrationProviderSummary,
  IntegrationsHubResponse,
} from './integrations-hub.types';

type ChannelRow = Awaited<ReturnType<ConnectionsService['list']>>[number];

function isGoogleProvider(provider: string): provider is 'google' | 'google-calendar' {
  return provider === 'google' || provider === 'google-calendar';
}

@Injectable()
export class IntegrationsHubService {
  constructor(
    private readonly connections: ConnectionsService,
    private readonly entitlements: PlanEntitlementsService,
    private readonly meta: MetaService,
    private readonly metaOAuth: MetaOAuthService,
    private readonly telegramBot: TelegramService,
    private readonly telegramUser: TelegramUserService,
    private readonly tiktokLogin: TikTokLoginService,
    private readonly tiktokBusiness: TikTokBusinessService,
    private readonly whatsapp: WhatsAppService,
    private readonly whatsappCloud: WhatsAppCloudService,
    private readonly prisma: PrismaService,
    private readonly googleOAuth: GoogleCalendarOAuthService,
    private readonly googleSync: GoogleCalendarSyncService,
  ) {}

  async list(teamId: string, userId: string): Promise<IntegrationsHubResponse> {
    const [channels, whatsappSessions, whatsappCloudAccounts, tiktokBusiness, googleStatus] = await Promise.all([
      this.connections.list(teamId),
      this.whatsapp.list(teamId, userId),
      this.prisma.whatsAppCloudAccount.findMany({
        where: { teamId, status: WhatsAppCloudAccountStatus.CONNECTED },
        orderBy: { connectedAt: 'desc' },
      }),
      this.tiktokBusiness.getStatus(userId),
      this.googleOAuth.status(teamId),
    ]);

    const metaApp = this.meta.getStatus();
    const messengerChannels = channels.filter((c: ChannelRow) => c.provider === ChannelProvider.META_MESSENGER);
    const instagramChannels = channels.filter((c: ChannelRow) => c.provider === ChannelProvider.META_INSTAGRAM);
    const botChannels = channels.filter((c: ChannelRow) => c.provider === ChannelProvider.TELEGRAM);
    const personalChannels = channels.filter((c: ChannelRow) => c.provider === ChannelProvider.TELEGRAM_USER);

    const providers: IntegrationProviderSummary[] = [
      this.buildMetaProvider('facebook-messenger', messengerChannels, metaApp.oauthEnabled),
      this.buildMetaProvider('instagram', instagramChannels, metaApp.oauthEnabled),
      this.buildWhatsAppProvider(whatsappSessions, whatsappCloudAccounts),
      this.buildTikTokProvider(tiktokBusiness),
      this.buildTelegramProvider(botChannels, personalChannels),
      this.buildGoogleProvider(googleStatus),
    ];

    return { updatedAt: new Date().toISOString(), providers };
  }

  async getProvider(
    teamId: string,
    userId: string,
    provider: string,
  ): Promise<IntegrationProviderSummary> {
    this.assertProvider(provider);
    const hub = await this.list(teamId, userId);
    const key = isGoogleProvider(provider) ? 'google' : provider;
    const found = hub.providers.find((p) => p.provider === key || p.provider === provider);
    if (!found) throw new NotFoundException(`Integration provider "${provider}" not found`);
    return found;
  }

  async getStatus(teamId: string, userId: string, provider: string) {
    this.assertProvider(provider);
    // Google Calendar UI expects the connection row shape (CONNECTED / email / calendar).
    if (isGoogleProvider(provider)) {
      const connection = await this.googleOAuth.status(teamId);
      return (
        connection ?? {
          status: GoogleCalendarConnectionStatus.DISCONNECTED,
          googleAccountEmail: null,
          calendarId: null,
          calendarSummary: null,
          connectedAt: null,
          lastSyncAt: null,
          failureReason: null,
        }
      );
    }
    const summary = await this.getProvider(teamId, userId, provider);
    return {
      provider: summary.provider,
      status: summary.status,
      health: summary.health,
      connected: summary.connected,
      accountCount: summary.accountCount,
      lastSyncAt: summary.lastSyncAt,
      accounts: summary.accounts,
    };
  }

  async connect(
    teamId: string,
    userId: string,
    provider: string,
    body?: { sessionId?: string; channelId?: string },
  ): Promise<IntegrationConnectResponse> {
    this.assertProvider(provider);

    if (isGoogleProvider(provider)) {
      const started = await this.googleOAuth.startConnect(teamId, userId);
      return { action: 'redirect', url: started.url, authUrl: started.url };
    }

    switch (provider as IntegrationProvider) {
      case 'facebook-messenger': {
        await this.entitlements.assertFacebook(teamId);
        const { authUrl } = await this.metaOAuth.startPublicConnect(teamId, userId, 'messenger');
        return { action: 'redirect', url: authUrl, authUrl };
      }
      case 'instagram': {
        await this.entitlements.assertInstagram(teamId);
        const { authUrl } = await this.metaOAuth.startPublicConnect(teamId, userId, 'instagram');
        return { action: 'redirect', url: authUrl, authUrl };
      }
      case 'whatsapp': {
        await this.entitlements.assertWhatsappInboxConnect(teamId);
        return {
          action: 'navigate',
          url: '/whatsapp',
          message: 'Connect WhatsApp via QR or Cloud API',
        };
      }
      case 'tiktok': {
        await this.entitlements.assertTiktokEnabled(teamId);
        const { authUrl } = await this.tiktokLogin.startLogin(userId, teamId);
        return { action: 'redirect', url: authUrl };
      }
      case 'telegram':
        await this.entitlements.assertTelegram(teamId);
        return { action: 'inline', flow: 'telegram-user', message: 'Complete Telegram login in the panel' };
      default:
        throw new BadRequestException('Unsupported provider');
    }
  }

  async disconnect(
    teamId: string,
    userId: string,
    provider: string,
    body?: {
      channelId?: string;
      sessionId?: string;
      accountId?: string;
      cloudAccountId?: string;
      connectionId?: string;
    },
  ) {
    this.assertProvider(provider);

    if (isGoogleProvider(provider)) {
      await this.googleOAuth.disconnect(teamId, userId);
      return { disconnected: true };
    }

    switch (provider as IntegrationProvider) {
      case 'facebook-messenger':
      case 'instagram': {
        if (!body?.channelId) throw new BadRequestException('channelId is required');
        await this.meta.disconnect(teamId, body.channelId);
        return { disconnected: true };
      }
      case 'whatsapp': {
        const cloudAccountId = body?.cloudAccountId ?? body?.accountId;
        if (cloudAccountId && !body?.sessionId) {
          await this.whatsappCloud.disconnect(teamId, cloudAccountId);
          return { disconnected: true };
        }
        if (!body?.sessionId) throw new BadRequestException('sessionId or cloudAccountId is required');
        await this.whatsapp.disconnect(teamId, body.sessionId, userId);
        return { disconnected: true };
      }
      case 'tiktok':
        await this.tiktokLogin.disconnect(userId);
        return { disconnected: true };
      case 'telegram': {
        if (!body?.channelId) throw new BadRequestException('channelId is required');
        if (body.connectionId) {
          await this.telegramUser.disconnect(teamId, body.connectionId);
          return { disconnected: true };
        }
        const channel = await this.connections.findChannel(teamId, body.channelId);
        if (!channel) throw new NotFoundException('Telegram account not found');
        if (channel.provider === ChannelProvider.TELEGRAM_USER) {
          if (!channel.telegramConnectionId) {
            throw new BadRequestException('Telegram personal connection is missing');
          }
          await this.telegramUser.disconnect(teamId, channel.telegramConnectionId);
          return { disconnected: true };
        }
        if (channel.provider === ChannelProvider.TELEGRAM) {
          await this.telegramBot.disconnect(teamId, body.channelId);
          return { disconnected: true };
        }
        throw new NotFoundException('Telegram account not found');
      }
      default:
        throw new BadRequestException('Unsupported provider');
    }
  }

  async reconnect(
    teamId: string,
    userId: string,
    provider: string,
    body?: { sessionId?: string; accountId?: string; cloudAccountId?: string },
  ) {
    if (isGoogleProvider(provider)) {
      const started = await this.googleOAuth.reconnect(teamId, userId);
      return { action: 'redirect' as const, url: started.url, authUrl: started.url };
    }
    if (provider === 'whatsapp') {
      await this.entitlements.assertWhatsappInboxConnect(teamId);
      if (body?.cloudAccountId) {
        return {
          action: 'navigate' as const,
          url: '/whatsapp',
          message: 'Update Cloud API credentials on the WhatsApp page',
        };
      }
      if (body?.sessionId) {
        await this.whatsapp.reconnect(teamId, body.sessionId, userId);
        return { action: 'navigate' as const, url: '/whatsapp', message: 'Reconnecting WhatsApp session' };
      }
      return {
        action: 'navigate' as const,
        url: '/whatsapp',
        message: 'Connect WhatsApp via QR or Cloud API',
      };
    }
    return this.connect(teamId, userId, provider, body);
  }

  async sync(teamId: string, _userId: string, provider: string) {
    this.assertProvider(provider);
    if (!isGoogleProvider(provider)) {
      throw new BadRequestException('Sync is only supported for Google Calendar');
    }
    return this.googleSync.syncCalendar(teamId);
  }

  private assertProvider(provider: string): asserts provider is IntegrationProvider {
    if (!INTEGRATION_PROVIDERS.includes(provider as IntegrationProvider)) {
      throw new NotFoundException(`Unknown integration provider: ${provider}`);
    }
  }

  private buildGoogleProvider(
    connection: Awaited<ReturnType<GoogleCalendarOAuthService['status']>>,
  ): IntegrationProviderSummary {
    const connected = connection?.status === GoogleCalendarConnectionStatus.CONNECTED;
    const accounts: IntegrationAccount[] = connected
      ? [
          {
            id: connection!.id,
            name: connection!.googleAccountEmail ?? 'Google Calendar',
            subtitle: connection!.calendarSummary ?? connection!.calendarId,
            status: 'connected',
            health: 'healthy',
            lastSyncAt: connection!.lastSyncAt?.toISOString() ?? null,
            metadata: {
              calendarId: connection!.calendarId,
              failureReason: connection!.failureReason,
            },
          },
        ]
      : [];
    const aggregate = this.aggregateAccounts(accounts);
    return {
      provider: 'google',
      name: 'Google Calendar',
      description: 'Sync appointments with Google Calendar for AI booking and staff scheduling',
      ...aggregate,
      capabilities: { oauth: true, multiAccount: false, configured: true },
      metadata: {
        status: connection?.status ?? GoogleCalendarConnectionStatus.DISCONNECTED,
        googleAccountEmail: connection?.googleAccountEmail ?? null,
        calendarSummary: connection?.calendarSummary ?? null,
      },
    };
  }

  private buildMetaProvider(
    provider: 'facebook-messenger' | 'instagram',
    channels: Awaited<ReturnType<ConnectionsService['list']>>,
    oauthEnabled: boolean,
  ): IntegrationProviderSummary {
    const accounts: IntegrationAccount[] = channels.map((c) => ({
      id: c.id,
      name: c.name,
      subtitle: provider === 'instagram' ? c.metadata.instagramUsername ?? null : 'Facebook Page',
      avatarUrl: c.metadata.profilePictureUrl ?? null,
      status: this.mapHealth(c.health),
      health: this.healthFromConnection(c.health),
      lastSyncAt: c.lastSeenAt?.toISOString() ?? null,
      metadata: { pageId: c.metadata.pageId, externalId: c.externalId },
    }));

    const aggregate = this.aggregateAccounts(accounts);
    return {
      provider,
      name: provider === 'facebook-messenger' ? 'Facebook Messenger' : 'Instagram',
      description:
        provider === 'facebook-messenger'
          ? 'Connect Facebook Pages for Messenger conversations and AI auto-reply'
          : 'Activate Instagram DMs linked to your Facebook Pages',
      ...aggregate,
      capabilities: { oauth: oauthEnabled, multiAccount: true, configured: oauthEnabled },
    };
  }

  private buildWhatsAppProvider(
    sessions: Awaited<ReturnType<WhatsAppService['list']>>,
    cloudAccounts: Array<{
      id: string;
      name: string;
      phoneNumber: string;
      phoneNumberId: string;
      wabaId: string;
      status: WhatsAppCloudAccountStatus;
      connectedAt: Date | null;
      lastSeenAt: Date | null;
      failureReason: string | null;
    }>,
  ): IntegrationProviderSummary {
    const qrAccounts: IntegrationAccount[] = sessions.map((s) => ({
      id: s.id,
      name: s.displayName ?? s.phoneNumber ?? 'WhatsApp',
      subtitle: s.phoneNumber,
      phoneNumber: s.phoneNumber,
      avatarUrl: s.profilePhotoUrl,
      status: this.mapWhatsAppStatus(s.status),
      health: this.healthFromWhatsApp(s.status, s.failureReason),
      lastSyncAt: s.lastSeenAt?.toISOString() ?? s.lastHeartbeatAt?.toISOString() ?? null,
      metadata: {
        accountType: 'qr',
        qrAvailable: Boolean(s.qrCode),
        qrUpdatedAt: s.qrCodeUpdatedAt?.toISOString() ?? null,
        connectedAt: s.connectedAt?.toISOString() ?? null,
        failureReason: s.failureReason,
      },
    }));

    const cloudIntegrationAccounts: IntegrationAccount[] = cloudAccounts.map((a) => ({
      id: a.id,
      name: a.name || a.phoneNumber || 'WhatsApp Cloud',
      subtitle: `Cloud API · ${a.phoneNumber}`,
      phoneNumber: a.phoneNumber,
      status: a.status === WhatsAppCloudAccountStatus.CONNECTED ? 'connected' : 'disconnected',
      health: a.status === WhatsAppCloudAccountStatus.CONNECTED ? 'healthy' : 'unknown',
      lastSyncAt: a.lastSeenAt?.toISOString() ?? a.connectedAt?.toISOString() ?? null,
      metadata: {
        accountType: 'cloud_api',
        phoneNumberId: a.phoneNumberId,
        wabaId: a.wabaId,
        connectedAt: a.connectedAt?.toISOString() ?? null,
        failureReason: a.failureReason,
      },
    }));

    const accounts = [...cloudIntegrationAccounts, ...qrAccounts];
    const aggregate = this.aggregateAccounts(accounts);
    return {
      provider: 'whatsapp',
      name: 'WhatsApp',
      description: 'Connect via QR or official Meta Cloud API — messages sync to your WhatsApp inbox',
      ...aggregate,
      capabilities: { oauth: false, multiAccount: true, configured: true },
    };
  }

  private buildTikTokProvider(
    status: Awaited<ReturnType<TikTokBusinessService['getStatus']>>,
  ): IntegrationProviderSummary {
    const connected = status.loginConnected || status.marketingConnected;
    const accounts: IntegrationAccount[] = [];

    if (status.loginProfile) {
      accounts.push({
        id: status.loginProfile.openId,
        name: status.loginProfile.displayName ?? 'TikTok Account',
        avatarUrl: status.loginProfile.avatar,
        status: status.loginConnected ? 'connected' : 'disconnected',
        health: status.loginConnected ? 'healthy' : 'unknown',
        lastSyncAt: status.lastSyncAt,
        metadata: { type: 'login', expiresAt: status.loginProfile.expiresAt },
      });
    }

    for (const adv of status.advertisers) {
      accounts.push({
        id: adv.advertiserId,
        name: adv.name ?? adv.advertiserId,
        subtitle: adv.currency ?? undefined,
        status: status.marketingConnected ? 'connected' : 'disconnected',
        health: status.hasBusinessAccess ? 'healthy' : 'degraded',
        lastSyncAt: status.lastSyncAt,
        metadata: { type: 'advertiser', status: adv.status },
      });
    }

    let connectionStatus: IntegrationConnectionStatus = 'disconnected';
    if (connected) connectionStatus = 'connected';
    if (status.marketingExpiresAt && new Date(status.marketingExpiresAt) < new Date()) {
      connectionStatus = 'expired';
    }

    return {
      provider: 'tiktok',
      name: 'TikTok',
      description: 'Connect TikTok Login Kit — auto-detect Business Center, advertisers, and ad accounts',
      status: connectionStatus,
      health: connected ? (status.hasBusinessAccess ? 'healthy' : 'degraded') : 'unknown',
      connected,
      accountCount: accounts.length,
      connectedAccount: status.loginProfile?.displayName ?? status.businessCenter?.name ?? null,
      lastSyncAt: status.lastSyncAt,
      accounts,
      capabilities: {
        oauth: true,
        multiAccount: true,
        configured: status.marketingApiConfigured,
      },
      metadata: {
        businessCenter: status.businessCenter,
        syncMessage: status.syncMessage,
        marketingConnected: status.marketingConnected,
      },
    };
  }

  private buildTelegramProvider(
    botChannels: ChannelRow[],
    personalChannels: ChannelRow[],
  ): IntegrationProviderSummary {
    const accounts: IntegrationAccount[] = [
      ...botChannels.map((c) => ({
        id: c.id,
        name: c.name,
        subtitle: c.metadata.botUsername ? `@${c.metadata.botUsername}` : 'Telegram Bot',
        status: this.mapHealth(c.health),
        health: this.healthFromConnection(c.health),
        lastSyncAt: c.lastSeenAt?.toISOString() ?? null,
        metadata: { type: 'bot', botUsername: c.metadata.botUsername },
      })),
      ...personalChannels.map((c) => ({
        id: c.id,
        name: c.name,
        subtitle: c.metadata.botUsername ? `@${c.metadata.botUsername}` : 'Telegram Personal',
        phoneNumber: null,
        status: this.mapHealth(c.health),
        health: this.healthFromConnection(c.health),
        lastSyncAt: c.lastSeenAt?.toISOString() ?? null,
        metadata: {
          type: 'personal' as const,
          channelId: c.id,
          connectionId: c.telegramConnectionId ?? undefined,
        },
      })),
    ];

    const aggregate = this.aggregateAccounts(accounts);
    return {
      provider: 'telegram',
      name: 'Telegram',
      description: 'Connect Telegram Bot or your personal account via secure MTProto login',
      ...aggregate,
      capabilities: {
        oauth: false,
        multiAccount: true,
        configured: this.telegramUser.isConfigured(),
      },
    };
  }

  private aggregateAccounts(accounts: IntegrationAccount[]) {
    const connectedAccounts = accounts.filter((a) => a.status === 'connected');
    const hasExpired = accounts.some((a) => a.status === 'expired');
    const hasReconnect = accounts.some((a) => a.status === 'reconnect_required');
    const hasSyncing = accounts.some((a) => a.status === 'syncing');
    const hasError = accounts.some((a) => a.status === 'error');

    let status: IntegrationConnectionStatus = 'disconnected';
    if (connectedAccounts.length) status = 'connected';
    else if (hasSyncing) status = 'syncing';
    else if (hasExpired) status = 'expired';
    else if (hasReconnect) status = 'reconnect_required';
    else if (hasError) status = 'error';

    const healthScores = accounts.map((a) => a.health);
    let health: IntegrationHealth = 'unknown';
    if (healthScores.includes('unhealthy')) health = 'unhealthy';
    else if (healthScores.includes('degraded')) health = 'degraded';
    else if (healthScores.includes('healthy')) health = 'healthy';

    const lastSync = accounts
      .map((a) => a.lastSyncAt)
      .filter(Boolean)
      .sort()
      .reverse()[0] ?? null;

    return {
      status,
      health,
      connected: connectedAccounts.length > 0,
      accountCount: accounts.length,
      connectedAccount: connectedAccounts[0]?.name ?? accounts[0]?.name ?? null,
      lastSyncAt: lastSync,
      accounts,
    };
  }

  private mapHealth(health: ConnectionHealth): IntegrationConnectionStatus {
    const map: Record<ConnectionHealth, IntegrationConnectionStatus> = {
      connected: 'connected',
      disconnected: 'disconnected',
      expired: 'expired',
      reconnect_required: 'reconnect_required',
      connecting: 'syncing',
      failed: 'error',
    };
    return map[health];
  }

  private healthFromConnection(health: ConnectionHealth): IntegrationHealth {
    if (health === 'connected') return 'healthy';
    if (health === 'connecting') return 'degraded';
    if (health === 'reconnect_required' || health === 'expired') return 'degraded';
    if (health === 'failed') return 'unhealthy';
    return 'unknown';
  }

  private mapWhatsAppStatus(status: WhatsAppSessionStatus): IntegrationConnectionStatus {
    switch (status) {
      case WhatsAppSessionStatus.CONNECTED:
        return 'connected';
      case WhatsAppSessionStatus.DISCONNECTED:
        return 'disconnected';
      case WhatsAppSessionStatus.PENDING_QR:
      case WhatsAppSessionStatus.CONNECTING:
        return 'syncing';
      case WhatsAppSessionStatus.FAILED:
        return 'error';
      default:
        return 'disconnected';
    }
  }

  private healthFromWhatsApp(status: WhatsAppSessionStatus, failureReason?: string | null): IntegrationHealth {
    if (status === WhatsAppSessionStatus.CONNECTED) return 'healthy';
    if (status === WhatsAppSessionStatus.PENDING_QR || status === WhatsAppSessionStatus.CONNECTING) return 'degraded';
    if (failureReason) return 'unhealthy';
    return 'unknown';
  }

  private mapTelegramUserStatus(status: string, live: boolean): IntegrationConnectionStatus {
    if (status === 'CONNECTED') return live ? 'connected' : 'reconnect_required';
    if (status === 'EXPIRED') return 'expired';
    if (status === 'CONNECTING') return 'syncing';
    if (status === 'FAILED') return 'error';
    return 'disconnected';
  }
}
