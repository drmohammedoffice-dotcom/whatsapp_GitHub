'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ExternalLink, Loader2, RefreshCw, Smartphone } from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { AlertBanner } from '@/components/shared/alert-banner';
import { PageHeader } from '@/components/shared/page-header';
import { useTranslation } from '@/components/providers/locale-provider';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  cancelTikTokAdsBalanceCheckout,
  fetchTikTokAdsBalanceAdvertisers,
  fetchTikTokAdsBalanceCheckouts,
  markTikTokAdsBalanceReturned,
  refreshTikTokAdsBalanceCheckout,
  startTikTokAdsBalanceCheckout,
  type TikTokAdsBalanceCheckout,
} from '@/lib/tiktok-business';
import { parseApiError } from '@/lib/utils';

const ALLOWED_HOSTS = new Set(['ads.tiktok.com', 'business.tiktok.com']);
const RETURN_SESSION_KEY = 'chatlooraTikTokBalanceCheckoutId';

function isSafeTikTokUrl(raw: string) {
  try {
    const url = new URL(raw);
    return url.protocol === 'https:' && ALLOWED_HOSTS.has(url.hostname.toLowerCase());
  } catch {
    return false;
  }
}

function isMobileClient() {
  if (typeof window === 'undefined') return false;
  return /Android|iPhone|iPad|iPod|Mobile|webOS|BlackBerry/i.test(navigator.userAgent)
    || window.matchMedia('(max-width: 768px)').matches;
}

function statusVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (status === 'CONFIRMED') return 'default';
  if (status === 'FAILED' || status === 'CANCELLED') return 'destructive';
  if (status === 'PENDING_CONFIRMATION' || status === 'EXTERNAL_CHECKOUT') return 'secondary';
  return 'outline';
}

