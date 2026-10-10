'use client';

import { useCallback, useEffect, useState } from 'react';
import { ImagePlus, Library, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  createTikTokDisplayCard,
  fetchTikTokDisplayCards,
  type TikTokDisplayCard,
} from '@/lib/tiktok-business';
import { parseApiError } from '@/lib/utils';

export function InteractiveAddonsPanel({
  advertiserId,
  pixelId,
  trackingUrl,
  enabled,
  onEnabledChange,
  selectedCardId,
  selectedPreviewUrl,
  onSelect,
}: {
  advertiserId: string;
  pixelId?: string;
  trackingUrl?: string;
  enabled: boolean;
  onEnabledChange: (value: boolean) => void;
  selectedCardId: string;
  selectedPreviewUrl: string;
  onSelect: (card: { cardId: string; previewUrl: string } | null) => void;
}) {
  const [createOpen, setCreateOpen] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [previewLocal, setPreviewLocal] = useState('');
  const [cards, setCards] = useState<TikTokDisplayCard[]>([]);
  const [loadingLibrary, setLoadingLibrary] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    if (!file) {
      setPreviewLocal('');
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewLocal(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const loadLibrary = useCallback(async (nextPage = 1) => {
    if (!advertiserId) return;
    setLoadingLibrary(true);
    setError(null);
    try {
      const data = await fetchTikTokDisplayCards(advertiserId, nextPage);
      setCards(data.cards);
      setPage(data.page);
      setTotal(data.total);
    } catch (err) {
      setError(parseApiError(err));
    } finally {
      setLoadingLibrary(false);
    }
  }, [advertiserId]);

  useEffect(() => {
    if (libraryOpen) void loadLibrary(1);
  }, [libraryOpen, loadLibrary]);

  async function submitCreate() {
    if (!file || !advertiserId) return;
    setBusy(true);
    setError(null);
    try {
      const created = await createTikTokDisplayCard({
        advertiserId,
        file,
        pixelId,
        landingPageUrl: trackingUrl,
        title: file.name.replace(/\.[^.]+$/, '').slice(0, 40),
      });
      onSelect({ cardId: created.cardId, previewUrl: created.previewUrl || previewLocal });
      onEnabledChange(true);
      setCreateOpen(false);
      setFile(null);
    } catch (err) {
      setError(parseApiError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-3 rounded-xl border p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium">الوظائف الإضافية التفاعلية — اختياري</p>
          <p className="mt-1 text-xs text-muted-foreground">
            بطاقة العرض تظهر أسفل الفيديو. عند الإنشاء يُربط رابط تتبع البكسل تلقائياً وتُحفظ البطاقة في مكتبة تيك توك.
          </p>
        </div>
        <Switch
          checked={enabled}
          onCheckedChange={(value) => {
            onEnabledChange(value);
            if (!value) onSelect(null);
          }}
        />
      </div>

      {enabled && (
        <div className="space-y-3">
          {trackingUrl ? (
            <div className="rounded-lg bg-muted/50 px-3 py-2 text-xs">
              <span className="text-muted-foreground">رابط التتبع: </span>
              <code dir="ltr" className="break-all">{trackingUrl}</code>
            </div>
          ) : (
            <p className="text-xs text-amber-800">
              اختر بكسل مربوطاً برابط تتبع قبل إنشاء البطاقة، أو أنشئ البكسل من صفحة الربط أولاً.
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="outline" onClick={() => { setError(null); setCreateOpen(true); }}>
              <ImagePlus className="h-4 w-4" /> إنشاء
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => { setError(null); setLibraryOpen(true); }}>
              <Library className="h-4 w-4" /> اختيار من المكتبة
            </Button>
            {selectedCardId && (
              <Button type="button" size="sm" variant="ghost" onClick={() => onSelect(null)}>
                إزالة البطاقة
              </Button>
            )}
          </div>

          {selectedCardId && (
            <div className="flex items-center gap-3 rounded-lg border bg-background p-2">
              <div className="h-16 w-28 overflow-hidden rounded-md bg-muted">
                {selectedPreviewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={selectedPreviewUrl} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <span className="flex h-full items-center justify-center text-[10px] text-muted-foreground">بطاقة</span>
                )}
              </div>
              <div className="min-w-0 text-xs">
                <p className="font-medium">بطاقة العرض محددة</p>
                <p dir="ltr" className="truncate text-muted-foreground">{selectedCardId}</p>
              </div>
            </div>
          )}
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => !busy && setCreateOpen(false)}>
          <div className="w-full max-w-md rounded-2xl border bg-background p-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-semibold">إنشاء بطاقة عرض</h3>
              <button type="button" onClick={() => !busy && setCreateOpen(false)} aria-label="إغلاق"><X className="h-4 w-4" /></button>
            </div>
            <p className="mb-3 text-xs text-muted-foreground">
              ارفع صورة البطاقة (يفضّل 750×421 JPG/PNG). يُربط رابط تتبع البكسل تلقائياً وتُحفظ في المكتبة.
            </p>
            <div className="grid gap-2">
              <Label>صورة البطاقة</Label>
              <input
                type="file"
                accept="image/jpeg,image/png,image/jpg,image/webp"
                className="block w-full text-sm"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
              {previewLocal && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={previewLocal} alt="" className="mt-2 max-h-40 w-full rounded-lg object-contain bg-muted" />
              )}
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button type="button" variant="outline" disabled={busy} onClick={() => setCreateOpen(false)}>إلغاء</Button>
              <Button type="button" disabled={busy || !file || (!trackingUrl && !pixelId)} onClick={() => void submitCreate()}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'تأكيد الإنشاء'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {libraryOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setLibraryOpen(false)}>
          <div className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-2xl border bg-background shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b px-4 py-3">
              <h3 className="font-semibold">الوظائف الإضافية التفاعلية</h3>
              <button type="button" onClick={() => setLibraryOpen(false)} aria-label="إغلاق"><X className="h-4 w-4" /></button>
            </div>
            <div className="min-h-0 flex-1 overflow-auto p-4">
              {loadingLibrary && (
                <p className="flex items-center gap-2 py-8 justify-center text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> جاري تحميل المكتبة…
                </p>
              )}
              {!loadingLibrary && cards.length === 0 && (
                <p className="py-8 text-center text-sm text-muted-foreground">لا توجد بطاقات محفوظة بعد — أنشئ بطاقة جديدة أولاً.</p>
              )}
              <div className="grid gap-2">
                {cards.map((card) => {
                  const selected = selectedCardId === card.cardId;
                  return (
                    <label
                      key={card.cardId}
                      className={`flex cursor-pointer items-center gap-3 rounded-xl border p-2 ${selected ? 'border-primary bg-primary/5' : 'hover:bg-muted/40'}`}
                    >
                      <input
                        type="radio"
                        name="display-card"
                        checked={selected}
                        onChange={() => onSelect({ cardId: card.cardId, previewUrl: card.previewUrl })}
                      />
                      <div className="h-14 w-24 shrink-0 overflow-hidden rounded-md bg-muted">
                        {card.previewUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={card.previewUrl} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                        ) : (
                          <span className="flex h-full items-center justify-center text-[10px]">بطاقة</span>
                        )}
                      </div>
                      <div className="min-w-0 flex-1 text-xs">
                        <p className="font-medium">بطاقة العرض</p>
                        <p dir="ltr" className="truncate text-muted-foreground">{card.title || card.cardId}</p>
                        {card.createdAt && <p className="text-muted-foreground">{card.createdAt}</p>}
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
            <div className="flex items-center justify-between border-t px-4 py-3">
              <div className="flex items-center gap-2 text-sm">
                <Button type="button" size="sm" variant="outline" disabled={page <= 1 || loadingLibrary} onClick={() => void loadLibrary(page - 1)}>{'<'}</Button>
                <span>{page}{total ? ` / ${Math.max(1, Math.ceil(total / 20))}` : ''}</span>
                <Button type="button" size="sm" variant="outline" disabled={loadingLibrary || (total > 0 && page * 20 >= total)} onClick={() => void loadLibrary(page + 1)}>{'>'}</Button>
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => setLibraryOpen(false)}>إلغاء</Button>
                <Button
                  type="button"
                  disabled={!selectedCardId}
                  onClick={() => {
                    onEnabledChange(true);
                    setLibraryOpen(false);
                  }}
                >
                  تأكيد
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
