'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { CopyPlus, Palette, Plus, Trash2, Upload } from 'lucide-react';
import { ApplyProductColorsDialog } from '@/components/store/apply-product-colors-dialog';
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
export type ProductColorOption = {
  id: string;
  name: string;
  hex: string;
  imageId: string | null;
};
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
    imageObjectFit?: 'cover' | 'contain';
    imageObjectPosition?: string;
    imageZoom?: number;
    hideQuantity?: boolean;
    /** أقل كمية عند الإضافة للسلة */
    minOrderQuantity?: number;
    colors?: ProductColorOption[];
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
  allProducts,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  product: StoreProduct | null;
  categories: StoreCategory[];
  mediaUrls: Record<string, string>;
  labels: Record<string, string>;
  defaultCategoryId?: string;
  allProducts?: StoreProduct[];
  onOpenChange: (open: boolean) => void;
  onSaved: () => Promise<void>;
}) {
  const [files, setFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const [colors, setColors] = useState<ProductColorOption[]>([]);
  const [applyOpen, setApplyOpen] = useState(false);
  const [paletteBusy, setPaletteBusy] = useState(false);

  useEffect(() => {
    if (!open) {
      setFiles([]);
      return;
    }
    setColors(
      (product?.metadata?.colors || []).map((c, index) => ({
        id: c.id || `c_${index + 1}`,
        name: c.name || '',
        hex: c.hex || '#000000',
        imageId: c.imageId || null,
      })),
    );
  }, [open, product?.id, product?.metadata?.colors]);

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
          imageObjectFit: form.get('imageObjectFit') === 'contain' ? 'contain' : 'cover',
          imageObjectPosition: String(form.get('imageObjectPosition') || 'center').trim() || 'center',
          imageZoom: Math.min(200, Math.max(50, Number(form.get('imageZoom') || 100) || 100)),
          hideQuantity: form.get('hideQuantity') === 'on',
          minOrderQuantity: Math.min(
            9999,
            Math.max(1, Math.floor(Number(form.get('minOrderQuantity') || 1) || 1)),
          ),
          colors: colors
            .filter((c) => c.name.trim())
            .map((c, index) => ({
              id: c.id || `c_${index + 1}`,
              name: c.name.trim(),
              hex: /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(c.hex) ? c.hex : '#000000',
              imageId: c.imageId || null,
            })),
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
    <>
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
            <div className="space-y-1.5">
              <Label htmlFor="store-product-min-qty">{labels.minOrderQuantity || 'أقل كمية للحجز'}</Label>
              <Input
                id="store-product-min-qty"
                name="minOrderQuantity"
                type="number"
                inputMode="numeric"
                min={1}
                max={9999}
                step="1"
                lang="en"
                dir="ltr"
                className={numberField}
                defaultValue={Math.max(1, Math.floor(Number(product?.metadata?.minOrderQuantity) || 1))}
              />
              <p className="text-xs text-muted-foreground">
                {labels.minOrderQuantityHint ||
                  'عند الضغط على «أضف للسلة» تُضاف هذه الكمية كحد أدنى ولا يمكن طلب أقل منها.'}
              </p>
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
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="hideQuantity" defaultChecked={Boolean(product?.metadata?.hideQuantity)} />
            {labels.hideQuantity || 'إخفاء كمية المنتج عن الزبائن في المتجر'}
          </label>
          <div className="space-y-2 rounded-xl border border-dashed p-3">
            <p className="text-sm font-medium">{labels.imageFitTitle || 'قياسات عرض الصورة'}</p>
            <p className="text-xs text-muted-foreground">
              {labels.imageFitHint ||
                'يضبط موضع وتكبير الصورة داخل إطار البطاقة دون تغيير حجم أيقونة المنتج الخارجية.'}
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="store-image-fit">{labels.imageFitMode || 'طريقة العرض'}</Label>
                <select
                  id="store-image-fit"
                  name="imageObjectFit"
                  defaultValue={product?.metadata?.imageObjectFit === 'contain' ? 'contain' : 'cover'}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="cover">{labels.imageFitCover || 'قص لملء الإطار'}</option>
                  <option value="contain">{labels.imageFitContain || 'إظهار الصورة كاملة'}</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="store-image-pos">{labels.imageFitPosition || 'الموضع'}</Label>
                <select
                  id="store-image-pos"
                  name="imageObjectPosition"
                  defaultValue={product?.metadata?.imageObjectPosition || 'center'}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="center">{labels.imagePosCenter || 'وسط'}</option>
                  <option value="top">{labels.imagePosTop || 'أعلى'}</option>
                  <option value="bottom">{labels.imagePosBottom || 'أسفل'}</option>
                  <option value="left">{labels.imagePosLeft || 'يسار'}</option>
                  <option value="right">{labels.imagePosRight || 'يمين'}</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="store-image-zoom">{labels.imageFitZoom || 'تكبير داخل الإطار'}</Label>
                <Input
                  id="store-image-zoom"
                  name="imageZoom"
                  type="number"
                  min={50}
                  max={200}
                  step={5}
                  dir="ltr"
                  className={numberField}
                  defaultValue={product?.metadata?.imageZoom ?? 100}
                />
                <p className="text-[11px] text-muted-foreground">50–200% · الإطار الخارجي ثابت</p>
              </div>
            </div>
          </div>
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

          <div className="space-y-3 rounded-xl border border-dashed p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-medium">{labels.colorsTitle || 'ألوان المنتج'}</p>
                <p className="text-xs text-muted-foreground">
                  {labels.colorsHint ||
                    'أضف الألوان واربط كل لون بصورة المنتج. عند ضغط الزبون على اللون تتغير الصورة تلقائياً.'}
                </p>
              </div>
              <div className="flex flex-wrap gap-1">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={paletteBusy}
                  onClick={async () => {
                    setPaletteBusy(true);
                    try {
                      const data = await api<{ colors: ProductColorOption[] }>('/store/color-palette');
                      const images = (product?.images || []).filter((m) => m.kind === 'IMAGE');
                      setColors(
                        (data.colors || []).map((c, index) => ({
                          id: c.id || `c_${index + 1}`,
                          name: c.name || '',
                          hex: c.hex || '#000000',
                          imageId: images[index]?.id || null,
                        })),
                      );
                    } finally {
                      setPaletteBusy(false);
                    }
                  }}
                >
                  <Palette className="me-1 h-3.5 w-3.5" />
                  {labels.loadStoreColors || 'من لوحة المتجر'}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={!colors.some((c) => c.name.trim())}
                  onClick={() => setApplyOpen(true)}
                >
                  <CopyPlus className="me-1 h-3.5 w-3.5" />
                  {labels.applyColorsToProducts || 'تطبيق على منتجات'}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    setColors((prev) => [
                      ...prev,
                      {
                        id: `c_${Date.now().toString(36)}`,
                        name: '',
                        hex: '#000000',
                        imageId: product?.images?.find((m) => m.kind === 'IMAGE')?.id || null,
                      },
                    ])
                  }
                >
                  <Plus className="me-1 h-3.5 w-3.5" />
                  {labels.addColor || 'إضافة لون'}
                </Button>
              </div>
            </div>
            {!product?.images?.length ? (
              <p className="text-xs text-amber-700 dark:text-amber-300">
                {labels.colorsNeedImages || 'ارفع صور المنتج أولاً ثم اربط كل لون بالصورة المناسبة.'}
              </p>
            ) : null}
            <div className="space-y-3">
              {colors.map((color, index) => (
                <div key={color.id} className="grid gap-2 rounded-lg border bg-muted/20 p-3 sm:grid-cols-[auto_1fr_1fr_auto]">
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={/^#([0-9a-fA-F]{6})$/.test(color.hex) ? color.hex : '#000000'}
                      onChange={(e) =>
                        setColors((prev) => prev.map((c, i) => (i === index ? { ...c, hex: e.target.value } : c)))
                      }
                      className="h-10 w-12 cursor-pointer rounded border bg-transparent p-1"
                      title={labels.colorSwatch || 'مربع اللون'}
                    />
                    <span className="text-xs font-mono" dir="ltr">
                      {color.hex}
                    </span>
                  </div>
                  <Input
                    value={color.name}
                    onChange={(e) =>
                      setColors((prev) => prev.map((c, i) => (i === index ? { ...c, name: e.target.value } : c)))
                    }
                    placeholder={labels.colorName || 'اسم اللون (مثال: أسود)'}
                  />
                  <select
                    value={color.imageId || ''}
                    onChange={(e) =>
                      setColors((prev) =>
                        prev.map((c, i) => (i === index ? { ...c, imageId: e.target.value || null } : c)),
                      )
                    }
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="">{labels.colorImage || 'اختر صورة اللون'}</option>
                    {(product?.images || [])
                      .filter((m) => m.kind === 'IMAGE')
                      .map((m, mediaIndex) => (
                        <option key={m.id} value={m.id}>
                          {labels.colorImageOption || 'صورة'} #{mediaIndex + 1}
                        </option>
                      ))}
                  </select>
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    onClick={() => setColors((prev) => prev.filter((_, i) => i !== index))}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          <Button type="submit" disabled={saving}>
            <Upload className="h-4 w-4" />
            {saving ? labels.saving : labels.save}
          </Button>
        </form>
      </DialogContent>
    </Dialog>

    <ApplyProductColorsDialog
      open={applyOpen}
      products={allProducts || []}
      colors={colors}
      sourceProductId={product?.id}
      onOpenChange={setApplyOpen}
      onDone={onSaved}
      labels={{
        title: labels.applyColorsTitle,
        desc: labels.applyColorsDesc,
        applyAll: labels.applyColorsAll,
        pickProducts: labels.applyColorsPick,
        selectAll: labels.applyColorsSelectAll,
        linkByPosition: labels.applyColorsLinkByPosition,
        savePalette: labels.applyColorsSavePalette,
        apply: labels.applyColorsSubmit,
        close: labels.applyColorsClose,
        needColors: labels.applyColorsNeedColors,
        needProducts: labels.applyColorsNeedProducts,
        applied: labels.applyColorsDone,
        noOther: labels.applyColorsNoOther,
        emptyPalette: labels.applyColorsEmpty,
      }}
    />
    </>
  );
}
