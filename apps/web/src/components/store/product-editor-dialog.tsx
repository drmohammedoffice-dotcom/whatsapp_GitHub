'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Trash2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { parseIqdAmount } from '@/lib/parse-iqd';
import { api, apiUpload } from '@/lib/utils';
import { sanitizeBrowserMetaPixelId } from '@/lib/meta-pixel';

function extractMetaPixelId(raw: unknown): string | null {
  return sanitizeBrowserMetaPixelId(raw);
}

export type StoreMedia = { id: string; kind: 'IMAGE' | 'VIDEO'; mimeType?: string | null };
export type StoreCategory = { id: string; name: string; imageStorageKey?: string | null; isActive?: boolean; _count?: { products: number } };
export type StoreProduct = {
  id: string;
  name: string;
  description?: string | null;
  unitPrice: number;
  currency: string;
  quantity: number;
  outOfStockManual: boolean;
  isActive: boolean;
  categoryId?: string | null;
  metadata?: {
    landingKey?: string;
    compareAtPrice?: number;
    metaPixelId?: string | null;
    landingCopy?: Record<string, unknown> | null;
    salePrice?: number | null;
  } | null;
  images: StoreMedia[];
};

const numberField = 'dir-ltr text-start font-mono tabular-nums';

type Preview = { url: string; kind: 'IMAGE' | 'VIDEO'; name: string };

