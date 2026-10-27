export const INTEGRATION_PROVIDERS = ['whatsapp', 'tiktok'] as const;

export type IntegrationProvider = (typeof INTEGRATION_PROVIDERS)[number];

export type IntegrationConnectionStatus =
  | 'connected'
  | 'disconnected'
  | 'expired'
  | 'reconnect_required'
  | 'syncing'
  | 'error';

export type IntegrationHealth = 'healthy' | 'degraded' | 'unhealthy' | 'unknown';

export type IntegrationAccount = {
  id: string;
  name: string;
  subtitle?: string | null;
  avatarUrl?: string | null;
  phoneNumber?: string | null;
  status: IntegrationConnectionStatus;
  health: IntegrationHealth;
  lastSyncAt?: string | null;
  metadata?: Record<string, unknown>;
};

export type IntegrationProviderSummary = {
  provider: IntegrationProvider;
  name: string;
  description: string;
  status: IntegrationConnectionStatus;
  health: IntegrationHealth;
  connected: boolean;
  accountCount: number;
  connectedAccount?: string | null;
  lastSyncAt?: string | null;
  accounts: IntegrationAccount[];
  capabilities: {
    oauth: boolean;
    multiAccount: boolean;
    configured: boolean;
  };
  metadata?: Record<string, unknown>;
};

export type IntegrationsHubResponse = {
  updatedAt: string;
  providers: IntegrationProviderSummary[];
};

export type IntegrationConnectResponse = {
  action: 'redirect' | 'inline' | 'navigate';
  url?: string;
  authUrl?: string;
  flow?: string;
  message?: string;
};
