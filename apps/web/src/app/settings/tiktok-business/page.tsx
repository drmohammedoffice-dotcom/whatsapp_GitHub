'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Building2, Link2, RefreshCw, Share2 } from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { useTranslation } from '@/components/providers/locale-provider';
import { AlertBanner } from '@/components/shared/alert-banner';
import { PageHeader } from '@/components/shared/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { API_URL, api, cn, getAccessToken, parseApiError } from '@/lib/utils';

type TikTokBusinessStatus = {
  loginConnected: boolean;
  marketingConnected: boolean;
  marketingApiConfigured: boolean;
  hasBusinessAccess: boolean;
  businessCenter: { id: string; name: string | null } | null;
  advertisers: Array<{
    advertiserId: string;
    name: string | null;
    currency: string | null;
    status: string | null;
  }>;
  lastSyncAt: string | null;
  syncMessage: string | null;
  marketingExpiresAt: string | null;
  loginProfile: {
    openId: string;
    displayName: string | null;
    avatar: string | null;
    expiresAt: string;
  } | null;
};

function formatDate(iso: string | null, locale: string) {
  if (!iso) return null;
  return new Date(iso).toLocaleString(locale === 'ar' ? 'ar-SA' : 'en-US');
}

export default function TikTokBusinessSettingsPage() {
  return (
    <Suspense fallback={null}>
      <TikTokBusinessSettingsPageInner />
    </Suspense>
  );
}

