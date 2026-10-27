import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  ChannelProvider,
  ChannelStatus,
  WhatsAppCloudAccountStatus,
  WhatsAppSessionStatus,
} from '@watsapp/database';
import { PlanEntitlementsService } from '../billing/plan-entitlements.service';
import { ConnectionsService } from './connections.service';
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

@Injectable()
export class IntegrationsHubService {
  constructor(
    private readonly connections: ConnectionsService,
    private readonly entitlements: PlanEntitlementsService,
    private readonly tiktokLogin: TikTokLoginService,
    private readonly tiktokBusiness: TikTokBusinessService,
    private readonly whatsapp: WhatsAppService,
    private readonly whatsappCloud: WhatsAppCloudService,
    private readonly prisma: PrismaService,
  ) {}

  async list(teamId: string, userId: string): Promise<IntegrationsHubResponse> {
    const [whatsappSessions, whatsappCloudAccounts, tiktokBusiness] = await Promise.all([
      this.whatsapp.list(teamId, userId),
      this.prisma.whatsAppCloudAccount.findMany({
        where: { teamId, status: WhatsAppCloudAccountStatus.CONNECTED },
        orderBy: { connectedAt: 'desc' },
      }),
      this.tiktokBusiness.getStatus(userId),
    ]);

    const providers: IntegrationProviderSummary[] = [
      this.buildWhatsAppProvider(whatsappSessions, whatsappCloudAccounts),
      this.buildTikTokProvider(tiktokBusiness),
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
    const found = hub.providers.find((p) => p.provider === provider);
    if (!found) throw new NotFoundException(`Integration provider "${provider}" not found`);
    return found;
  }

  async getStatus(teamId: string, userId: string, provider: string) {
    this.assertProvider(provider);
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

    switch (provider as IntegrationProvider) {
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

    switch (provider as IntegrationProvider) {
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

  async sync(_teamId: string, _userId: string, provider: string) {
    this.assertProvider(provider);
    throw new BadRequestException('Sync is not supported for this provider');
  }

  private assertProvider(provider: string): asserts provider is IntegrationProvider {
    if (!INTEGRATION_PROVIDERS.includes(provider as IntegrationProvider)) {
      throw new NotFoundException(`Unknown integration provider: ${provider}`);
    }
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
}