export function ProductEditorDialog({
  open,
  product,
  categories,
  mediaUrls,
  labels,
  defaultCategoryId,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  product: StoreProduct | null;
  categories: StoreCategory[];
  mediaUrls: Record<string, string>;
  labels: Record<string, string>;
  defaultCategoryId?: string;
  onOpenChange: (open: boolean) => void;
  onSaved: () => Promise<void>;
}) {
  const [files, setFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) setFiles([]);
  }, [open, product?.id]);

  const previews = useMemo<Preview[]>(
    () =>
      files.map((file) => ({
        url: URL.createObjectURL(file),
        kind: file.type.startsWith('video/') ? 'VIDEO' : 'IMAGE',
        name: file.name,
      })),
    [files],
  );

  useEffect(() => {
    return () => previews.forEach((p) => URL.revokeObjectURL(p.url));
  }, [previews]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    try {
      const form = new FormData(event.currentTarget);
      const price = parseIqdAmount(form.get('unitPrice')) || 0;
      const compare = parseIqdAmount(form.get('compareAtPrice'));
      const body = {
        name: String(form.get('name') || ''),
        description: String(form.get('description') || ''),
        unitPrice: price,
        quantity: Number(form.get('quantity') || 0),
        currency: 'IQD',
        categoryId: String(form.get('categoryId') || ''),
        outOfStockManual: form.get('outOfStockManual') === 'on',
        isActive: true,
        metadata: {
          ...(product?.metadata || {}),
          salePrice: price || undefined,
          compareAtPrice: compare || undefined,
          landingKey: String(form.get('landingKey') || '').trim() || undefined,
          metaPixelId: extractMetaPixelId(form.get('metaPixelId')),
        },
      };
      const saved = product
        ? await api<StoreProduct>(`/products/${product.id}`, { method: 'PATCH', body: JSON.stringify(body) })
        : await api<StoreProduct>('/products', { method: 'POST', body: JSON.stringify(body) });
      for (const file of files) {
        if (!file?.size) continue;
        const fd = new FormData();
        fd.append('file', file);
        await apiUpload(`/products/${saved.id}/media`, fd);
      }
      onOpenChange(false);
      await onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[min(100vw-1rem,40rem)]">
        <DialogHeader className="text-start">
          <DialogTitle>{product ? labels.editProduct : labels.addProduct}</DialogTitle>
          <DialogDescription>{labels.modalHint}</DialogDescription>
        </DialogHeader>
        <form key={`${product?.id || 'new'}-${defaultCategoryId || ''}`} onSubmit={save} className="grid gap-4">
          <div className="space-y-1.5 rounded-xl border border-sky-500/40 bg-sky-500/10 p-3">
            <Label htmlFor="store-product-meta-pixel">{labels.metaPixelId || 'بكسل ميتا (Meta Pixel)'}</Label>
            <Textarea
              id="store-product-meta-pixel"
              name="metaPixelId"
              dir="ltr"
              rows={4}
              defaultValue={product?.metadata?.metaPixelId ?? ''}
              placeholder={"الصق كود ميتا كاملاً أو الرقم فقط"}
              className="font-mono text-xs"
            />
            <p className="text-xs text-muted-foreground">
              {labels.metaPixelHint ||
                'ابحث في كود ميتا عن fbq(\'init\') والصق الكود هنا. النظام يستخرج الرقم تلقائياً ولا يحفظ سكربت الإعلانات.'}
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="store-product-name">{labels.name}</Label>
            <Input id="store-product-name" name="name" defaultValue={product?.name} required placeholder={labels.namePlaceholder} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="store-product-desc">{labels.descriptionField}</Label>
            <Textarea
              id="store-product-desc"
              name="description"
              defaultValue={product?.description ?? ''}
              rows={4}
              placeholder={labels.descPlaceholder}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="store-product-price">{labels.priceIqd}</Label>
              <Input
                id="store-product-price"
                name="unitPrice"
                type="number"
                inputMode="numeric"
                min={0}
                step="1"
                lang="en"
                dir="ltr"
                className={numberField}
                defaultValue={product?.unitPrice ?? 0}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="store-product-compare">{labels.compareAtPrice || 'السعر السابق (اختياري)'}</Label>
              <Input
                id="store-product-compare"
                name="compareAtPrice"
                type="number"
                inputMode="numeric"
                min={0}
                step="1"
                lang="en"
                dir="ltr"
                className={numberField}
                defaultValue={product?.metadata?.compareAtPrice ?? ''}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="store-product-qty">{labels.quantity}</Label>
              <Input
                id="store-product-qty"
                name="quantity"
                type="number"
                inputMode="numeric"
                min={0}
                step="1"
                lang="en"
                dir="ltr"
                className={numberField}
                defaultValue={product?.quantity ?? 0}
                required
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="store-product-landing">{labels.landingKey || 'مفتاح صفحة الهبوط (اختياري)'}</Label>
            <Input
              id="store-product-landing"
              name="landingKey"
              dir="ltr"
              defaultValue={product?.metadata?.landingKey ?? ''}
              placeholder="flash-12-courses"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="store-product-cat">{labels.category}</Label>
            <select
              id="store-product-cat"
              name="categoryId"
              defaultValue={product?.categoryId || defaultCategoryId || ''}
              className="h-10 w-full rounded-lg border bg-background px-3 text-sm"
            >
              <option value="">{labels.noCategory}</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="outOfStockManual" defaultChecked={product?.outOfStockManual} />
            {labels.markOut}
          </label>
          <div className="space-y-2">
            <Label htmlFor="store-product-media">{labels.media}</Label>
            <Input
              id="store-product-media"
              type="file"
              accept="image/*,video/*"
              multiple
              onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
            />
            <p className="text-xs text-muted-foreground">{labels.mediaHint}</p>
            {previews.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {previews.map((p) => (
                  <div key={p.url} className="overflow-hidden rounded-lg border bg-muted">
                    {p.kind === 'VIDEO' ? (
                      <video src={p.url} className="aspect-square w-full object-cover" muted />
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.url} alt={p.name} className="aspect-square w-full object-cover" />
                    )}
                  </div>
                ))}
              </div>
            )}
            {product?.images?.length ? (
              <div className="grid grid-cols-3 gap-2">
                {product.images.map((m) => (
                  <div key={m.id} className="relative overflow-hidden rounded-lg border">
                    {mediaUrls[m.id] ? (
                      m.kind === 'VIDEO' ? (
                        <video src={mediaUrls[m.id]} className="aspect-square w-full object-cover" muted />
                      ) : (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={mediaUrls[m.id]} alt="" className="aspect-square w-full object-cover" />
                      )
                    ) : (
                      <div className="aspect-square bg-muted" />
                    )}
                    <Button
                      type="button"
                      size="icon"
                      variant="destructive"
                      className="absolute end-1 top-1 h-7 w-7"
                      onClick={async () => {
                        await api(`/products/${product.id}/media/${m.id}`, { method: 'DELETE' });
                        await onSaved();
                      }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
          <Button type="submit" disabled={saving}>
            <Upload className="h-4 w-4" />
            {saving ? labels.saving : labels.save}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
