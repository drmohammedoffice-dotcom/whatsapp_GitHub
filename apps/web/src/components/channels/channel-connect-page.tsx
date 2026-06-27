'use client';

import { ArrowRight, Inbox } from 'lucide-react';
import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { AppShell } from '@/components/layout/app-shell';
import { useTranslation } from '@/components/providers/locale-provider';
import { AlertBanner } from '@/components/shared/alert-banner';
import { LoadingBlock } from '@/components/shared/loading-block';
import { PageHeader } from '@/components/shared/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import type { ChannelDefinition } from '@/lib/channels';
import { api, cn, parseApiError } from '@/lib/utils';

type ChannelRow = {
  id: string;
  name: string;
  provider: string;
  status: string;
  connected?: boolean;
  hasCredentials?: boolean;
  metadata?: { pageId?: string; botUsername?: string };
};

type ChannelConnectPageProps = {
  channel: ChannelDefinition;
  kind: 'meta' | 'telegram';
  metaProvider?: 'META_MESSENGER' | 'META_INSTAGRAM';
};

export function ChannelConnectPage({ channel, kind, metaProvider }: ChannelConnectPageProps) {
  const { t, dir } = useTranslation();
  const ChannelIcon = channel.icon;
  const [channels, setChannels] = useState<ChannelRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const provider = kind === 'telegram' ? 'TELEGRAM' : metaProvider!;
  const connected = channels.filter((c) => c.provider === provider);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await api<ChannelRow[]>('/channels');
      setChannels(rows);
    } catch (err) {
      setError(parseApiError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load().catch(console.error); }, [load]);

  async function runForm(task: () => Promise<void>) {
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      await task();
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
        description={t(channel.navConnectDescKey)}
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
        <Card className="border-0 shadow-card">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <ChannelIcon className="h-5 w-5" />
              </div>
              <div>
                <CardTitle>{t('channels.connection')}</CardTitle>
                <CardDescription>{t('channels.connectionDesc')}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <LoadingBlock />
            ) : connected.length > 0 ? (
              <div className="space-y-3">
                <Badge variant="success">{t('channels.connected')}</Badge>
                {connected.map((row) => (
                  <div key={row.id} className="rounded-lg border bg-muted/20 p-4">
                    <p className="font-medium">{row.name}</p>
                    <p className="text-sm text-muted-foreground">{row.status}</p>
                    {row.metadata?.pageId && (
                      <p className="mt-1 text-xs text-muted-foreground">Page ID: {row.metadata.pageId}</p>
                    )}
                    {row.metadata?.botUsername && (
                      <p className="mt-1 text-xs text-muted-foreground">@{row.metadata.botUsername}</p>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-3"
                      disabled={busy}
                      onClick={() => runForm(async () => {
                        const path = kind === 'telegram' ? '/telegram/disconnect' : '/meta/disconnect';
                        await api(path, { method: 'POST', body: JSON.stringify({ channelId: row.id }) });
                        await load();
                        setSuccess(t('settings.disconnectChannel'));
                      })}
                    >
                      {t('settings.disconnectChannel')}
                    </Button>
                  </div>
                ))}
                <Button asChild>
                  <Link href={channel.inboxHref}>
                    {t('channels.openInbox')}
                    <ArrowRight className={cn('ms-2 h-4 w-4', dir === 'rtl' && 'rotate-180')} />
                  </Link>
                </Button>
              </div>
            ) : (
              <form
                className="space-y-3"
                onSubmit={(event: FormEvent<HTMLFormElement>) => {
                  event.preventDefault();
                  const form = new FormData(event.currentTarget);
                  runForm(async () => {
                    if (kind === 'telegram') {
                      await api('/telegram/connect', {
                        method: 'POST',
                        body: JSON.stringify({
                          botToken: form.get('botToken'),
                          name: form.get('name') || t(channel.navConnectKey),
                        }),
                      });
                    } else {
                      await api('/meta/connect', {
                        method: 'POST',
                        body: JSON.stringify({
                          provider: metaProvider,
                          pageId: form.get('pageId'),
                          pageAccessToken: form.get('pageAccessToken'),
                          name: form.get('name') || t(channel.navConnectKey),
                        }),
                      });
                    }
                    await load();
                    setSuccess(t('settings.connectChannel'));
                    event.currentTarget.reset();
                  }).catch(() => undefined);
                }}
              >
                <Input name="name" placeholder={t('settings.keyName')} />
                {kind === 'telegram' ? (
                  <Input name="botToken" placeholder={t('settings.botToken')} required />
                ) : (
                  <>
                    <Input name="pageId" placeholder={t('settings.pageId')} required />
                    <Input name="pageAccessToken" placeholder={t('settings.pageAccessToken')} required />
                    <p className="text-xs text-muted-foreground">{t('settings.metaWebhookHint')}</p>
                  </>
                )}
                <Button type="submit" className="w-full" disabled={busy}>
                  {t('settings.connectChannel')}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>

        <Card className="border-0 shadow-card">
          <CardHeader>
            <CardTitle>{t('channels.howItWorks')}</CardTitle>
            <CardDescription>{t('channels.howItWorksDesc')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <p>{t('channels.stepConnect')}</p>
            <p>{t('channels.stepInbox')}</p>
            <p>{t('channels.stepAi')}</p>
            <Button variant="secondary" asChild>
              <Link href={channel.inboxHref}>{t('channels.openInbox')}</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
