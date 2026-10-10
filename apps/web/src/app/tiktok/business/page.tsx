'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Loader2, RefreshCw, Share2, Target } from 'lucide-react';
import { TikTokBusinessShell } from '@/components/tiktok/tiktok-business-shell';
import { useTranslation } from '@/components/providers/locale-provider';
import { AlertBanner } from '@/components/shared/alert-banner';
import { PageHeader } from '@/components/shared/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  fetchTikTokBusinessAnalytics,
  fetchTikTokBusinessStatus,
  startTikTokBusinessOAuth,
  syncTikTokBusiness,
  type TikTokBusinessAnalytics,
  type TikTokBusinessStatus,
} from '@/lib/tiktok-business';
import { parseApiError } from '@/lib/utils';

function fmtMoney(value: number, locale: string) {
  return new Intl.NumberFormat(locale === 'ar' ? 'ar-SA' : 'en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(value);
}

function fmtNum(value: number, locale: string) {
  return new Intl.NumberFormat(locale === 'ar' ? 'ar-SA' : 'en-US').format(value);
}

function DashboardInner() {
  const { t, locale } = useTranslation();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<TikTokBusinessStatus | null>(null);
  const [analytics, setAnalytics] = useState<TikTokBusinessAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [statusData, analyticsData] = await Promise.all([
        fetchTikTokBusinessStatus(),
        fetchTikTokBusinessAnalytics().catch(() => null),
      ]);
      setStatus(statusData);
      setAnalytics(analyticsData);
    } catch (err) {
      setError(parseApiError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load().catch(console.error);
    if (searchParams.get('connected') === '1' || searchParams.get('connected') === 'true') {
      setNotice(t('tiktokBusiness.connectedSuccess'));
    }
    const callbackError = searchParams.get('error');
    if (callbackError) setError(decodeURIComponent(callbackError));
  }, [load, searchParams, t]);

  async function connect() {
    setBusy(true);
    setError(null);
    try {
      window.location.href = await startTikTokBusinessOAuth({ returnTo: '/tiktok/business' });
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

  const connected = status?.marketingConnected ?? false;

  return (
    <TikTokBusinessShell>
      <PageHeader title={t('tiktokBusiness.nav.dashboard')} description={t('tiktokBusiness.description')} />
      {notice && <AlertBanner className="mt-4" variant="success">{notice}</AlertBanner>}
      {error && <AlertBanner className="mt-4" variant="error">{error}</AlertBanner>}

      <Card className="mt-4 border-primary/20 bg-primary/5 border-0 shadow-card">
        <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <Target className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <div>
              <p className="font-semibold">{t('tiktokBusiness.pixelWizardLink')}</p>
              <p className="text-sm text-muted-foreground">{t('tiktokBusiness.pixelWizardDesc')}</p>
            </div>
          </div>
          <Button asChild>
            <Link href="/tiktok/integration/wizard">{t('tiktokBusiness.openPixelWizard')}</Link>
          </Button>
        </CardContent>
      </Card>

      <div className="mt-4 flex flex-wrap gap-2">
        {!connected ? (
          <Button onClick={connect} disabled={busy}>
            <Share2 className="me-2 h-4 w-4" />
            {t('tiktokBusiness.connect')}
          </Button>
        ) : (
          <Button variant="outline" onClick={sync} disabled={busy}>
            <RefreshCw className="me-2 h-4 w-4" />
            {t('tiktokBusiness.sync')}
          </Button>
        )}
      </div>

      {loading ? (
        <div className="mt-8 flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t('common.loading')}
        </div>
      ) : (
        <>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="border-0 shadow-card">
              <CardHeader className="pb-2">
                <CardDescription>{t('tiktokBusiness.metrics.spend')}</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold">{fmtMoney(analytics?.totals.spend ?? 0, locale)}</p>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-card">
              <CardHeader className="pb-2">
                <CardDescription>{t('tiktokBusiness.metrics.impressions')}</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold">{fmtNum(analytics?.totals.impressions ?? 0, locale)}</p>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-card">
              <CardHeader className="pb-2">
                <CardDescription>{t('tiktokBusiness.metrics.clicks')}</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold">{fmtNum(analytics?.totals.clicks ?? 0, locale)}</p>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-card">
              <CardHeader className="pb-2">
                <CardDescription>{t('tiktokBusiness.metrics.conversions')}</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold">{fmtNum(analytics?.totals.conversions ?? 0, locale)}</p>
              </CardContent>
            </Card>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <Card className="border-0 shadow-card">
              <CardHeader>
                <CardTitle>{t('tiktokBusiness.connectionStatus')}</CardTitle>
                <CardDescription>
                  {connected ? t('tiktokBusiness.connected') : t('tiktokBusiness.notConnected')}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Badge variant={connected ? 'success' : 'secondary'}>
                  {connected ? t('tiktokBusiness.connected') : t('tiktokBusiness.notConnected')}
                </Badge>
                <div>
                  <p className="text-xs text-muted-foreground">{t('tiktokBusiness.businessCenter')}</p>
                  <p className="font-medium">{status?.businessCenter?.name ?? '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{t('tiktokBusiness.lastSync')}</p>
                  <p className="font-medium">
                    {status?.lastSyncAt
                      ? new Date(status.lastSyncAt).toLocaleString(locale === 'ar' ? 'ar-SA' : 'en-US')
                      : t('tiktokBusiness.neverSynced')}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-card">
              <CardHeader>
                <CardTitle>{t('tiktokBusiness.countsTitle')}</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-3">
                {[
                  { label: t('tiktokBusiness.nav.advertisers'), value: analytics?.counts.advertisers ?? 0 },
                  { label: t('tiktokBusiness.nav.campaigns'), value: analytics?.counts.campaigns ?? 0 },
                  { label: t('tiktokBusiness.nav.adgroups'), value: analytics?.counts.adgroups ?? 0 },
                  { label: t('tiktokBusiness.nav.ads'), value: analytics?.counts.ads ?? 0 },
                ].map((item) => (
                  <div key={item.label}>
                    <p className="text-xs text-muted-foreground">{item.label}</p>
                    <p className="text-xl font-semibold">{fmtNum(item.value, locale)}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </TikTokBusinessShell>
  );
}

export default function TikTokBusinessDashboardPage() {
  return (
    <Suspense fallback={null}>
      <DashboardInner />
    </Suspense>
  );
}
