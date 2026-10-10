'use client';

import { useEffect, useState } from 'react';
import { Copy, Loader2, RefreshCw, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  deleteTikTokCampaignVideo,
  duplicateTikTokCampaignVideo,
  fetchTikTokAdCreateOptions,
  fetchTikTokIdentityVideos,
  replaceTikTokCampaignVideo,
  setTikTokCampaignVideoStatus,
  type TikTokCampaignVideo,
  type TikTokSparkVideo,
} from '@/lib/tiktok-business';
import { parseApiError } from '@/lib/utils';
import { TikTokVideoThumb } from '@/components/tiktok/video-thumb';

function videoIsOn(status?: string) {
  const value = (status || 'ENABLE').toUpperCase();
  return !value.includes('DISABLE') && !value.includes('DELETE');
}

function money(value: number | undefined, currency: string | null) {
  const digits = currency === 'IQD' ? 0 : 2;
  return `${Number(value || 0).toLocaleString('ar-IQ', { maximumFractionDigits: digits })} ${currency || ''}`.trim();
}

export function CampaignVideosPanel({
  advertiserId,
  currency,
  videos,
  onVideos,
  onPreview,
}: {
  advertiserId: string;
  currency: string | null;
  videos: TikTokCampaignVideo[];
  onVideos: (videos: TikTokCampaignVideo[]) => void;
  onPreview: (video: TikTokCampaignVideo) => void;
}) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [replaceId, setReplaceId] = useState('');
  const [identities, setIdentities] = useState<Array<{ identityId: string; identityType: string; displayName: string }>>([]);
  const [identityKey, setIdentityKey] = useState('');
  const [library, setLibrary] = useState<TikTokSparkVideo[]>([]);
  const [loadingLibrary, setLoadingLibrary] = useState(false);
  const [authCode, setAuthCode] = useState('');

  useEffect(() => {
    if (!replaceId) return;
    fetchTikTokAdCreateOptions(advertiserId)
      .then((data) => setIdentities(data.identities ?? []))
      .catch((err) => setError(parseApiError(err)));
  }, [replaceId, advertiserId]);

  useEffect(() => {
    if (!identityKey) return;
    const [identityId, identityType] = identityKey.split('|');
    if (!identityId || !identityType) return;
    setLoadingLibrary(true);
    fetchTikTokIdentityVideos(advertiserId, identityId, identityType)
      .then((data) => setLibrary(data.videos))
      .catch((err) => setError(parseApiError(err)))
      .finally(() => setLoadingLibrary(false));
  }, [identityKey, advertiserId]);

  async function toggle(video: TikTokCampaignVideo, enabled: boolean) {
    setBusyId(video.adId);
    setError(null);
    const previous = video.status;
    onVideos(videos.map((item) => (item.adId === video.adId ? { ...item, status: enabled ? 'ENABLE' : 'DISABLE' } : item)));
    try {
      const result = await setTikTokCampaignVideoStatus({ advertiserId, adId: video.adId, enabled });
      onVideos(videos.map((item) => (item.adId === video.adId ? { ...item, status: result.status } : item)));
    } catch (err) {
      onVideos(videos.map((item) => (item.adId === video.adId ? { ...item, status: previous } : item)));
      setError(parseApiError(err));
    } finally {
      setBusyId(null);
    }
  }

  async function remove(video: TikTokCampaignVideo) {
    if (!window.confirm('حذف هذا الفيديو من الحملة؟ لا يمكن التراجع.')) return;
    setBusyId(video.adId);
    setError(null);
    try {
      await deleteTikTokCampaignVideo({ advertiserId, adId: video.adId });
      onVideos(videos.filter((item) => item.adId !== video.adId));
      if (replaceId === video.adId) setReplaceId('');
    } catch (err) {
      setError(parseApiError(err));
    } finally {
      setBusyId(null);
    }
  }

  async function duplicate(video: TikTokCampaignVideo) {
    setBusyId(video.adId);
    setError(null);
    try {
      const created = await duplicateTikTokCampaignVideo({ advertiserId, adId: video.adId });
      onVideos([
        ...videos,
        {
          ...video,
          ...created,
          posterUrl: created.posterUrl || video.posterUrl,
          videoUrl: created.videoUrl || video.videoUrl,
          text: created.text || `${video.text} نسخة`,
          status: 'ENABLE',
        },
      ]);
    } catch (err) {
      setError(parseApiError(err));
    } finally {
      setBusyId(null);
    }
  }

  async function replace(video: TikTokCampaignVideo, next: { itemId?: string; identityId?: string; identityType?: string; authCode?: string; posterUrl?: string; videoUrl?: string; text?: string }) {
    setBusyId(video.adId);
    setError(null);
    try {
      const saved = await replaceTikTokCampaignVideo({
        advertiserId,
        adId: video.adId,
        itemId: next.itemId,
        identityId: next.identityId,
        identityType: next.identityType,
        authCode: next.authCode,
      });
      onVideos(videos.map((item) => (item.adId === video.adId ? {
        ...item,
        ...saved,
        posterUrl: saved.posterUrl || next.posterUrl || item.posterUrl,
        videoUrl: saved.videoUrl || next.videoUrl || '',
        text: saved.text || next.text || item.text,
      } : item)));
      setReplaceId('');
      setAuthCode('');
    } catch (err) {
      setError(parseApiError(err));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="mt-3 min-w-0 space-y-3 overflow-hidden rounded-xl border bg-muted/30 p-3">
      <p className="text-sm font-medium">فيديوهات الحملة ({videos.length})</p>
      {error && <p className="break-words text-sm text-destructive">{error}</p>}
      {videos.length === 0 && (
        <div className="rounded-lg border border-dashed bg-background px-3 py-4 text-center text-sm text-muted-foreground">
          لا توجد فيديوهات داخل هذه الحملة بعد — جرّب المزامنة أو افتح الحملة في تيك توك.
        </div>
      )}
      <div className="space-y-3">
        {videos.map((video, index) => (
          <div key={video.adId || `${video.itemId}-${index}`} className="min-w-0 overflow-hidden rounded-xl border bg-background p-3">
            <div className="flex gap-3">
              <button type="button" className="relative h-28 w-20 shrink-0 overflow-hidden rounded-md bg-muted" onClick={() => onPreview(video)}>
                <TikTokVideoThumb posterUrl={video.posterUrl} videoUrl={video.videoUrl} itemId={video.itemId} />
              </button>
              <div className="min-w-0 flex-1 overflow-hidden">
                <p className="text-xs text-muted-foreground">الفيديو {index + 1}</p>
                <p className="line-clamp-2 break-words text-sm font-medium">{video.text || 'فيديو'}</p>
                <div className="mt-2 flex items-center gap-2" dir="ltr">
                  <Switch
                    checked={videoIsOn(video.status)}
                    disabled={busyId === video.adId}
                    onCheckedChange={(checked) => void toggle(video, checked)}
                    aria-label={videoIsOn(video.status) ? 'إيقاف الفيديو' : 'تشغيل الفيديو'}
                  />
                  <span className="text-xs text-muted-foreground">{videoIsOn(video.status) ? 'يعمل' : 'متوقف'}</span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
                  <span>المنفق {money(video.spend, currency)}</span>
                  <span>الوصول {Math.round(video.reach || video.impressions || 0).toLocaleString('en-US')}</span>
                  <span>النقرات {Math.round(video.clicks || 0).toLocaleString('en-US')}</span>
                  <span>التحويلات {Math.round(video.conversions || 0).toLocaleString('en-US')}</span>
                  <span>تكلفة التحويل {money(video.costPerConversion, currency)}</span>
                  <span>معدل التحويل {(((video.conversionRate || 0) <= 1 ? (video.conversionRate || 0) * 100 : video.conversionRate || 0)).toLocaleString('en-US', { maximumFractionDigits: 1 })}%</span>
                </div>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button type="button" size="sm" variant="outline" disabled={busyId === video.adId} onClick={() => setReplaceId(replaceId === video.adId ? '' : video.adId)}>
                <RefreshCw className="h-4 w-4" /> استبدال
              </Button>
              <Button type="button" size="sm" variant="outline" disabled={busyId === video.adId} onClick={() => void duplicate(video)}>
                {busyId === video.adId ? <Loader2 className="h-4 w-4 animate-spin" /> : <Copy className="h-4 w-4" />} تكرار
              </Button>
              <Button type="button" size="sm" variant="outline" disabled={busyId === video.adId} onClick={() => void remove(video)}>
                <Trash2 className="h-4 w-4" /> حذف
              </Button>
            </div>
            {replaceId === video.adId && (
              <div className="mt-3 space-y-2 border-t pt-3">
                <select
                  className="h-9 w-full rounded-md border bg-background px-2 text-sm"
                  value={identityKey}
                  onChange={(event) => setIdentityKey(event.target.value)}
                >
                  <option value="">اختر حساب تيك توك للفيديوهات</option>
                  {identities.map((identity) => (
                    <option key={`${identity.identityType}:${identity.identityId}`} value={`${identity.identityId}|${identity.identityType}`}>
                      {identity.displayName || identity.identityId}
                    </option>
                  ))}
                </select>
                {loadingLibrary && <p className="text-xs text-muted-foreground">جاري تحميل الفيديوهات…</p>}
                <div className="flex max-h-40 flex-wrap gap-2 overflow-auto">
                  {library.map((item) => (
                    <button
                      key={item.itemId}
                      type="button"
                      className="relative h-16 w-12 overflow-hidden rounded-md bg-muted"
                      title={item.text}
                      onClick={() => void replace(video, item)}
                    >
                      <span className="relative block h-full w-full">
                        <TikTokVideoThumb posterUrl={item.posterUrl} videoUrl={item.videoUrl} itemId={item.itemId} />
                      </span>
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input value={authCode} onChange={(event) => setAuthCode(event.target.value)} placeholder="أو الصق كود الإعلان" />
                  <Button type="button" size="sm" disabled={!authCode.trim() || busyId === video.adId} onClick={() => void replace(video, { authCode: authCode.trim() })}>
                    استبدال
                  </Button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
