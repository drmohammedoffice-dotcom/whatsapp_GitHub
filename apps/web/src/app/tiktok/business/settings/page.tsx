'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Loader2, RefreshCw, Share2, Unplug } from 'lucide-react';
import { TikTokBusinessShell } from '@/components/tiktok/tiktok-business-shell';
import { useTranslation } from '@/components/providers/locale-provider';
import { AlertBanner } from '@/components/shared/alert-banner';
import { PageHeader } from '@/components/shared/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { API_URL } from '@/lib/utils';
import {
  disconnectTikTokBusiness,
  fetchTikTokBusinessStatus,
  startTikTokBusinessOAuth,
  syncTikTokBusiness,
  type TikTokBusinessStatus,
} from '@/lib/tiktok-business';
import { parseApiError } from '@/lib/utils';

function SettingsInner() {
  const { t, locale } = useTranslation();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<TikTokBusinessStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const callbackUrl = `${API_URL}/api/auth/tiktok-business/callback`;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setStatus(await fetchTikTokBusinessStatus());
    } catch (err) {
      setError(parseApiError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load().catch(console.error);
    if (searchParams.get('connected') === 'true' || searchParams.get('connected') === '1') {
      setNotice(t('tiktokBusiness.connectedSuccess'));
    }
  }, [load, searchParams, t]);

  async function connect() {
    setBusy(true);
    try {
      window.location.href = await startTikTokBusinessOAuth();
    } catch (err) {
      setError(parseApiError(err));
      setBusy(false);
    }
  }

  async function sync() {
    setBusy(true);
    try {
      await syncTikTokBusiness();
      await load();
      setNotice(t('tiktokBusiness.syncSuccess'));
    } catch (err) {
      setError(parseApiError(err));
    } finally {
      setBusy(false);
    }
  }

  async function disconnect() {
    setBusy(true);
    try {
      await disconnectTikTokBusiness();
      await load();
      setNotice(t('tiktokBusiness.disconnected'));
    } catch (err) {
      setError(parseApiError(err));
    } finally {
      setBusy(false);
    }
  }

  const connected = status?.marketingConnected ?? false;

  return (
    <TikTokBusinessShell>
      <PageHeader title={t('tiktokBusiness.nav.settings')} description={t('tiktokBusiness.settingsDesc')} />
      {notice && <AlertBanner className="mt-4" variant="success">{notice}</AlertBanner>}
      {error && <AlertBanner className="mt-4" variant="error">{error}</AlertBanner>}

      <Card className="mt-4 border-0 shadow-card">
        <CardHeader>
          <CardTitle>{t('tiktokBusiness.connectionStatus')}</CardTitle>
          <CardDescription>
            {connected ? t('tiktokBusiness.connected') : t('tiktokBusiness.notConnected')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t('common.loading')}
            </div>
          ) : (
            <>
              <Badge variant={connected ? 'success' : 'secondary'}>
                {connected ? t('tiktokBusiness.marketingConnected') : t('tiktokBusiness.marketingNotConnected')}
              </Badge>

              {!status?.marketingApiConfigured && (
                <AlertBanner variant="warning">{t('tiktokBusiness.marketingNotConfigured')}</AlertBanner>
              )}

              {status?.syncMessage && (
                <AlertBanner variant="warning">{status.syncMessage}</AlertBanner>
              )}

              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <p className="text-xs text-muted-foreground">{t('tiktokBusiness.businessCenter')}</p>
                  <p className="font-medium">{status?.businessCenter?.name ?? t('tiktokBusiness.noBusinessCenter')}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{t('tiktokBusiness.lastSync')}</p>
                  <p className="font-medium">
                    {status?.lastSyncAt
                      ? new Date(status.lastSyncAt).toLocaleString(locale === 'ar' ? 'ar-SA' : 'en-US')
                      : t('tiktokBusiness.neverSynced')}
                  </p>
                </div>
                {status?.marketingExpiresAt && (
                  <div>
                    <p className="text-xs text-muted-foreground">{t('tiktokBusiness.tokenExpires')}</p>
                    <p className="font-medium">
                      {new Date(status.marketingExpiresAt).toLocaleString(locale === 'ar' ? 'ar-SA' : 'en-US')}
                    </p>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                {!connected ? (
                  <Button onClick={connect} disabled={busy}>
                    <Share2 className="me-2 h-4 w-4" />
                    {t('tiktokBusiness.connect')}
                  </Button>
                ) : (
                  <>
                    <Button variant="outline" onClick={sync} disabled={busy}>
                      <RefreshCw className="me-2 h-4 w-4" />
                      {t('tiktokBusiness.sync')}
                    </Button>
                    <Button variant="destructive" onClick={disconnect} disabled={busy}>
                      <Unplug className="me-2 h-4 w-4" />
                      {t('tiktokBusiness.disconnect')}
                    </Button>
                  </>
                )}
                <Button variant="ghost" asChild>
                  <Link href="/settings/integrations">{t('tiktokBusiness.goToIntegrations')}</Link>
                </Button>
              </div>

              <div className="rounded-lg border bg-muted/30 p-3">
                <p className="text-xs font-medium">{t('tiktokBusiness.redirectUriHint')}</p>
                <code className="mt-1 block break-all text-xs">{callbackUrl}</code>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </TikTokBusinessShell>
  );
}

export default function TikTokBusinessSettingsPage() {
  return (
    <Suspense fallback={null}>
      <SettingsInner />
    </Suspense>
  );
}
