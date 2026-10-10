'use client';

import { ArrowRight, Inbox } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { AppShell } from '@/components/layout/app-shell';
import { ConnectionCard, type ConnectionRow } from '@/components/integrations/connection-card';
import { TelegramUserConnect } from '@/components/integrations/telegram-user-connect';
import { useTranslation } from '@/components/providers/locale-provider';
import { AlertBanner } from '@/components/shared/alert-banner';
import { LoadingBlock } from '@/components/shared/loading-block';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { ChannelDefinition } from '@/lib/channels';
import { api, cn, parseApiError } from '@/lib/utils';

type TelegramConnection = {
  id: string;
  channelId: string | null;
  phoneNumber: string;
  firstName?: string;
  lastName?: string;
  username?: string;
  status: string;
  connectedAt?: string;
  lastSyncAt?: string;
  live?: boolean;
};

type ChannelConnectPageProps = {
  channel: ChannelDefinition;
  kind: 'telegram';
};

export function ChannelConnectPage({ channel, kind }: ChannelConnectPageProps) {
  const { t, dir } = useTranslation();
  const ChannelIcon = channel.icon;
  const [connections, setConnections] = useState<TelegramConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api<{ connections: TelegramConnection[] }>('/telegram-user/status');
      setConnections(data.connections);
    } catch (err) {
      setError(parseApiError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load().catch(console.error); }, [load]);

  const connectionRows: ConnectionRow[] = connections
    .filter((c) => c.status === 'CONNECTED')
    .map((c) => ({
    id: c.channelId ?? c.id,
    provider: 'TELEGRAM_USER',
    name: [c.firstName, c.lastName].filter(Boolean).join(' ') || c.username || c.phoneNumber,
    status: c.status,
    health: c.status === 'CONNECTED' ? (c.live ? 'connected' : 'reconnect_required') : c.status === 'EXPIRED' ? 'expired' : 'disconnected',
    metadata: {
      botUsername: c.username,
      pageId: c.phoneNumber,
    },
  }));

  async function disconnect(channelOrConnectionId: string) {
    setBusy(true);
    try {
      const conn = connections.find((c) => c.channelId === channelOrConnectionId || c.id === channelOrConnectionId);
      if (!conn) return;
      await api('/telegram-user/disconnect', {
        method: 'POST',
        body: JSON.stringify({ connectionId: conn.id }),
      });
      await load();
      setSuccess(t('settings.disconnectChannel'));
    } catch (err) {
      setError(parseApiError(err));
    } finally {
      setBusy(false);
    }
  }

  async function syncChats(channelOrConnectionId: string) {
    setBusy(true);
    try {
      const conn = connections.find((c) => c.channelId === channelOrConnectionId || c.id === channelOrConnectionId);
      if (!conn) return;
      await api('/telegram-user/sync', {
        method: 'POST',
        body: JSON.stringify({ connectionId: conn.id }),
      });
      setSuccess('Chats synced');
      await load();
    } catch (err) {
      setError(parseApiError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell>
      <PageHeader
        title={t(channel.navConnectKey)}
        description={t('integrations.telegramUserDesc')}
        actions={(
          <Button variant="outline" asChild>
            <Link href={channel.inboxHref}>
              <Inbox className="me-2 h-4 w-4" />
              {t('channels.openInbox')}
            </Link>
          </Button>
        )}
      />

      {error && <AlertBanner className="mt-4" message={error} onDismiss={() => setError(null)} />}
      {success && <AlertBanner className="mt-4" variant="success" message={success} onDismiss={() => setSuccess(null)} />}

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div>
          {loading ? (
            <LoadingBlock />
          ) : (
            <ConnectionCard
              title={t('channels.connection')}
              description={t('integrations.telegramUserDesc')}
              connections={connectionRows}
              onRefresh={load}
              onDisconnect={disconnect}
              connectSlot={(
                <TelegramUserConnect
                  onConnected={() => {
                    load().catch(console.error);
                    setSuccess(t('settings.connectChannel'));
                  }}
                  onError={setError}
                />
              )}
              busy={busy}
            />
          )}
          {connectionRows.length > 0 && (
            <Button
              className="mt-3"
              variant="secondary"
              disabled={busy}
              onClick={() => syncChats(connectionRows[0]!.id).catch(console.error)}
            >
              Sync chats
            </Button>
          )}
        </div>

        <Card className="border-0 shadow-card">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <ChannelIcon className="h-5 w-5" />
              </div>
              <div>
                <CardTitle>{t('channels.howItWorks')}</CardTitle>
                <CardDescription>{t('channels.howItWorksDesc')}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <p>{t('integrations.telegramUserStep1')}</p>
            <p>{t('integrations.telegramUserStep2')}</p>
            <p>{t('channels.stepAi')}</p>
            <Button asChild>
              <Link href={channel.inboxHref}>
                {t('channels.openInbox')}
                <ArrowRight className={cn('ms-2 h-4 w-4', dir === 'rtl' && 'rotate-180')} />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
