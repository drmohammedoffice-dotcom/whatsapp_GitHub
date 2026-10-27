'use client';

import { useEffect, useMemo, useState } from 'react';
import { CheckSquare, Loader2, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { api } from '@/lib/utils';
import type { ProductColorOption, StoreProduct } from '@/components/store/product-editor-dialog';

type PaletteColor = { id: string; name: string; hex: string };

export function ApplyProductColorsDialog({
  open,
  products,
  colors,
  sourceProductId,
  onOpenChange,
  onDone,
  labels,
}: {
  open: boolean;
  products: StoreProduct[];
  colors: ProductColorOption[];
  sourceProductId?: string | null;
  onOpenChange: (open: boolean) => void;
  onDone: () => Promise<void> | void;
  labels?: Record<string, string>;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const [applyAll, setApplyAll] = useState(false);
  const [linkByPosition, setLinkByPosition] = useState(true);
  const [savePalette, setSavePalette] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const targets = useMemo(
    () => products.filter((p) => p.id !== sourceProductId),
    [products, sourceProductId],
  );

  const palette: PaletteColor[] = useMemo(
    () =>
      colors
        .filter((c) => c.name.trim())
        .map((c) => ({ id: c.id, name: c.name.trim(), hex: c.hex || '#000000' })),
    [colors],
  );

  useEffect(() => {
    if (!open) return;
    setSelected([]);
    setApplyAll(false);
    setLinkByPosition(true);
    setSavePalette(true);
    setError(null);
    setNotice(null);
  }, [open]);

  function toggle(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function selectAll() {
    setSelected(targets.map((p) => p.id));
  }

  async function submit() {
    if (!palette.length) {
      setError(labels?.needColors || 'أضف لوناً واحداً على الأقل');
      return;
    }
    if (!applyAll && selected.length === 0) {
      setError(labels?.needProducts || 'اختر منتجات أو طبّق على الكل');
      return;
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const result = await api<{ updatedCount: number }>('/store/color-palette/apply', {
        method: 'POST',
        body: JSON.stringify({
          colors: palette,
          all: applyAll,
          productIds: applyAll ? undefined : selected,
          linkImagesByPosition: linkByPosition,
          saveAsStorePalette: savePalette,
        }),
      });
      setNotice(
        (labels?.applied || 'تم التطبيق على {n} منتج').replace('{n}', String(result.updatedCount)),
      );
      await onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر التطبيق');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[min(100vw-1rem,36rem)]">
        <DialogHeader className="text-start">
          <DialogTitle>{labels?.title || 'تطبيق الألوان على المنتجات'}</DialogTitle>
          <DialogDescription>
            {labels?.desc ||
              'طبّق نفس مجموعة الألوان على كل منتجاتك أو على منتجات محددة دون إعادة إدخالها يدوياً.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex flex-wrap gap-2 rounded-xl border bg-muted/30 p-3">
            {palette.length === 0 ? (
              <p className="text-sm text-muted-foreground">{labels?.emptyPalette || 'لا توجد ألوان للتطبيق'}</p>
            ) : (
              palette.map((c) => (
                <span
                  key={c.id}
                  className="inline-flex items-center gap-2 rounded-full border bg-background px-3 py-1 text-sm"
                >
                  <span className="h-4 w-4 rounded-full border" style={{ background: c.hex }} />
                  {c.name}
                </span>
              ))
            )}
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={applyAll} onChange={(e) => setApplyAll(e.target.checked)} />
            {labels?.applyAll || 'تطبيق على كل المنتجات'}
          </label>

          {!applyAll ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label>{labels?.pickProducts || 'اختر المنتجات'}</Label>
                <Button type="button" size="sm" variant="outline" onClick={selectAll} disabled={!targets.length}>
                  {labels?.selectAll || 'تحديد الكل'}
                </Button>
              </div>
              <div className="max-h-56 space-y-1 overflow-auto rounded-xl border p-2">
                {targets.length === 0 ? (
                  <p className="p-2 text-sm text-muted-foreground">{labels?.noOther || 'لا توجد منتجات أخرى'}</p>
                ) : (
                  targets.map((p) => {
                    const on = selected.includes(p.id);
                    return (
                      <button
                        key={p.id}
                        type="button"
                        className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-start text-sm hover:bg-muted"
                        onClick={() => toggle(p.id)}
                      >
                        {on ? <CheckSquare className="h-4 w-4 shrink-0" /> : <Square className="h-4 w-4 shrink-0" />}
                        <span className="truncate">{p.name}</span>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          ) : null}

          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-1"
              checked={linkByPosition}
              onChange={(e) => setLinkByPosition(e.target.checked)}
            />
            <span>
              {labels?.linkByPosition ||
                'ربط تلقائي: اللون الأول بصورة المنتج الأولى، والثاني بالثانية… (إن وُجدت صور)'}
            </span>
          </label>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={savePalette} onChange={(e) => setSavePalette(e.target.checked)} />
            {labels?.savePalette || 'حفظ هذه الألوان كلوحة ألوان مشتركة للمتجر'}
          </label>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          {notice ? <p className="text-sm text-emerald-700">{notice}</p> : null}

          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
              {labels?.close || 'إغلاق'}
            </Button>
            <Button type="button" onClick={() => void submit()} disabled={busy || !palette.length}>
              {busy ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : null}
              {labels?.apply || 'تطبيق الألوان'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
