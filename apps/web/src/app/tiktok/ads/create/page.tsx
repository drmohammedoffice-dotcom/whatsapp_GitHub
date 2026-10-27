'use client';

import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { ChevronDown, Copy, Loader2, Pencil, Plus, RefreshCw, Search, Sparkles, Trash2, Wallet } from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { useSubscription } from '@/components/providers/subscription-provider';
import { TikTokVideoThumb } from '@/components/tiktok/video-thumb';
import { AlertBanner } from '@/components/shared/alert-banner';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  fetchTikTokBusinessAdvertisers,
  fetchTikTokCampaignPerformance,
  deleteTikTokCampaigns,
  fetchTikTokCreativePreview,
  renameTikTokCampaign,
  setTikTokAdGroupStatus,
  setTikTokCampaignStatus,
  setTikTokCampaignVideoStatus,
  updateTikTokAdBudget,
  type TikTokCampaignStat,
} from '@/lib/tiktok-business';
import { parseApiError } from '@/lib/utils';
import { useTranslation } from '@/components/providers/locale-provider';

const CampaignReviewDialog = dynamic(
  () => import('@/components/tiktok/campaign-review-dialog').then((mod) => mod.CampaignReviewDialog),
  { ssr: false },
);
const CampaignVideosPanel = dynamic(
  () => import('@/components/tiktok/campaign-videos-panel').then((mod) => mod.CampaignVideosPanel),
  { ssr: false },
);

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$',
  EUR: '€',
  IQD: 'د.ع',
  SAR: 'ر.س',
  AED: 'د.إ',
  KWD: 'د.ك',
  QAR: 'ر.ق',
  BHD: 'د.ب',
  OMR: 'ر.ع',
  EGP: 'ج.م',
  JOD: 'د.أ',
};

function campaignIsOn(status: string) {
  const value = status.toUpperCase();
  return !value.includes('DISABLE') && !value.includes('DELETE') && !value.includes('PAUSE');
}

function deliveryLabel(status: string, t: (key: string) => string) {
  const value = status.toUpperCase();
  if (!value) return '—';
  if (value.includes('DELETE')) return t('tiktokAdsCreate.deliveryUnknown');
  if (value.includes('DENY') || value.includes('REJECT') || value.includes('NOT_PASS') || value.includes('FAILED')) {
    return t('tiktokAdsCreate.deliveryNotApproved');
  }
  if (value.includes('AUDIT') || value.includes('REVIEW') || value.includes('PENDING') || value.includes('REAUDIT')) {
    return t('tiktokAdsCreate.deliveryReview');
  }
  if (value.includes('BUDGET') || value.includes('BALANCE')) return t('tiktokAdsCreate.deliveryNotDelivering');
  if (value.includes('DISABLE') || value.includes('PAUSE')) return t('tiktokAdsCreate.deliveryPaused');
  if (value.includes('ENABLE') || value.includes('DELIVERY') || value.includes('ACTIVE')) return t('tiktokAdsCreate.deliveryOn');
  return t('tiktokAdsCreate.deliveryReview');
}

function deliveryTone(status: string) {
  const value = status.toUpperCase();
  if (value.includes('ENABLE') || value.includes('DELIVERY') || value.includes('ACTIVE')) return 'text-emerald-600';
  if (value.includes('DENY') || value.includes('REJECT') || value.includes('NOT_PASS') || value.includes('FAILED') || value.includes('BUDGET') || value.includes('BALANCE')) {
    return 'text-red-600';
  }
  if (value.includes('DISABLE') || value.includes('PAUSE')) return 'text-muted-foreground';
  return 'text-amber-600';
}

function objectiveLabel(objective: string, t: (key: string) => string) {
  const key = `tiktokAdsCreate.objective${objective}`;
  const label = t(key);
  return label === key ? objective : label;
}

const ACCOUNT_KEY = 'chatloora-tiktok-selected-advertiser';

function money(value: number, currency: string | null) {
  const digits = currency === 'IQD' ? 0 : 2;
  const amount = Number(value || 0).toLocaleString('en-US', { maximumFractionDigits: digits });
  const symbol = currency ? CURRENCY_SYMBOLS[currency] ?? currency : '';
  return symbol ? `${amount}${symbol}` : amount;
}

function localIso(date: Date) {
  const copy = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return copy.toISOString().slice(0, 10);
}

function rangeFor(preset: string) {
  const end = new Date();
  const start = new Date();
  if (preset === 'today') return { start: localIso(end), end: localIso(end) };
  if (preset === '7') start.setDate(start.getDate() - 6);
  else if (preset === '30') start.setDate(start.getDate() - 29);
  else start.setDate(start.getDate() - 364);
  return { start: localIso(start), end: localIso(end) };
}

type Preview = {
  text: string;
  posterUrl: string;
  videoUrl: string;
  previewLink?: string;
  loading?: boolean;
  error?: string;
};

export default function TikTokCampaignsPage() {
  return (
    <AppShell>
      <TikTokCampaignsInner />
    </AppShell>
  );
}

