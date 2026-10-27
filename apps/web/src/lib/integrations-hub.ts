import { api } from '@/lib/utils';

export type IntegrationConnectionStatus =
  | 'connected'
  | 'disconnected'
  | 'expired'
  | 'reconnect_required'
  | 'syncing'
  | 'error';

export type IntegrationHealth = 'healthy' | 'degraded' | 'unhealthy' | 'unknown';

export type IntegrationProvider = 'whatsapp' | 'tiktok';

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

export function fetchIntegrationsHub() {
  return api<IntegrationsHubResponse>('/integrations');
}

export function connectIntegration(provider: IntegrationProvider, body?: Record<string, unknown>) {
  return api<IntegrationConnectResponse>(`/integrations/${provider}/connect`, {
    method: 'POST',
    body: JSON.stringify(body ?? {}),
  });
}

export function disconnectIntegration(provider: IntegrationProvider, body: Record<string, unknown>) {
  return api<{ disconnected: boolean }>(`/integrations/${provider}/disconnect`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function reconnectIntegration(provider: IntegrationProvider, body?: Record<string, unknown>) {
  return api<IntegrationConnectResponse>(`/integrations/${provider}/reconnect`, {
    method: 'POST',
    body: JSON.stringify(body ?? {}),
  });
}

export function formatRelativeTime(iso: string | null | undefined, locale: string): string {
  if (!iso) return '—';
  const date = new Date(iso);
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return locale === 'ar' ? 'الآن' : 'Just now';
  if (diffMin < 60) return locale === 'ar' ? `منذ ${diffMin} د` : `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return locale === 'ar' ? `منذ ${diffHr} س` : `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  return locale === 'ar' ? `منذ ${diffDay} ي` : `${diffDay}d ago`;
}