export default function TikTokAdsBalancePage() {
  const { t, locale } = useTranslation();
  const [advertisers, setAdvertisers] = useState<
    Array<{ advertiserId: string; name: string | null; currency: string | null; status: string | null; linked: boolean }>
  >([]);
  const [connected, setConnected] = useState<boolean | null>(null);
  const [query, setQuery] = useState('');
  const [advertiserId, setAdvertiserId] = useState('');
  const [checkouts, setCheckouts] = useState<TikTokAdsBalanceCheckout[]>([]);
  const [selected, setSelected] = useState<TikTokAdsBalanceCheckout | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [phase, setPhase] = useState<'idle' | 'preparing' | 'opening' | 'waiting'>('idle');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [accounts, history] = await Promise.all([
        fetchTikTokAdsBalanceAdvertisers(),
        fetchTikTokAdsBalanceCheckouts().catch(() => ({ checkouts: [] as TikTokAdsBalanceCheckout[] })),
      ]);
      setConnected(accounts.connected);
      setAdvertisers(accounts.advertisers);
      setCheckouts(history.checkouts);
      if (!advertiserId && accounts.advertisers[0]) {
        setAdvertiserId(accounts.advertisers[0].advertiserId);
      }
      const pendingId =
        typeof window !== 'undefined' ? window.sessionStorage.getItem(RETURN_SESSION_KEY) : null;
      if (pendingId) {
        const found = history.checkouts.find((c) => c.id === pendingId);
        if (found) setSelected(found);
      }
    } catch (err) {
      setError(parseApiError(err));
      setConnected(false);
    } finally {
      setLoading(false);
    }
  }, [advertiserId]);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initial load only
  }, []);

  useEffect(() => {
    function onVisible() {
      if (document.visibilityState !== 'visible') return;
      const pendingId = window.sessionStorage.getItem(RETURN_SESSION_KEY);
      if (!pendingId) return;
      void markTikTokAdsBalanceReturned(pendingId)
        .then((updated) => {
          setSelected(updated);
          setCheckouts((rows) => rows.map((r) => (r.id === updated.id ? updated : r)));
          setNotice(t('tiktokAdsBalance.returnUnverified'));
          setPhase('idle');
        })
        .catch(() => undefined);
    }
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [t]);

  const filtered = useMemo(() => {
    const text = query.trim().toLowerCase();
    return advertisers.filter(
      (row) =>
        !text ||
        (row.name ?? '').toLowerCase().includes(text) ||
        row.advertiserId.includes(text),
    );
  }, [advertisers, query]);

  function statusLabel(status: string) {
    const key = `tiktokAdsBalance.status.${status}` as const;
    const translated = t(key);
    return translated === key ? status : translated;
  }

  async function startTopUp() {
    if (!advertiserId) {
      setError(t('tiktokAdsBalance.selectAccountFirst'));
      return;
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    setPhase('preparing');
    try {
      const checkout = await startTikTokAdsBalanceCheckout(advertiserId);
      if (!isSafeTikTokUrl(checkout.destinationUrl)) {
        setPhase('idle');
        setError(t('tiktokAdsBalance.unsafeUrl'));
        return;
      }
      setSelected(checkout);
      setCheckouts((rows) => [checkout, ...rows.filter((r) => r.id !== checkout.id)]);
      window.sessionStorage.setItem(RETURN_SESSION_KEY, checkout.id);
      setPhase('opening');
      setNotice(
        isMobileClient()
          ? t('tiktokAdsBalance.mobileRedirectNotice')
          : t('tiktokAdsBalance.redirectNotice'),
      );
      // Mobile: same-tab navigation (popup blockers / split apps). Desktop: new tab.
      if (isMobileClient()) {
        window.location.assign(checkout.destinationUrl);
        return;
      }
      window.open(checkout.destinationUrl, '_blank', 'noopener,noreferrer');
      setPhase('waiting');
    } catch (err) {
      setPhase('idle');
      setError(parseApiError(err));
    } finally {
      setBusy(false);
    }
  }

  async function onReturned(id: string) {
    setBusy(true);
    setError(null);
    try {
      const updated = await markTikTokAdsBalanceReturned(id);
      setSelected(updated);
      setCheckouts((rows) => rows.map((r) => (r.id === updated.id ? updated : r)));
      window.sessionStorage.removeItem(RETURN_SESSION_KEY);
      setNotice(t('tiktokAdsBalance.returnUnverified'));
      setPhase('idle');
    } catch (err) {
      setError(parseApiError(err));
    } finally {
      setBusy(false);
    }
  }

  async function onRefresh(id: string) {
    setBusy(true);
    setError(null);
    try {
      const updated = await refreshTikTokAdsBalanceCheckout(id);
      setSelected(updated);
      setCheckouts((rows) => rows.map((r) => (r.id === updated.id ? updated : r)));
      setNotice(t('tiktokAdsBalance.balanceSnapshotHint'));
    } catch (err) {
      setError(parseApiError(err));
    } finally {
      setBusy(false);
    }
  }

  async function onCancel(id: string) {
    setBusy(true);
    setError(null);
    try {
      const updated = await cancelTikTokAdsBalanceCheckout(id);
      setSelected(updated);
      setCheckouts((rows) => rows.map((r) => (r.id === updated.id ? updated : r)));
      window.sessionStorage.removeItem(RETURN_SESSION_KEY);
      setPhase('idle');
    } catch (err) {
      setError(parseApiError(err));
    } finally {
      setBusy(false);
    }
  }

  const dateFmt = useMemo(
    () =>
      new Intl.DateTimeFormat(locale === 'ar' ? 'ar-IQ' : 'en-US', {
        dateStyle: 'medium',
        timeStyle: 'short',
      }),
    [locale],
  );

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-3xl space-y-4 pb-28 sm:pb-8">
        <PageHeader
          title={t('tiktokAdsBalance.title')}
          description={t('tiktokAdsBalance.description')}
          actions={
            <Button type="button" variant="outline" size="sm" onClick={() => void load()} disabled={loading || busy}>
              <RefreshCw className={`me-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              {t('tiktokAdsBalance.refreshAccounts')}
            </Button>
          }
        />

        <AlertBanner variant="info">{t('tiktokAdsBalance.paymentOnTikTokOnly')}</AlertBanner>
        <AlertBanner variant="info">
          <span className="inline-flex items-start gap-2">
            <Smartphone className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{t('tiktokAdsBalance.mobileFriendlyHint')}</span>
          </span>
        </AlertBanner>

        {error && <AlertBanner variant="error">{error}</AlertBanner>}
        {notice && <AlertBanner variant="success">{notice}</AlertBanner>}

        {phase === 'preparing' && (
          <p className="text-sm text-muted-foreground">{t('tiktokAdsBalance.phasePreparing')}</p>
        )}
        {phase === 'opening' && (
          <p className="text-sm text-muted-foreground">{t('tiktokAdsBalance.phaseOpening')}</p>
        )}
        {phase === 'waiting' && (
          <p className="text-sm text-muted-foreground">{t('tiktokAdsBalance.phaseWaiting')}</p>
        )}

        <Card className="border-0 shadow-card">
          <CardHeader>
            <CardTitle>{t('tiktokAdsBalance.selectAccount')}</CardTitle>
            <CardDescription>{t('tiktokAdsBalance.selectAccountHint')}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            {loading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                {t('common.loading')}
              </div>
            ) : connected === false || advertisers.length === 0 ? (
              <div className="space-y-3 rounded-xl border border-dashed p-4 text-sm">
                <p>{t('tiktokAdsBalance.noAccounts')}</p>
                <Button asChild className="w-full sm:w-auto">
                  <Link href="/tiktok/business">{t('tiktokAdsBalance.goConnect')}</Link>
                </Button>
              </div>
            ) : (
              <>
                <div className="grid gap-2">
                  <Label htmlFor="ads-balance-search">{t('tiktokAdsBalance.searchAccounts')}</Label>
                  <Input
                    id="ads-balance-search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={t('tiktokAdsBalance.searchPlaceholder')}
                    className="h-12 text-base"
                  />
                  <div className="max-h-[50vh] space-y-1 overflow-auto rounded-xl border p-2 sm:max-h-64">
                    {filtered.map((row) => (
                      <label
                        key={row.advertiserId}
                        className="flex min-h-14 cursor-pointer items-start justify-between gap-3 rounded-lg px-3 py-3 text-sm hover:bg-muted active:bg-muted"
                      >
                        <span className="flex items-start gap-3">
                          <input
                            type="radio"
                            name="ads-balance-advertiser"
                            className="mt-1 h-5 w-5"
                            checked={advertiserId === row.advertiserId}
                            onChange={() => setAdvertiserId(row.advertiserId)}
                          />
                          <span>
                            <span className="block font-medium leading-snug">{row.name || row.advertiserId}</span>
                            <span className="mt-1 block text-xs text-muted-foreground" dir="ltr">
                              ID: {row.advertiserId}
                              {row.currency ? ` · ${row.currency}` : ''}
                            </span>
                          </span>
                        </span>
                        <Badge variant="secondary">{t('tiktokAdsBalance.linked')}</Badge>
                      </label>
                    ))}
                    {!filtered.length && (
                      <p className="px-2 py-4 text-center text-xs text-muted-foreground">
                        {t('tiktokAdsBalance.noSearchResults')}
                      </p>
                    )}
                  </div>
                </div>

                <div className="rounded-xl bg-muted/60 px-3 py-3 text-xs leading-5 text-muted-foreground">
                  {t('tiktokAdsBalance.amountOnTikTok')}
                </div>

                <Button
                  type="button"
                  size="lg"
                  className="hidden h-12 w-full text-base sm:inline-flex"
                  onClick={() => void startTopUp()}
                  disabled={busy || !advertiserId}
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : t('tiktokAdsBalance.goToTopUp')}
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="border-0 shadow-card">
          <CardHeader>
            <CardTitle>{t('tiktokAdsBalance.howItWorks')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <ol className="list-decimal space-y-2 ps-5">
              <li>{t('tiktokAdsBalance.step1')}</li>
              <li>{t('tiktokAdsBalance.step2')}</li>
              <li>{t('tiktokAdsBalance.step3')}</li>
              <li>{t('tiktokAdsBalance.step4')}</li>
            </ol>
            {selected && isSafeTikTokUrl(selected.destinationUrl) && (
              <div className="space-y-2 rounded-xl border p-3">
                <p className="font-medium text-foreground">{t('tiktokAdsBalance.currentSession')}</p>
                <p className="text-xs">
                  {selected.advertiserName || selected.advertiserId} · {statusLabel(selected.status)}
                </p>
                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                  <Button asChild size="lg" variant="outline" className="w-full sm:w-auto">
                    <a href={selected.destinationUrl} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="me-1 h-3.5 w-3.5" />
                      {t('tiktokAdsBalance.openAdsManager')}
                    </a>
                  </Button>
                  <Button size="lg" variant="outline" className="w-full sm:w-auto" disabled={busy} onClick={() => void onReturned(selected.id)}>
                    {t('tiktokAdsBalance.iReturned')}
                  </Button>
                  <Button size="lg" variant="outline" className="w-full sm:w-auto" disabled={busy} onClick={() => void onRefresh(selected.id)}>
                    {t('tiktokAdsBalance.refreshBalance')}
                  </Button>
                  <Button size="lg" variant="ghost" className="w-full sm:w-auto" disabled={busy} onClick={() => void onCancel(selected.id)}>
                    {t('tiktokAdsBalance.cancel')}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-0 shadow-card">
          <CardHeader>
            <CardTitle>{t('tiktokAdsBalance.historyTitle')}</CardTitle>
            <CardDescription>{t('tiktokAdsBalance.historyDesc')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {!checkouts.length && (
              <p className="py-6 text-center text-sm text-muted-foreground">{t('tiktokAdsBalance.noHistory')}</p>
            )}
            {checkouts.map((row) => (
              <div key={row.id} className="rounded-2xl border p-3 text-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{row.advertiserName || row.advertiserId}</p>
                    <p className="text-xs text-muted-foreground" dir="ltr">
                      ID: {row.advertiserId}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">{dateFmt.format(new Date(row.createdAt))}</p>
                  </div>
                  <Badge variant={statusVariant(row.status)}>{statusLabel(row.status)}</Badge>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  {row.paymentVerified
                    ? t('tiktokAdsBalance.verified')
                    : t('tiktokAdsBalance.notAutoVerified')}
                  {row.currency ? ` · ${row.currency}` : ''}
                  {row.balanceBefore != null ? ` · ${t('tiktokAdsBalance.balanceBefore')}: ${row.balanceBefore}` : ''}
                  {row.balanceAfter != null ? ` · ${t('tiktokAdsBalance.balanceAfter')}: ${row.balanceAfter}` : ''}
                </p>
                <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                  {isSafeTikTokUrl(row.destinationUrl) && (
                    <Button asChild size="sm" variant="outline" className="w-full sm:w-auto">
                      <a href={row.destinationUrl} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="me-1 h-3.5 w-3.5" />
                        {t('tiktokAdsBalance.openAdsManager')}
                      </a>
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" className="w-full sm:w-auto" onClick={() => setSelected(row)}>
                    {t('tiktokAdsBalance.viewDetails')}
                  </Button>
                  <Button size="sm" variant="ghost" className="w-full sm:w-auto" disabled={busy} onClick={() => void onRefresh(row.id)}>
                    {t('tiktokAdsBalance.refreshBalance')}
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Sticky mobile CTA */}
      {connected && advertisers.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 p-3 backdrop-blur sm:hidden">
          <Button
            type="button"
            size="lg"
            className="h-12 w-full text-base"
            onClick={() => void startTopUp()}
            disabled={busy || !advertiserId}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : t('tiktokAdsBalance.goToTopUp')}
          </Button>
        </div>
      )}
    </AppShell>
  );
}