function TikTokCampaignsInner() {
  const { t } = useTranslation();
  const [advertisers, setAdvertisers] = useState<Array<{ advertiserId: string; name: string | null; currency: string | null }>>([]);
  const [accountQuery, setAccountQuery] = useState('');
  const [advertiserId, setAdvertiserId] = useState('');
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const accountMenuRef = useRef<HTMLDivElement | null>(null);
  const [level, setLevel] = useState<'campaign' | 'group' | 'ad'>('campaign');
  const [preset, setPreset] = useState('30');
  const initialRange = rangeFor('30');
  const [startDate, setStartDate] = useState(initialRange.start);
  const [endDate, setEndDate] = useState(initialRange.end);
  const [stats, setStats] = useState<TikTokCampaignStat[]>([]);
  const [currency, setCurrency] = useState<string | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [budgetDrafts, setBudgetDrafts] = useState<Record<string, string>>({});
  const [pickedId, setPickedId] = useState('');
  const [preview, setPreview] = useState<Preview | null>(null);
  const [review, setReview] = useState<TikTokCampaignStat | null>(null);
  const [statusBusy, setStatusBusy] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [renamingId, setRenamingId] = useState('');
  const [renameDraft, setRenameDraft] = useState('');
  /** Keep local ENABLE/DISABLE for a while so stale TikTok reads don't flip the switch back. */
  const statusOverridesRef = useRef<Map<string, { status: string; until: number }>>(new Map());
  const statsRef = useRef<TikTokCampaignStat[]>([]);
  const { status: subscription } = useSubscription();
  const canReview = Boolean(subscription?.isActive) && Boolean(subscription?.limits?.aiCampaignReviewEnabled);

  useEffect(() => {
    statsRef.current = stats;
  }, [stats]);

  function rememberStatus(id: string, status: string, ttlMs = 120_000) {
    statusOverridesRef.current.set(id, { status, until: Date.now() + ttlMs });
  }

  function mergeCampaignRows(incoming: TikTokCampaignStat[], previous: TikTokCampaignStat[]): TikTokCampaignStat[] {
    const prevById = new Map(previous.map((row) => [row.campaignId, row]));
    const now = Date.now();
    for (const [id, override] of [...statusOverridesRef.current.entries()]) {
      if (override.until <= now) statusOverridesRef.current.delete(id);
    }
    return incoming.map((row) => {
      const prev = prevById.get(row.campaignId);
      const override = statusOverridesRef.current.get(row.campaignId);
      const status = override?.status || row.status;
      const prevVideos = prev?.videos ?? [];
      const videos = (row.videos ?? []).map((video) => {
        const prevVideo = prevVideos.find((item) => item.adId === video.adId);
        const adOverride = statusOverridesRef.current.get(video.adId);
        return {
          ...video,
          status: adOverride?.status || video.status,
          posterUrl: video.posterUrl || prevVideo?.posterUrl || '',
          videoUrl: video.videoUrl || prevVideo?.videoUrl || '',
        };
      });
      const adGroups = (row.adGroups ?? []).map((group) => {
        const groupOverride = statusOverridesRef.current.get(group.adGroupId);
        return groupOverride ? { ...group, status: groupOverride.status } : group;
      });
      return { ...row, status, videos, adGroups };
    });
  }

  async function openPreview(video: NonNullable<TikTokCampaignStat['videos']>[number]) {
    setPreview({
      text: video.text,
      posterUrl: video.posterUrl,
      videoUrl: video.videoUrl,
      loading: !video.videoUrl,
    });
    if (video.videoUrl) return;
    try {
      const fresh = await fetchTikTokCreativePreview({
        advertiserId,
        adId: video.adId,
        itemId: video.itemId,
        identityId: video.identityId,
        identityType: video.identityType,
      });
      setPreview({
        text: video.text || fresh.text,
        posterUrl: fresh.posterUrl || video.posterUrl,
        videoUrl: fresh.videoUrl,
        previewLink: fresh.previewLink,
      });
    } catch (err) {
      const embed = video.itemId ? `https://www.tiktok.com/embed/v2/${video.itemId}` : '';
      setPreview({
        text: video.text,
        posterUrl: video.posterUrl,
        videoUrl: video.videoUrl,
        previewLink: embed || undefined,
        error: embed ? undefined : parseApiError(err),
      });
    }
  }
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const saved = window.sessionStorage.getItem(ACCOUNT_KEY) || '';
    setLoadingAccounts(true);
    fetchTikTokBusinessAdvertisers()
      .then((data) => {
        setAdvertisers(data.advertisers);
        const preferred = saved && data.advertisers.some((row) => row.advertiserId === saved)
          ? saved
          : data.advertisers[0]?.advertiserId || '';
        if (preferred) {
          setAdvertiserId(preferred);
          window.sessionStorage.setItem(ACCOUNT_KEY, preferred);
        }
      })
      .catch((err) => setError(parseApiError(err)))
      .finally(() => setLoadingAccounts(false));
  }, []);

  useEffect(() => {
    if (!accountMenuOpen) return;
    function onPointer(event: MouseEvent) {
      if (!accountMenuRef.current?.contains(event.target as Node)) setAccountMenuOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setAccountMenuOpen(false);
    }
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [accountMenuOpen]);

  function refreshAdvertisers() {
    setLoadingAccounts(true);
    fetchTikTokBusinessAdvertisers()
      .then((data) => {
        setAdvertisers(data.advertisers);
        if (advertiserId && !data.advertisers.some((row) => row.advertiserId === advertiserId)) {
          const next = data.advertisers[0]?.advertiserId || '';
          setAdvertiserId(next);
          if (next) window.sessionStorage.setItem(ACCOUNT_KEY, next);
          else window.sessionStorage.removeItem(ACCOUNT_KEY);
        }
      })
      .catch((err) => setError(parseApiError(err)))
      .finally(() => setLoadingAccounts(false));
  }

  async function loadPerformance(opts?: { silent?: boolean }) {
    if (!advertiserId) return;
    const silent = Boolean(opts?.silent);
    if (!silent) setLoadingStats(true);
    try {
      const data = await fetchTikTokCampaignPerformance(advertiserId, startDate, endDate);
      setStats((current) => mergeCampaignRows(data.campaigns, current.length ? current : statsRef.current));
      setCurrency(data.currency || advertisers.find((row) => row.advertiserId === advertiserId)?.currency || null);
    } catch (err) {
      if (!silent) setError(parseApiError(err));
    } finally {
      if (!silent) setLoadingStats(false);
    }
  }

  useEffect(() => {
    if (!advertiserId) return;
    setSelectedIds([]);
    setRenamingId('');
    void loadPerformance();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload when account/date changes
  }, [advertiserId, startDate, endDate]);

  // مزامنة لحظية لحالة التشغيل مع تيك توك (عند التركيز + كل 20 ثانية)
  useEffect(() => {
    if (!advertiserId) return;
    const sync = () => {
      if (document.visibilityState === 'hidden') return;
      if (statusBusy) return;
      void loadPerformance({ silent: true });
    };
    const timer = window.setInterval(sync, 60000);
    window.addEventListener('focus', sync);
    document.addEventListener('visibilitychange', sync);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', sync);
      document.removeEventListener('visibilitychange', sync);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [advertiserId, startDate, endDate, statusBusy]);

  const filtered = useMemo(() => {
    const query = accountQuery.trim().toLowerCase();
    return advertisers.filter((row) => !query || (row.name ?? '').toLowerCase().includes(query) || row.advertiserId.includes(query));
  }, [advertisers, accountQuery]);

  function chooseAccount(id: string) {
    setAdvertiserId(id);
    setLevel('campaign');
    setPickedId('');
    setAccountMenuOpen(false);
    setAccountQuery('');
    window.sessionStorage.setItem(ACCOUNT_KEY, id);
  }

  const selectedAccount = advertisers.find((row) => row.advertiserId === advertiserId) ?? null;

  const groupRows = useMemo(() => stats.flatMap((campaign) => {
    const groups = campaign.adGroups?.length
      ? campaign.adGroups
      : campaign.adGroupId
        ? [{ adGroupId: campaign.adGroupId, name: 'مجموعة إعلانية', status: campaign.status, deliveryStatus: campaign.deliveryStatus, budget: campaign.budget }]
        : [];
    return groups.map((group) => {
      const videos = (campaign.videos ?? []).filter((video) => !video.adGroupId || video.adGroupId === group.adGroupId);
      const spend = videos.reduce((sum, video) => sum + Number(video.spend || 0), 0);
      const impressions = videos.reduce((sum, video) => sum + Number(video.impressions || 0), 0);
      const clicks = videos.reduce((sum, video) => sum + Number(video.clicks || 0), 0);
      const conversions = videos.reduce((sum, video) => sum + Number(video.conversions || 0), 0);
      const costPerConversion = conversions > 0 ? spend / conversions : 0;
      return { ...group, campaignId: campaign.campaignId, campaignName: campaign.name, videos, spend, impressions, clicks, conversions, costPerConversion };
    });
  }), [stats]);

  const adRows = useMemo(() => stats.flatMap((campaign) => (campaign.videos ?? []).map((video) => ({ ...video, campaignId: campaign.campaignId, campaignName: campaign.name }))), [stats]);

  function applyPreset(next: string) {
    setPreset(next);
    const range = rangeFor(next);
    setStartDate(range.start);
    setEndDate(range.end);
  }

  async function saveBudget(row: TikTokCampaignStat) {
    const next = Number(budgetDrafts[row.campaignId] ?? row.budget);
    setBusy(true);
    setError(null);
    try {
      await updateTikTokAdBudget({ advertiserId, adGroupId: row.adGroupId, budget: next });
      setStats((current) => current.map((item) => (item.campaignId === row.campaignId ? { ...item, budget: next } : item)));
    } catch (err) {
      setError(parseApiError(err));
    } finally {
      setBusy(false);
    }
  }

  function toggleSelected(campaignId: string, checked: boolean) {
    setSelectedIds((current) => (checked ? [...new Set([...current, campaignId])] : current.filter((id) => id !== campaignId)));
  }

  async function removeCampaigns(ids: string[]) {
    if (!ids.length) return;
    const label = ids.length > 1
      ? t('tiktokAdsCreate.deleteConfirmMany').replace('{count}', String(ids.length))
      : t('tiktokAdsCreate.deleteConfirmOne');
    if (!window.confirm(label)) return;
    setBusy(true);
    setError(null);
    try {
      await deleteTikTokCampaigns({ advertiserId, campaignIds: ids });
      setStats((current) => current.filter((item) => !ids.includes(item.campaignId)));
      setSelectedIds((current) => current.filter((id) => !ids.includes(id)));
      if (ids.includes(pickedId)) setPickedId('');
    } catch (err) {
      setError(parseApiError(err));
    } finally {
      setBusy(false);
    }
  }

  async function saveName(row: TikTokCampaignStat) {
    const name = renameDraft.trim();
    if (!name) return;
    setBusy(true);
    setError(null);
    try {
      const saved = await renameTikTokCampaign({ advertiserId, campaignId: row.campaignId, name });
      setStats((current) => current.map((item) => (item.campaignId === row.campaignId ? { ...item, name: saved.name } : item)));
      setRenamingId('');
    } catch (err) {
      setError(parseApiError(err));
    } finally {
      setBusy(false);
    }
  }

  async function toggleCampaign(row: TikTokCampaignStat, enabled: boolean) {
    setStatusBusy(row.campaignId);
    setError(null);
    const previous = row.status;
    const nextStatus = enabled ? 'ENABLE' : 'DISABLE';
    rememberStatus(row.campaignId, nextStatus);
    setStats((current) => current.map((item) => (item.campaignId === row.campaignId
      ? {
          ...item,
          status: nextStatus,
          adGroups: item.adGroups?.map((group) => ({ ...group, status: nextStatus })),
          videos: item.videos?.map((video) => ({ ...video, status: nextStatus })),
        }
      : item)));
    try {
      const result = await setTikTokCampaignStatus({ advertiserId, campaignId: row.campaignId, enabled });
      const applied = result.status === 'ENABLE' || result.status === 'DISABLE' ? result.status : nextStatus;
      rememberStatus(row.campaignId, applied);
      setStats((current) => current.map((item) => (item.campaignId === row.campaignId
        ? {
            ...item,
            status: applied,
            adGroups: item.adGroups?.map((group) => ({ ...group, status: applied })),
            videos: item.videos?.map((video) => ({ ...video, status: applied })),
          }
        : item)));
      // Delayed sync only — immediate reload was flipping the switch back from stale ENABLE.
      window.setTimeout(() => {
        void loadPerformance({ silent: true });
      }, 8000);
    } catch (err) {
      statusOverridesRef.current.delete(row.campaignId);
      setStats((current) => current.map((item) => (item.campaignId === row.campaignId ? { ...item, status: previous } : item)));
      setError(parseApiError(err));
    } finally {
      setStatusBusy(null);
    }
  }

  async function toggleGroup(adGroupId: string, enabled: boolean) {
    setStatusBusy(adGroupId);
    setError(null);
    const previousByCampaign = new Map(
      stats.map((item) => [
        item.campaignId,
        item.adGroups?.find((group) => group.adGroupId === adGroupId)?.status ?? 'ENABLE',
      ]),
    );
    const nextStatus = enabled ? 'ENABLE' : 'DISABLE';
    rememberStatus(adGroupId, nextStatus);
    setStats((current) => current.map((item) => ({
      ...item,
      adGroups: item.adGroups?.map((group) => group.adGroupId === adGroupId ? { ...group, status: nextStatus } : group),
    })));
    try {
      const result = await setTikTokAdGroupStatus({ advertiserId, adGroupId, enabled });
      const applied = result.status === 'ENABLE' || result.status === 'DISABLE' ? result.status : nextStatus;
      rememberStatus(adGroupId, applied);
      setStats((current) => current.map((item) => ({
        ...item,
        adGroups: item.adGroups?.map((group) => group.adGroupId === adGroupId ? { ...group, status: applied } : group),
      })));
      window.setTimeout(() => void loadPerformance({ silent: true }), 8000);
    } catch (err) {
      statusOverridesRef.current.delete(adGroupId);
      setStats((current) => current.map((item) => ({
        ...item,
        adGroups: item.adGroups?.map((group) => (
          group.adGroupId === adGroupId
            ? { ...group, status: previousByCampaign.get(item.campaignId) || group.status }
            : group
        )),
      })));
      setError(parseApiError(err));
    } finally {
      setStatusBusy(null);
    }
  }

  async function toggleAd(adId: string, enabled: boolean) {
    setStatusBusy(adId);
    setError(null);
    const previousByCampaign = new Map(
      stats.map((item) => [
        item.campaignId,
        item.videos?.find((video) => video.adId === adId)?.status ?? 'ENABLE',
      ]),
    );
    const nextStatus = enabled ? 'ENABLE' : 'DISABLE';
    rememberStatus(adId, nextStatus);
    setStats((current) => current.map((item) => ({
      ...item,
      videos: item.videos?.map((video) => video.adId === adId ? { ...video, status: nextStatus } : video),
    })));
    try {
      const result = await setTikTokCampaignVideoStatus({ advertiserId, adId, enabled });
      const applied = result.status === 'ENABLE' || result.status === 'DISABLE' ? result.status : nextStatus;
      rememberStatus(adId, applied);
      setStats((current) => current.map((item) => ({
        ...item,
        videos: item.videos?.map((video) => video.adId === adId ? { ...video, status: applied } : video),
      })));
      window.setTimeout(() => void loadPerformance({ silent: true }), 8000);
    } catch (err) {
      statusOverridesRef.current.delete(adId);
      setStats((current) => current.map((item) => ({
        ...item,
        videos: item.videos?.map((video) => (
          video.adId === adId
            ? { ...video, status: previousByCampaign.get(item.campaignId) || video.status }
            : video
        )),
      })));
      setError(parseApiError(err));
    } finally {
      setStatusBusy(null);
    }
  }

  return (
    <>
      <PageHeader
        title={t('tiktokAdsCreate.title')}
        description={t('tiktokAdsCreate.description')}
        actions={
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center">
            <div className="relative w-full sm:w-auto" ref={accountMenuRef}>
              <button
                type="button"
                className="flex w-full min-w-0 items-center justify-between gap-2 rounded-xl border bg-background px-3 py-2 text-sm shadow-sm hover:border-primary sm:min-w-[220px] sm:max-w-[320px]"
                onClick={() => setAccountMenuOpen((open) => !open)}
              >
                <span className="truncate font-medium">{selectedAccount?.name || (loadingAccounts ? t('tiktokAdsCreate.loadingAccounts') : t('tiktokAdsCreate.selectAccount'))}</span>
                <ChevronDown className={`h-4 w-4 shrink-0 transition ${accountMenuOpen ? 'rotate-180' : ''}`} />
              </button>
              {accountMenuOpen && (
                <>
                  <button type="button" className="fixed inset-0 z-40 bg-black/20 sm:hidden" aria-label="close" onClick={() => setAccountMenuOpen(false)} />
                  <div className="fixed inset-x-3 top-[4.5rem] z-50 max-h-[min(70dvh,28rem)] overflow-auto rounded-2xl border bg-background p-3 shadow-xl sm:absolute sm:inset-x-auto sm:start-0 sm:end-auto sm:top-auto sm:mt-2 sm:w-[min(100vw-2rem,380px)] sm:max-h-96">
                    {selectedAccount && (
                      <div className="mb-3 flex items-center gap-3 rounded-xl bg-muted/50 p-3">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-teal-500 text-sm font-semibold text-white">
                          {(selectedAccount.name || 'ت').trim().slice(0, 1)}
                        </span>
                        <span className="min-w-0 flex-1 overflow-hidden">
                          <span className="block truncate text-sm font-medium">{selectedAccount.name || t('tiktokAdsCreate.advertiserAccount')}</span>
                          <span dir="ltr" className="mt-0.5 block break-all text-xs text-muted-foreground">{selectedAccount.advertiserId}</span>
                        </span>
                      </div>
                    )}
                    <div className="mb-3 flex items-center gap-2">
                      <Button type="button" size="icon" variant="outline" aria-label={t('tiktokAdsCreate.refreshAccounts')} onClick={() => refreshAdvertisers()} disabled={loadingAccounts}>
                        <RefreshCw className={`h-4 w-4 ${loadingAccounts ? 'animate-spin' : ''}`} />
                      </Button>
                      <div className="relative min-w-0 flex-1">
                        <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input className="ps-9" value={accountQuery} onChange={(event) => setAccountQuery(event.target.value)} placeholder={t('tiktokAdsCreate.searchAccountPlaceholder')} />
                      </div>
                    </div>
                    <div className="max-h-72 space-y-2 overflow-auto">
                      {filtered.map((row) => (
                        <label key={row.advertiserId} className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 text-sm hover:bg-muted/40 ${advertiserId === row.advertiserId ? 'border-primary bg-primary/5' : ''}`}>
                          <input type="radio" name="advertiser-switch" checked={advertiserId === row.advertiserId} onChange={() => chooseAccount(row.advertiserId)} />
                          <span className="min-w-0 flex-1 overflow-hidden">
                            <span className="block truncate font-medium">{row.name || t('tiktokAdsCreate.advertiserAccount')}</span>
                            <span dir="ltr" className="mt-0.5 block break-all text-[11px] leading-snug text-muted-foreground">{row.advertiserId}</span>
                          </span>
                          <span dir="ltr" className="shrink-0 text-xs text-muted-foreground">{row.currency ? CURRENCY_SYMBOLS[row.currency] ?? row.currency : ''}</span>
                        </label>
                      ))}
                      {filtered.length === 0 && <p className="py-4 text-center text-sm text-muted-foreground">{t('tiktokAdsCreate.noMatchingAccounts')}</p>}
                    </div>
                  </div>
                </>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" asChild className="flex-1 sm:flex-none">
                <Link href={`/tiktok/ads/new?advertiserId=${encodeURIComponent(advertiserId)}`}><Plus className="h-4 w-4" /> {t('tiktokAdsCreate.createCampaign')}</Link>
              </Button>
              <Button type="button" variant="outline" asChild className="flex-1 sm:flex-none">
                <Link href="/tiktok/ads/balance"><Wallet className="h-4 w-4" /> {t('tiktokAdsCreate.topup')}</Link>
              </Button>
            </div>
          </div>
        }
      />
      {error && <AlertBanner className="mt-4" variant="error">{error}</AlertBanner>}
      <Card className="mt-4 border-0 shadow-card">
        <CardHeader className="gap-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <CardTitle>{t('tiktokAdsCreate.publishedTitle')}</CardTitle>
              <CardDescription>
                {t('tiktokAdsCreate.syncHint')}
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={!advertiserId || loadingStats || Boolean(statusBusy)}
                onClick={() => void loadPerformance()}
                aria-label={t('tiktokAdsCreate.syncTikTok')}
              >
                <RefreshCw className={`h-4 w-4 ${loadingStats ? 'animate-spin' : ''}`} />
                {t('tiktokAdsCreate.syncTikTok')}
              </Button>
              {[
                ['today', t('tiktokAdsCreate.today')],
                ['7', t('tiktokAdsCreate.days7')],
                ['30', t('tiktokAdsCreate.days30')],
                ['all', t('tiktokAdsCreate.allTime')],
              ].map(([id, label]) => (
                <Button key={id} type="button" size="sm" variant={preset === id ? 'default' : 'outline'} onClick={() => applyPreset(id)}>
                  {label}
                </Button>
              ))}
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Input dir="ltr" className="text-left" type="date" value={startDate} onChange={(event) => { setPreset('custom'); setStartDate(event.target.value); }} />
            <Input dir="ltr" className="text-left" type="date" value={endDate} onChange={(event) => { setPreset('custom'); setEndDate(event.target.value); }} />
          </div>
          {selectedIds.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-muted-foreground">{t('tiktokAdsCreate.selectedCount')}: {selectedIds.length}</span>
              <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void removeCampaigns(selectedIds)}>
                <Trash2 className="h-4 w-4" /> {t('tiktokAdsCreate.deleteSelected')}
              </Button>
            </div>
          )}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm text-muted-foreground">
              {selectedAccount ? (
                <>{t('tiktokBusiness.advertiserName')}: <span className="font-medium text-foreground">{selectedAccount.name}</span></>
              ) : loadingAccounts ? t('tiktokAdsCreate.loadingAccounts') : t('tiktokAdsCreate.selectAccount')}
            </div>
            <div className="flex w-full overflow-x-auto rounded-xl border bg-muted/40 p-1 sm:w-auto">
              {([
                ['campaign', t('tiktokAdsCreate.levelCampaign')],
                ['group', t('tiktokAdsCreate.levelGroup')],
                ['ad', t('tiktokAdsCreate.levelAd')],
              ] as const).map(([id, label]) => (
                <button key={id} type="button" className={`shrink-0 rounded-lg px-3 py-1.5 text-sm ${level === id ? 'bg-background font-medium shadow-sm' : 'text-muted-foreground'}`} onClick={() => setLevel(id)}>{label}</button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {!advertiserId && <p className="py-6 text-sm text-muted-foreground">{t('tiktokAdsCreate.chooseAccountHint')}</p>}
          {advertiserId && loadingStats && <p className="mb-3 flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> {t('tiktokAdsCreate.loadingStats')}</p>}

          {/* بطاقات الهاتف */}
          {advertiserId && level === 'campaign' && (
            <div className="grid gap-3 md:hidden">
              {stats.length === 0 && !loadingStats && <p className="py-6 text-sm text-muted-foreground">{t('tiktokAdsCreate.noCampaigns')}</p>}
              {stats.map((row, index) => (
                <div key={row.campaignId} className="min-w-0 overflow-hidden rounded-xl border bg-background p-3 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">
                        <span className="me-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-violet-100 px-1.5 text-[11px] font-semibold text-violet-700">{index + 1}</span>
                        {row.name}
                      </p>
                      <p className="text-xs text-muted-foreground">{objectiveLabel(row.objective, t)}</p>
                      <p className={`mt-1 text-xs ${deliveryTone(row.deliveryStatus || row.status)}`}>{deliveryLabel(row.deliveryStatus || row.status, t)}</p>
                    </div>
                    <Switch
                      checked={campaignIsOn(row.status)}
                      disabled={statusBusy === row.campaignId}
                      onCheckedChange={(checked) => void toggleCampaign(row, checked)}
                    />
                  </div>
                  <div className="mt-3 space-y-1.5 rounded-lg bg-muted/40 px-2.5 py-2 text-xs">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-muted-foreground">{t('tiktokBusiness.metrics.spend')}</span>
                      <span dir="ltr" className="font-semibold tabular-nums">{money(row.spend, currency)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-muted-foreground">{t('tiktokBusiness.metrics.costPerResult')}</span>
                      <span dir="ltr" className="font-semibold tabular-nums">{money(row.costPerConversion || (row.conversions ? row.spend / row.conversions : 0), currency)}</span>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button type="button" size="sm" asChild>
                      <Link href={`/tiktok/ads/new?advertiserId=${encodeURIComponent(advertiserId)}&campaignId=${encodeURIComponent(row.campaignId)}`}>{t('tiktokAdsCreate.editCampaign')}</Link>
                    </Button>
                    <Button type="button" size="sm" variant="outline" onClick={() => setPickedId((current) => (current === row.campaignId ? '' : row.campaignId))}>
                      {pickedId === row.campaignId ? t('tiktokAdsCreate.hideVideos') : t('tiktokAdsCreate.showVideos')}
                    </Button>
                  </div>
                  {pickedId === row.campaignId && (
                    <div className="mt-3 min-w-0 overflow-hidden">
                      <CampaignVideosPanel
                        advertiserId={advertiserId}
                        currency={currency}
                        videos={row.videos ?? []}
                        onVideos={(videos) => setStats((current) => current.map((item) => (item.campaignId === row.campaignId ? { ...item, videos } : item)))}
                        onPreview={(video) => void openPreview(video)}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          {advertiserId && level === 'group' && (
            <div className="grid gap-3 md:hidden">
              {groupRows.length === 0 && <p className="py-6 text-sm text-muted-foreground">{t('tiktokAdsCreate.noGroups')}</p>}
              {groupRows.map((group, index) => (
                <div key={group.adGroupId} className="min-w-0 overflow-hidden rounded-xl border bg-background p-3 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">
                        <span className="me-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-violet-100 px-1.5 text-[11px] font-semibold text-violet-700">{index + 1}</span>
                        {group.name}
                      </p>
                      <p className="text-xs text-muted-foreground">{group.campaignName}</p>
                    </div>
                    <Switch checked={campaignIsOn(group.status)} disabled={statusBusy === group.adGroupId} onCheckedChange={(checked) => void toggleGroup(group.adGroupId, checked)} />
                  </div>
                  <div className="mt-3 space-y-1.5 rounded-lg bg-muted/40 px-2.5 py-2 text-xs">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-muted-foreground">{t('tiktokBusiness.metrics.spend')}</span>
                      <span dir="ltr" className="font-semibold tabular-nums">{money(group.spend, currency)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-muted-foreground">{t('tiktokBusiness.metrics.costPerResult')}</span>
                      <span dir="ltr" className="font-semibold tabular-nums">{money(group.costPerConversion || 0, currency)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          {advertiserId && level === 'ad' && (
            <div className="grid gap-3 md:hidden">
              {adRows.length === 0 && <p className="py-6 text-sm text-muted-foreground">{t('tiktokAdsCreate.noAds')}</p>}
              {adRows.map((video, index) => (
                <div key={video.adId} className="min-w-0 overflow-hidden rounded-xl border bg-background p-3 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 flex-1 items-center gap-2">
                      <button type="button" className="relative h-14 w-10 shrink-0 overflow-hidden rounded-md bg-muted" onClick={() => void openPreview(video)}>
                        <TikTokVideoThumb posterUrl={video.posterUrl} videoUrl={video.videoUrl} itemId={video.itemId} />
                      </button>
                      <div className="min-w-0">
                        <p className="truncate font-medium">
                          <span className="me-1 text-[11px] text-muted-foreground">#{index + 1}</span>
                          {video.text || t('tiktokAdsCreate.ad')}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">{video.campaignName}</p>
                      </div>
                    </div>
                    <Switch checked={campaignIsOn(video.status || 'ENABLE')} disabled={statusBusy === video.adId} onCheckedChange={(checked) => void toggleAd(video.adId, checked)} />
                  </div>
                  <div className="mt-3 space-y-1.5 rounded-lg bg-muted/40 px-2.5 py-2 text-xs">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-muted-foreground">{t('tiktokBusiness.metrics.spend')}</span>
                      <span dir="ltr" className="font-semibold tabular-nums">{money(video.spend || 0, currency)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-muted-foreground">{t('tiktokBusiness.metrics.costPerResult')}</span>
                      <span dir="ltr" className="font-semibold tabular-nums">{money(video.costPerConversion ?? (video.conversions ? (video.spend || 0) / video.conversions : 0), currency)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {advertiserId && level === 'campaign' && (
          <table className="hidden w-full text-sm md:table">
            <thead>
              <tr className="border-b text-start text-muted-foreground">
                <th className="py-2 font-medium">
                  <input
                    type="checkbox"
                    aria-label={t('tiktokAdsCreate.selectedCount')}
                    checked={stats.length > 0 && selectedIds.length === stats.length}
                    onChange={(event) => setSelectedIds(event.target.checked ? stats.map((row) => row.campaignId) : [])}
                  />
                </th>
                <th className="py-2 font-medium">{t('tiktokAdsCreate.onOff')}</th>
                <th className="py-2 font-medium">{t('tiktokAdsCreate.name')}</th>
                <th className="py-2 font-medium">{t('tiktokAdsCreate.status')}</th>
                <th className="hidden py-2 font-medium lg:table-cell">{t('tiktokAdsCreate.campaignBudget')}</th>
                <th className="py-2 font-medium">{t('tiktokBusiness.metrics.spend')}</th>
                <th className="hidden py-2 font-medium md:table-cell">{t('tiktokBusiness.metrics.costPerClick')}</th>
                <th className="hidden py-2 font-medium md:table-cell">{t('tiktokBusiness.metrics.costPerResult')}</th>
                <th className="py-2 font-medium">{t('tiktokBusiness.metrics.impressions')}</th>
              </tr>
            </thead>
            <tbody>
              {stats.length === 0 && <tr><td className="py-8 text-muted-foreground" colSpan={9}>{t('tiktokAdsCreate.noCampaigns')}</td></tr>}
              {stats.map((row, index) => (
                <Fragment key={row.campaignId}>
                <tr className="border-b">
                  <td className="py-3">
                    <input
                      type="checkbox"
                      aria-label={`تحديد ${row.name}`}
                      checked={selectedIds.includes(row.campaignId)}
                      onChange={(event) => toggleSelected(row.campaignId, event.target.checked)}
                    />
                  </td>
                  <td className="py-3">
                    <div className="flex items-center gap-2" dir="ltr">
                      <Switch
                        checked={campaignIsOn(row.status)}
                        disabled={statusBusy === row.campaignId}
                        onCheckedChange={(checked) => void toggleCampaign(row, checked)}
                        aria-label={campaignIsOn(row.status) ? t('tiktokAdsCreate.pauseCampaign') : t('tiktokAdsCreate.enableCampaign')}
                      />
                    </div>
                  </td>
                  <td className="py-3">
                    {renamingId === row.campaignId ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <Input className="h-8 min-w-0 flex-1" value={renameDraft} onChange={(event) => setRenameDraft(event.target.value)} />
                        <Button type="button" size="sm" disabled={busy} onClick={() => void saveName(row)}>{t('tiktokAdsCreate.save')}</Button>
                        <Button type="button" size="sm" variant="outline" onClick={() => setRenamingId('')}>{t('tiktokAdsCreate.cancel')}</Button>
                      </div>
                    ) : (
                      <span className="inline-flex items-center gap-2">
                        <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-violet-100 px-1.5 text-[11px] font-semibold text-violet-700">{index + 1}</span>
                        <button
                          type="button"
                          className="inline-flex h-7 w-7 items-center justify-center rounded-md border bg-background"
                          aria-label={pickedId === row.campaignId ? t('tiktokAdsCreate.hideVideos') : t('tiktokAdsCreate.showVideos')}
                          onClick={() => setPickedId((current) => (current === row.campaignId ? '' : row.campaignId))}
                        >
                          <ChevronDown className={`h-4 w-4 transition ${pickedId === row.campaignId ? 'rotate-180' : ''}`} />
                        </button>
                        <button type="button" className="text-start font-medium hover:underline" onClick={() => setPickedId((current) => (current === row.campaignId ? '' : row.campaignId))}>
                          {row.name}
                        </button>
                      </span>
                    )}
                    <div className="mt-1 text-xs text-muted-foreground">{objectiveLabel(row.objective, t)}</div>
                    {pickedId !== row.campaignId && (
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        {(row.videos ?? []).map((video, videoIndex) => (
                          <button
                            key={`${video.itemId}-${videoIndex}`}
                            type="button"
                            className="relative h-14 w-10 overflow-hidden rounded-md bg-muted"
                            onClick={() => void openPreview(video)}
                            title={video.text || t('tiktokAdsCreate.preview')}
                          >
                            <TikTokVideoThumb posterUrl={video.posterUrl} videoUrl={video.videoUrl} itemId={video.itemId} />
                          </button>
                        ))}
                      </div>
                    )}
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <Button type="button" size="sm" asChild>
                        <Link href={`/tiktok/ads/new?advertiserId=${encodeURIComponent(advertiserId)}&campaignId=${encodeURIComponent(row.campaignId)}`}>{t('tiktokAdsCreate.editCampaign')}</Link>
                      </Button>
                      <Button type="button" size="sm" variant="outline" asChild>
                        <Link href={`/tiktok/ads/new?advertiserId=${encodeURIComponent(advertiserId)}&copyFrom=${encodeURIComponent(row.campaignId)}`}>
                          <Copy className="h-4 w-4" /> {t('tiktokAdsCreate.duplicate')}
                        </Link>
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setRenamingId(row.campaignId);
                          setRenameDraft(row.name);
                        }}
                      >
                        <Pencil className="h-4 w-4" /> {t('tiktokAdsCreate.rename')}
                      </Button>
                      <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void removeCampaigns([row.campaignId])}>
                        <Trash2 className="h-4 w-4" /> {t('tiktokAdsCreate.delete')}
                      </Button>
                      {canReview && (
                        <Button type="button" size="sm" variant="outline" onClick={() => setReview(row)}>
                          <Sparkles className="h-4 w-4" /> {t('tiktokAdsCreate.askAi')}
                        </Button>
                      )}
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2 lg:hidden">
                      <Input className="h-8 w-24" dir="ltr" type="number" value={budgetDrafts[row.campaignId] ?? String(row.budget || '')} onChange={(event) => setBudgetDrafts((current) => ({ ...current, [row.campaignId]: event.target.value }))} />
                      <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void saveBudget(row)}>{t('tiktokAdsCreate.saveBudget')}</Button>
                    </div>
                  </td>
                  <td className="py-3">
                    <span className={deliveryTone(row.deliveryStatus || row.status)}>{deliveryLabel(row.deliveryStatus || row.status, t)}</span>
                  </td>
                  <td className="hidden py-3 lg:table-cell">
                    <div className="flex items-center gap-2">
                      <Input className="h-8 w-28" dir="ltr" type="number" value={budgetDrafts[row.campaignId] ?? String(row.budget || '')} onChange={(event) => setBudgetDrafts((current) => ({ ...current, [row.campaignId]: event.target.value }))} />
                      <span dir="ltr" className="text-xs">{currency ? CURRENCY_SYMBOLS[currency] ?? currency : ''}</span>
                      <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void saveBudget(row)}>{t('tiktokAdsCreate.save')}</Button>
                    </div>
                  </td>
                  <td className="py-3"><span dir="ltr">{money(row.spend, currency)}</span></td>
                  <td className="hidden py-3 md:table-cell"><span dir="ltr">{money(row.clicks ? row.spend / row.clicks : 0, currency)}</span></td>
                  <td className="hidden py-3 md:table-cell"><span dir="ltr">{money(row.costPerConversion || (row.conversions ? row.spend / row.conversions : 0), currency)}</span></td>
                  <td className="py-3 tabular-nums">{Math.round(row.impressions).toLocaleString('en-US')}</td>
                </tr>
                {pickedId === row.campaignId && (
                  <tr>
                    <td colSpan={9} className="pb-4">
                      <CampaignVideosPanel
                        advertiserId={advertiserId}
                        currency={currency}
                        videos={row.videos ?? []}
                        onVideos={(videos) => setStats((current) => current.map((item) => (item.campaignId === row.campaignId ? { ...item, videos } : item)))}
                        onPreview={(video) => void openPreview(video)}
                      />
                    </td>
                  </tr>
                )}
                </Fragment>
              ))}
            </tbody>
          </table>
          )}
          {advertiserId && level === 'group' && (
            <table className="hidden w-full text-sm md:table">
              <thead>
                <tr className="border-b text-start text-muted-foreground">
                  <th className="py-2 font-medium">{t('tiktokAdsCreate.onOff')}</th>
                  <th className="py-2 font-medium">{t('tiktokAdsCreate.group')}</th>
                  <th className="py-2 font-medium">{t('tiktokAdsCreate.status')}</th>
                  <th className="py-2 font-medium">{t('tiktokAdsCreate.budget')}</th>
                  <th className="py-2 font-medium">{t('tiktokBusiness.metrics.spend')}</th>
                  <th className="hidden py-2 font-medium md:table-cell">{t('tiktokBusiness.metrics.costPerClick')}</th>
                  <th className="hidden py-2 font-medium md:table-cell">{t('tiktokBusiness.metrics.costPerResult')}</th>
                  <th className="py-2 font-medium">{t('tiktokBusiness.metrics.impressions')}</th>
                </tr>
              </thead>
              <tbody>
                {groupRows.length === 0 && <tr><td className="py-8 text-muted-foreground" colSpan={8}>{t('tiktokAdsCreate.noGroups')}</td></tr>}
                {groupRows.map((group) => {
                  const statusRaw = group.deliveryStatus || group.status;
                  const label = deliveryLabel(statusRaw, t);
                  return (
                    <tr key={group.adGroupId} className="border-b">
                      <td className="py-3">
                        <Switch checked={campaignIsOn(group.status)} disabled={statusBusy === group.adGroupId} onCheckedChange={(checked) => void toggleGroup(group.adGroupId, checked)} aria-label={t('tiktokAdsCreate.enableGroup')} />
                      </td>
                      <td className="py-3">
                        <div className="font-medium">{group.name}</div>
                        <div className="text-xs text-muted-foreground">{group.campaignName}</div>
                        <Button type="button" size="sm" className="mt-2" asChild>
                          <Link href={`/tiktok/ads/new?advertiserId=${encodeURIComponent(advertiserId)}&campaignId=${encodeURIComponent(group.campaignId)}`}>{t('tiktokAdsCreate.editCampaign')}</Link>
                        </Button>
                      </td>
                      <td className="py-3"><span className={deliveryTone(statusRaw)}>{label}</span></td>
                      <td className="py-3"><span dir="ltr">{money(group.budget, currency)}</span></td>
                      <td className="py-3"><span dir="ltr">{money(group.spend, currency)}</span></td>
                      <td className="hidden py-3 md:table-cell"><span dir="ltr">{money(group.clicks ? group.spend / group.clicks : 0, currency)}</span></td>
                      <td className="hidden py-3 md:table-cell"><span dir="ltr">{money(group.costPerConversion || 0, currency)}</span></td>
                      <td className="py-3 tabular-nums">{Math.round(group.impressions).toLocaleString('en-US')}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          {advertiserId && level === 'ad' && (
            <table className="hidden w-full text-sm md:table">
              <thead>
                <tr className="border-b text-start text-muted-foreground">
                  <th className="py-2 font-medium">{t('tiktokAdsCreate.onOff')}</th>
                  <th className="py-2 font-medium">{t('tiktokAdsCreate.ad')}</th>
                  <th className="py-2 font-medium">{t('tiktokAdsCreate.status')}</th>
                  <th className="py-2 font-medium">{t('tiktokBusiness.metrics.spend')}</th>
                  <th className="hidden py-2 font-medium md:table-cell">{t('tiktokBusiness.metrics.costPerClick')}</th>
                  <th className="hidden py-2 font-medium md:table-cell">{t('tiktokBusiness.metrics.costPerResult')}</th>
                  <th className="py-2 font-medium">{t('tiktokBusiness.metrics.impressions')}</th>
                </tr>
              </thead>
              <tbody>
                {adRows.length === 0 && <tr><td className="py-8 text-muted-foreground" colSpan={7}>{t('tiktokAdsCreate.noAds')}</td></tr>}
                {adRows.map((video) => {
                  const statusRaw = video.status || '';
                  const label = deliveryLabel(statusRaw, t);
                  return (
                    <tr key={video.adId} className="border-b">
                      <td className="py-3">
                        <Switch checked={campaignIsOn(video.status || 'ENABLE')} disabled={statusBusy === video.adId} onCheckedChange={(checked) => void toggleAd(video.adId, checked)} aria-label={t('tiktokAdsCreate.enableAd')} />
                      </td>
                      <td className="py-3">
                        <div className="flex items-center gap-2">
                          <button type="button" className="relative h-14 w-10 overflow-hidden rounded-md bg-muted" onClick={() => void openPreview(video)}>
                            <TikTokVideoThumb posterUrl={video.posterUrl} videoUrl={video.videoUrl} itemId={video.itemId} />
                          </button>
                          <div>
                            <div className="font-medium">{video.text || t('tiktokAdsCreate.ad')}</div>
                            <div className="text-xs text-muted-foreground">{video.campaignName}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3"><span className={deliveryTone(statusRaw)}>{label}</span></td>
                      <td className="py-3"><span dir="ltr">{money(video.spend || 0, currency)}</span></td>
                      <td className="hidden py-3 md:table-cell"><span dir="ltr">{money(video.clicks ? (video.spend || 0) / video.clicks : 0, currency)}</span></td>
                      <td className="hidden py-3 md:table-cell"><span dir="ltr">{money(video.costPerConversion ?? (video.conversions ? (video.spend || 0) / video.conversions : 0), currency)}</span></td>
                      <td className="py-3 tabular-nums">{Math.round(video.impressions || 0).toLocaleString('en-US')}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
      {review && (
        <CampaignReviewDialog
          advertiserId={advertiserId}
          campaignId={review.campaignId}
          campaignName={review.name}
          startDate={startDate}
          endDate={endDate}
          onClose={() => setReview(null)}
        />
      )}
      {preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setPreview(null)}>
          <div className="w-[420px] max-w-full overflow-hidden rounded-2xl bg-black shadow-2xl" onClick={(event) => event.stopPropagation()}>
            {preview.loading && !preview.videoUrl && !preview.previewLink ? (
              <div className="flex h-80 items-center justify-center text-white"><Loader2 className="h-6 w-6 animate-spin" /></div>
            ) : preview.videoUrl ? (
              <video src={preview.videoUrl} poster={preview.posterUrl || undefined} controls autoPlay playsInline className="h-[620px] max-h-[70vh] w-full bg-black object-contain" />
            ) : preview.previewLink ? (
              <iframe src={preview.previewLink} title={preview.text || t('tiktokAdsCreate.preview')} className="h-[620px] max-h-[70vh] w-full bg-white" />
            ) : preview.posterUrl ? (
              <img src={preview.posterUrl} alt="" referrerPolicy="no-referrer" className="h-[620px] max-h-[70vh] w-full object-contain" />
            ) : (
              <div className="flex h-80 items-center justify-center px-6 text-center text-white">{preview.error || t('tiktokAdsCreate.previewUnavailable')}</div>
            )}
            <p className="line-clamp-2 bg-black px-4 py-3 text-sm text-white">{preview.text}</p>
          </div>
        </div>
      )}
    </>
  );
}