function TikTokBusinessSettingsPageInner() {
  const { t, locale } = useTranslation();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<TikTokBusinessStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [authUrlPreview, setAuthUrlPreview] = useState<string | null>(null);

  const callbackUrl = `${API_URL}/api/auth/tiktok-business/callback`;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setStatus(await api<TikTokBusinessStatus>('/integrations/tiktok-business'));
    } catch (err) {
      setError(parseApiError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load().catch(console.error);
    if (searchParams.get('connected') === 'true' || searchParams.get('connected') === '1') {
      setNotice(t('settingsTikTokBusiness.connectedSuccess'));
    }
    const callbackError = searchParams.get('error');
    if (callbackError) {
      setError(decodeURIComponent(callbackError));
    }
  }, [load, searchParams, t]);

  async function connectTikTokBusiness() {
    setConnecting(true);
    setError(null);
    setAuthUrlPreview(null);
    try {
      const token = getAccessToken();
      if (!token) throw new Error('Not authenticated');
      const response = await fetch(`${API_URL}/api/auth/tiktok-business/login`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          returnOrigin: window.location.origin,
          returnTo: '/settings/tiktok-business',
        }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error((body as { message?: string }).message ?? 'Failed to start TikTok Business authorization');
      }
      const { authUrl } = (await response.json()) as { authUrl: string };
      setAuthUrlPreview(authUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : parseApiError(err));
    } finally {
      setConnecting(false);
    }
  }

  async function syncBusinessAccounts() {
    setSyncing(true);
    setError(null);
    setNotice(null);
    try {
      setStatus(await api<TikTokBusinessStatus>('/integrations/tiktok-business/sync', { method: 'POST', body: '{}' }));
      setNotice(t('settingsTikTokBusiness.syncSuccess'));
    } catch (err) {
      setError(parseApiError(err));
    } finally {
      setSyncing(false);
    }
  }

  const marketingConnected = status?.marketingConnected === true;
  const hasBusiness = status?.hasBusinessAccess === true;

  return (
    <AppShell>
      <PageHeader
        title={t('settingsTikTokBusiness.title')}
        description={t('settingsTikTokBusiness.description')}
      />

      <div className="mt-4 space-y-3">
        {error && <AlertBanner message={error} onDismiss={() => setError(null)} />}
        {notice && <AlertBanner variant="success" message={notice} onDismiss={() => setNotice(null)} />}
        {!loading && !status?.marketingApiConfigured && (
          <AlertBanner variant="warning" message={t('settingsTikTokBusiness.marketingNotConfigured')} />
        )}
        {!loading && !marketingConnected && status?.marketingApiConfigured && (
          <AlertBanner variant="info" message={t('settingsTikTokBusiness.authorizeHint')} />
        )}
        {!loading && marketingConnected && !hasBusiness && status?.syncMessage && (
          <AlertBanner variant="warning" message={status.syncMessage} />
        )}
        {!loading && marketingConnected && !hasBusiness && (
          <AlertBanner variant="info" message={t('settingsTikTokBusiness.noBusinessCenterHint')} />
        )}
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        {!marketingConnected && (
          <Button onClick={() => connectTikTokBusiness()} disabled={connecting || loading || !status?.marketingApiConfigured}>
            <Link2 className={cn('me-2 h-4 w-4', connecting && 'animate-pulse')} />
            {t('settingsTikTokBusiness.authorizeBusiness')}
          </Button>
        )}
        <Button variant="outline" onClick={() => load()} disabled={loading || syncing}>
          <RefreshCw className={cn('me-2 h-4 w-4', loading && 'animate-spin')} />
          {t('settingsTikTokBusiness.refresh')}
        </Button>
        <Button onClick={() => syncBusinessAccounts()} disabled={!marketingConnected || syncing || loading}>
          <Building2 className={cn('me-2 h-4 w-4', syncing && 'animate-pulse')} />
          {t('settingsTikTokBusiness.syncBusinessAccounts')}
        </Button>
      </div>

      {authUrlPreview && (
        <Card className="mt-4 border-primary/30 shadow-card">
          <CardHeader>
            <CardTitle className="text-base">{t('settingsTikTokBusiness.continueAuthorization')}</CardTitle>
            <CardDescription>{t('settingsTikTokBusiness.continueAuthorizationDesc')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground break-all">{authUrlPreview}</p>
            <Button asChild>
              <a href={authUrlPreview}>{t('settingsTikTokBusiness.openTikTokAuthorization')}</a>
            </Button>
          </CardContent>
        </Card>
      )}

      <Card className="mt-6 border-0 shadow-card">
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-black text-white">
              <Share2 className="h-5 w-5" />
            </div>
            <div>
              <CardTitle>{t('settingsTikTokBusiness.connectionStatus')}</CardTitle>
              <CardDescription>
                {marketingConnected
                  ? t('settingsTikTokBusiness.marketingConnected')
                  : t('settingsTikTokBusiness.marketingNotConnected')}
              </CardDescription>
            </div>
          </div>
          <Badge variant={marketingConnected ? 'default' : 'secondary'}>
            {marketingConnected ? t('settingsTikTokBusiness.connected') : t('settingsTikTokBusiness.notConnected')}
          </Badge>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-sm text-muted-foreground">{t('settingsTikTokBusiness.lastSync')}</p>
            <p className="font-medium">
              {formatDate(status?.lastSyncAt ?? null, locale) ?? t('settingsTikTokBusiness.neverSynced')}
            </p>
          </div>
          {status?.marketingExpiresAt && (
            <div>
              <p className="text-sm text-muted-foreground">{t('settingsTikTokBusiness.tokenExpires')}</p>
              <p className="font-medium">{formatDate(status.marketingExpiresAt, locale)}</p>
            </div>
          )}
          <div className="sm:col-span-2">
            <p className="text-sm text-muted-foreground">{t('settingsTikTokBusiness.redirectUriHint')}</p>
            <code className="mt-1 block rounded bg-muted px-2 py-1 text-xs">{callbackUrl}</code>
          </div>
          {status?.loginProfile && (
            <div>
              <p className="text-sm text-muted-foreground">{t('settingsIntegrations.tiktokId')}</p>
              <p className="font-mono text-sm">{status.loginProfile.openId}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="mt-4 border-0 shadow-card">
        <CardHeader>
          <CardTitle>{t('settingsTikTokBusiness.businessCenter')}</CardTitle>
        </CardHeader>
        <CardContent>
          {hasBusiness && status?.businessCenter ? (
            <dl className="grid gap-3 sm:grid-cols-2">
              <div>
                <dt className="text-sm text-muted-foreground">{t('settingsTikTokBusiness.businessCenterId')}</dt>
                <dd className="font-mono text-sm">{status.businessCenter.id}</dd>
              </div>
              <div>
                <dt className="text-sm text-muted-foreground">{t('settingsTikTokBusiness.businessCenterName')}</dt>
                <dd className="font-medium">{status.businessCenter.name ?? '—'}</dd>
              </div>
            </dl>
          ) : (
            <p className="text-sm text-muted-foreground">{t('settingsTikTokBusiness.noBusinessCenter')}</p>
          )}
        </CardContent>
      </Card>

      <Card className="mt-4 border-0 shadow-card">
        <CardHeader>
          <CardTitle>{t('settingsTikTokBusiness.advertiserAccounts')}</CardTitle>
        </CardHeader>
        <CardContent>
          {status?.advertisers && status.advertisers.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('settingsTikTokBusiness.advertiserName')}</TableHead>
                  <TableHead>{t('settingsTikTokBusiness.advertiserId')}</TableHead>
                  <TableHead>{t('settingsTikTokBusiness.currency')}</TableHead>
                  <TableHead>{t('settingsTikTokBusiness.status')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {status.advertisers.map((row) => (
                  <TableRow key={row.advertiserId}>
                    <TableCell className="font-medium">{row.name ?? '—'}</TableCell>
                    <TableCell className="font-mono text-sm">{row.advertiserId}</TableCell>
                    <TableCell>{row.currency ?? '—'}</TableCell>
                    <TableCell>{row.status ?? '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-muted-foreground">{t('settingsTikTokBusiness.noAdvertisers')}</p>
          )}
        </CardContent>
      </Card>
    </AppShell>
  );
}
