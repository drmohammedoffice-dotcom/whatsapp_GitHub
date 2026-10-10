'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ExternalLink, ImagePlus, Loader2, Palette, Plus, Settings2 } from 'lucide-react';
import { ProductEditorDialog, type StoreCategory, type StoreProduct } from '@/components/store/product-editor-dialog';
import {
  PublicStorefront,
  type PublicBanner,
  type PublicCategory,
  type PublicProduct,
  type PublicStore,
} from '@/components/store/public-storefront';
import { useTranslation } from '@/components/providers/locale-provider';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DEFAULT_STORE_THEME, STORE_THEME_PRESETS, type StoreThemeColors } from '@/lib/store-themes';
import { api, apiUpload, fetchAuthedBlobUrl } from '@/lib/utils';

type Settings = {
  brandName: string;
  slug: string;
  storeUrl: string;
  logoUrl?: string | null;
  deliveryMode: string;
  deliveryFee: number;
  deliveryRates: Record<string, number>;
  giftWhatsappPhone?: string | null;
  defaultLocale: string;
  currency: string;
  isPublished: boolean;
  governorates?: string[];
  promoEnabled?: boolean;
  promoEndsAt?: string | null;
  promoText?: string | null;
  theme?: StoreThemeColors;
};

type StoreBanner = {
  id: string;
  title: string | null;
  subtitle: string | null;
  linkUrl: string | null;
  enabled: boolean;
};

const COLOR_FIELDS: Array<{ key: keyof StoreThemeColors; labelAr: string; labelEn: string }> = [
  { key: 'bg', labelAr: 'خلفية الصفحة', labelEn: 'Page background' },
  { key: 'bgAlt', labelAr: 'خلفية علوية', labelEn: 'Top wash' },
  { key: 'text', labelAr: 'لون النص', labelEn: 'Text' },
  { key: 'muted', labelAr: 'نص ثانوي', labelEn: 'Muted text' },
  { key: 'accent', labelAr: 'لون بارز', labelEn: 'Accent' },
  { key: 'accentText', labelAr: 'نص الزر', labelEn: 'Button text' },
  { key: 'card', labelAr: 'خلفية البطاقة', labelEn: 'Card' },
  { key: 'border', labelAr: 'الإطار', labelEn: 'Border' },
];

function inStock(p: StoreProduct) {
  return !p.outOfStockManual && p.quantity > 0;
}

function moveId(ids: string[], id: string, direction: -1 | 1) {
  const index = ids.indexOf(id);
  if (index < 0) return null;
  const next = index + direction;
  if (next < 0 || next >= ids.length) return null;
  const copy = [...ids];
  const [item] = copy.splice(index, 1);
  copy.splice(next, 0, item!);
  return copy;
}

export function StoreVisualEditor() {
  const { t, locale } = useTranslation();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [categories, setCategories] = useState<StoreCategory[]>([]);
  const [banners, setBanners] = useState<StoreBanner[]>([]);
  const [mediaUrls, setMediaUrls] = useState<Record<string, string>>({});
  const [catUrls, setCatUrls] = useState<Record<string, string>>({});
  const [bannerUrls, setBannerUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<StoreProduct | null>(null);
  const [productOpen, setProductOpen] = useState(false);
  const [defaultCategoryId, setDefaultCategoryId] = useState<string>('');
  const [categoryDialog, setCategoryDialog] = useState<{ id?: string; name: string } | null>(null);
  const [categoryBusy, setCategoryBusy] = useState(false);
  const [bannerDialogOpen, setBannerDialogOpen] = useState(false);
  const [colorsOpen, setColorsOpen] = useState(false);
  const [draftColors, setDraftColors] = useState<StoreThemeColors>(DEFAULT_STORE_THEME);
  const [colorsBusy, setColorsBusy] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    const [list, store, cats, slides] = await Promise.all([
      api<StoreProduct[]>('/products'),
      api<Settings>('/store/settings'),
      api<StoreCategory[]>('/store/categories'),
      api<StoreBanner[]>('/store/banners'),
    ]);
    setProducts(list);
    setSettings(store);
    setCategories(cats);
    setBanners(slides);
    if (store.theme) setDraftColors(store.theme);
  }, []);

  useEffect(() => {
    setLoading(true);
    load()
      .catch((err) => setError(err instanceof Error ? err.message : 'Error'))
      .finally(() => setLoading(false));
  }, [load]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const next: Record<string, string> = {};
      for (const id of products.flatMap((p) => p.images.map((m) => m.id))) {
        try {
          next[id] = await fetchAuthedBlobUrl(`/store/media/${id}`);
        } catch {
          /* skip */
        }
      }
      if (!cancelled) setMediaUrls(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [products]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const next: Record<string, string> = {};
      for (const cat of categories) {
        try {
          next[cat.id] = await fetchAuthedBlobUrl(`/store/categories/${cat.id}/image`);
        } catch {
          /* skip */
        }
      }
      if (!cancelled) setCatUrls(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [categories]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const next: Record<string, string> = {};
      for (const banner of banners) {
        try {
          next[banner.id] = await fetchAuthedBlobUrl(`/store/banners/${banner.id}/image`);
        } catch {
          /* skip */
        }
      }
      if (!cancelled) setBannerUrls(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [banners]);

  const previewData = useMemo<PublicStore | null>(() => {
    if (!settings) return null;
    const theme = draftColors ?? settings.theme ?? DEFAULT_STORE_THEME;
    const publicCategories: PublicCategory[] = categories.map((c) => ({
      id: c.id,
      name: c.name,
      imageUrl: catUrls[c.id] || null,
      isActive: c.isActive !== false,
    }));
    // في وضع التحرير نعرض المخفي أيضاً مع شارة "مخفي"
    const publicProducts: PublicProduct[] = products.map((p) => {
        const price = Number(p.unitPrice) || 0;
        const compare = Number(p.metadata?.compareAtPrice) || 0;
        return {
          id: p.id,
          name: p.name,
          description: p.description ?? null,
          price,
          compareAtPrice: compare > price ? compare : null,
          currency: p.currency || settings.currency || 'IQD',
          quantity: inStock(p) ? p.quantity : 0,
          inStock: inStock(p),
          isActive: p.isActive !== false,
          categoryId: p.categoryId ?? null,
          categoryName: categories.find((c) => c.id === p.categoryId)?.name ?? null,
          media: p.images
            .map((m) => ({
              id: m.id,
              kind: m.kind,
              url: mediaUrls[m.id] || '',
            }))
            .filter((m) => m.url),
        };
      });
    const publicBanners: PublicBanner[] = banners
      .filter((b) => b.enabled)
      .map((b) => ({
        id: b.id,
        title: b.title,
        subtitle: b.subtitle,
        linkUrl: b.linkUrl,
        imageUrl: bannerUrls[b.id] || '',
      }))
      .filter((b) => b.imageUrl);
    return {
      settings: {
        slug: settings.slug,
        brandName: settings.brandName,
        currency: settings.currency || 'IQD',
        defaultLocale: settings.defaultLocale === 'en' ? 'en' : 'ar',
        deliveryMode: settings.deliveryMode,
        deliveryFee: Number(settings.deliveryFee) || 0,
        deliveryRates: settings.deliveryRates || {},
        giftWhatsappPhone: settings.giftWhatsappPhone ?? null,
        storeUrl: settings.storeUrl,
        logoUrl: settings.logoUrl ?? null,
        governorates: settings.governorates || [],
        promoEnabled: settings.promoEnabled,
        promoEndsAt: settings.promoEndsAt,
        promoText: settings.promoText,
        theme,
      },
      products: publicProducts,
      categories: publicCategories,
      banners: publicBanners,
      governorates: settings.governorates || [],
    };
  }, [settings, products, categories, banners, mediaUrls, catUrls, bannerUrls, draftColors]);

  const editorLabels = {
    addProduct: t('store.addProduct'),
    editProduct: t('store.editProduct'),
    modalHint: t('store.modalHint'),
    name: t('store.name'),
    namePlaceholder: t('store.namePlaceholder'),
    descriptionField: t('store.descriptionField'),
    descPlaceholder: t('store.descPlaceholder'),
    priceIqd: t('store.priceIqd'),
    quantity: t('store.quantity'),
    category: t('store.category'),
    noCategory: t('store.noCategory'),
    markOut: t('store.markOut'),
    media: t('store.media'),
    mediaHint: t('store.mediaHint'),
    save: t('store.save'),
    saving: t('store.saving'),
  };

  async function saveCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!categoryDialog) return;
    setCategoryBusy(true);
    try {
      const form = new FormData(event.currentTarget);
      const name = String(form.get('name') || '').trim();
      if (!name) return;
      let id = categoryDialog.id;
      if (id) {
        await api(`/store/categories/${id}`, { method: 'PATCH', body: JSON.stringify({ name }) });
      } else {
        const created = await api<StoreCategory>('/store/categories', {
          method: 'POST',
          body: JSON.stringify({ name }),
        });
        id = created.id;
      }
      const image = form.get('image') as File | null;
      if (image?.size && id) {
        const fd = new FormData();
        fd.append('file', image);
        await apiUpload(`/store/categories/${id}/image`, fd);
      }
      setCategoryDialog(null);
      await load();
    } finally {
      setCategoryBusy(false);
    }
  }

  async function uploadBanner(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const file = form.get('file') as File | null;
    if (!file?.size) return;
    const fd = new FormData();
    fd.append('file', file);
    fd.append('title', String(form.get('title') || ''));
    fd.append('subtitle', String(form.get('subtitle') || ''));
    await apiUpload('/store/banners', fd);
    event.currentTarget.reset();
    setBannerDialogOpen(false);
    await load();
  }

  async function saveColors() {
    setColorsBusy(true);
    try {
      await api('/store/themes/apply', {
        method: 'POST',
        body: JSON.stringify({ colors: draftColors }),
      });
      await load();
      setColorsOpen(false);
    } finally {
      setColorsBusy(false);
    }
  }

  async function moveProduct(productId: string, direction: -1 | 1) {
    const ids = moveId(products.map((p) => p.id), productId, direction);
    if (!ids) return;
    const next = await api<StoreProduct[]>('/products/reorder', { method: 'POST', body: JSON.stringify({ ids }) });
    setProducts(next);
  }

  async function moveCategory(categoryId: string, direction: -1 | 1) {
    const ids = moveId(categories.map((c) => c.id), categoryId, direction);
    if (!ids) return;
    const next = await api<StoreCategory[]>('/store/categories/reorder', { method: 'POST', body: JSON.stringify({ ids }) });
    setCategories(next);
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center gap-2 text-muted-foreground" dir="rtl">
        <Loader2 className="h-5 w-5 animate-spin" />
        {t('common.loading')}
      </div>
    );
  }

  if (error || !settings || !previewData) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6" dir="rtl">
        <p className="text-destructive">{error || 'تعذّر تحميل المتجر'}</p>
        <Button asChild variant="outline">
          <Link href="/ai/store">{t('common.back')}</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950">
      <div className="sticky top-0 z-[60] border-b border-white/10 bg-slate-950/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-3 py-2" dir="rtl">
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild size="sm" variant="ghost" className="text-white hover:bg-white/10 hover:text-white">
              <Link href="/ai/store">
                <ArrowLeft className="me-1 h-4 w-4" />
                {t('store.editorBack')}
              </Link>
            </Button>
            <span className="hidden text-sm text-white/70 sm:inline">{t('store.visualEditor')}</span>
            {!settings.isPublished ? (
              <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[11px] text-amber-200">
                {t('store.draftPreview')}
              </span>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                setDefaultCategoryId('');
                setEditing(null);
                setProductOpen(true);
              }}
            >
              <Plus className="me-1 h-4 w-4" />
              {t('store.addProduct')}
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setCategoryDialog({ name: '' })}>
              <Plus className="me-1 h-4 w-4" />
              {t('store.addCategory')}
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setBannerDialogOpen(true)}>
              <ImagePlus className="me-1 h-4 w-4" />
              {t('store.banners')}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                setDraftColors(settings.theme ?? DEFAULT_STORE_THEME);
                setColorsOpen(true);
              }}
            >
              <Palette className="me-1 h-4 w-4" />
              {t('store.colors')}
            </Button>
            <Button asChild size="sm" variant="outline" className="border-white/20 bg-transparent text-white hover:bg-white/10">
              <Link href="/ai/store">
                <Settings2 className="me-1 h-4 w-4" />
                {t('store.settings')}
              </Link>
            </Button>
            <Button asChild size="sm">
              <Link href={settings.storeUrl} target="_blank">
                <ExternalLink className="me-1 h-4 w-4" />
                {t('store.openStore')}
              </Link>
            </Button>
          </div>
        </div>
      </div>

      <PublicStorefront
        slug={settings.slug}
        mode="shop"
        editMode
        previewData={previewData}
        editHandlers={{
          onAddProduct: (categoryId) => {
            setDefaultCategoryId(categoryId || '');
            setEditing(null);
            setProductOpen(true);
          },
          onEditProduct: (productId) => {
            const product = products.find((p) => p.id === productId) || null;
            setEditing(product);
            setProductOpen(true);
          },
          onDuplicateProduct: async (productId) => {
            await api(`/products/${productId}/duplicate`, { method: 'POST' });
            await load();
          },
          onHideProduct: async (productId) => {
            const product = products.find((p) => p.id === productId);
            if (!product) return;
            await api(`/products/${productId}`, {
              method: 'PATCH',
              body: JSON.stringify({ isActive: product.isActive === false }),
            });
            await load();
          },
          onDeleteProduct: async (productId) => {
            if (!window.confirm(t('store.deleteProductConfirm'))) return;
            await api(`/products/${productId}`, { method: 'DELETE' });
            await load();
          },
          onMoveProduct: (productId, direction) => {
            void moveProduct(productId, direction);
          },
          onAddCategory: () => setCategoryDialog({ name: '' }),
          onEditCategory: (categoryId) => {
            const cat = categories.find((c) => c.id === categoryId);
            if (!cat) return;
            setCategoryDialog({ id: cat.id, name: cat.name });
          },
          onDuplicateCategory: async (categoryId) => {
            await api(`/store/categories/${categoryId}/duplicate`, { method: 'POST' });
            await load();
          },
          onHideCategory: async (categoryId) => {
            const cat = categories.find((c) => c.id === categoryId);
            if (!cat) return;
            await api(`/store/categories/${categoryId}`, {
              method: 'PATCH',
              body: JSON.stringify({ isActive: cat.isActive === false }),
            });
            await load();
          },
          onDeleteCategory: async (categoryId) => {
            if (!window.confirm(t('store.deleteCategoryConfirm'))) return;
            await api(`/store/categories/${categoryId}`, { method: 'DELETE' });
            await load();
          },
          onMoveCategory: (categoryId, direction) => {
            void moveCategory(categoryId, direction);
          },
          onEditBanners: () => setBannerDialogOpen(true),
          onOpenColors: () => {
            setDraftColors(settings.theme ?? DEFAULT_STORE_THEME);
            setColorsOpen(true);
          },
        }}
      />

      <ProductEditorDialog
        open={productOpen}
        product={editing}
        categories={categories}
        mediaUrls={mediaUrls}
        labels={editorLabels}
        defaultCategoryId={defaultCategoryId}
        onOpenChange={(open) => {
          setProductOpen(open);
          if (!open) {
            setEditing(null);
            setDefaultCategoryId('');
          }
        }}
        onSaved={async () => {
          await load();
        }}
      />

      <Dialog open={Boolean(categoryDialog)} onOpenChange={(open) => !open && setCategoryDialog(null)}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader className="text-right sm:text-right">
            <DialogTitle>{categoryDialog?.id ? t('store.saveCategory') : t('store.addCategory')}</DialogTitle>
            <DialogDescription className="text-right">{t('store.categoryName')}</DialogDescription>
          </DialogHeader>
          {categoryDialog ? (
            <form className="grid gap-3" onSubmit={saveCategory}>
              <div className="grid gap-1.5">
                <Label htmlFor="cat-name">{t('store.categoryName')}</Label>
                <Input id="cat-name" name="name" required defaultValue={categoryDialog.name} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="cat-image">{t('store.categoryImage')}</Label>
                <Input id="cat-image" name="image" type="file" accept="image/*" />
                {categoryDialog.id && catUrls[categoryDialog.id] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={catUrls[categoryDialog.id]} alt="" className="mt-1 h-28 w-full rounded-xl object-cover" />
                ) : null}
              </div>
              <DialogFooter className="gap-2 sm:justify-start">
                <Button type="submit" disabled={categoryBusy}>
                  {categoryBusy ? t('store.saving') : t('store.saveCategory')}
                </Button>
                <Button type="button" variant="outline" onClick={() => setCategoryDialog(null)}>
                  {t('common.cancel')}
                </Button>
              </DialogFooter>
            </form>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={bannerDialogOpen} onOpenChange={setBannerDialogOpen}>
        <DialogContent className="max-w-lg" dir="rtl">
          <DialogHeader className="text-right sm:text-right">
            <DialogTitle>{t('store.banners')}</DialogTitle>
            <DialogDescription className="text-right">{t('store.bannersDesc')}</DialogDescription>
          </DialogHeader>
          <form className="grid gap-3" onSubmit={uploadBanner}>
            <Input name="title" placeholder={t('store.bannerTitle')} />
            <Input name="subtitle" placeholder={t('store.bannerSubtitle')} />
            <Input name="file" type="file" accept="image/*" required />
            <Button type="submit">{t('store.addBanner')}</Button>
          </form>
          <div className="grid gap-2">
            {banners.map((banner) => (
              <div key={banner.id} className="flex items-center gap-3 rounded-xl border p-2">
                <div className="h-14 w-20 overflow-hidden rounded-lg bg-muted">
                  {bannerUrls[banner.id] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={bannerUrls[banner.id]} alt="" className="h-full w-full object-cover" />
                  ) : null}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{banner.title || '—'}</p>
                  <p className="truncate text-xs text-muted-foreground">{banner.subtitle}</p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  onClick={async () => {
                    await api(`/store/banners/${banner.id}`, { method: 'DELETE' });
                    await load();
                  }}
                >
                  {t('common.delete')}
                </Button>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={colorsOpen} onOpenChange={setColorsOpen}>
        <DialogContent className="max-w-lg" dir="rtl">
          <DialogHeader className="text-right sm:text-right">
            <DialogTitle>{t('store.colors')}</DialogTitle>
            <DialogDescription className="text-right">{t('store.colorsDesc')}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 sm:grid-cols-2">
            {STORE_THEME_PRESETS.map((preset) => (
              <button
                key={preset.key}
                type="button"
                className="rounded-xl border p-3 text-start"
                style={{ background: preset.colors.bg, color: preset.colors.text, borderColor: preset.colors.border }}
                onClick={() => setDraftColors(preset.colors)}
              >
                <p className="text-sm font-semibold">{locale === 'ar' ? preset.nameAr : preset.nameEn}</p>
                <span className="mt-2 inline-block rounded-full px-2 py-0.5 text-[11px]" style={{ background: preset.colors.accent, color: preset.colors.accentText }}>
                  Aa
                </span>
              </button>
            ))}
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {COLOR_FIELDS.map((field) => (
              <label key={field.key} className="grid gap-1 text-sm">
                <span>{locale === 'ar' ? field.labelAr : field.labelEn}</span>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(draftColors[field.key]) ? draftColors[field.key] : '#000000'}
                    onChange={(e) => setDraftColors((current) => ({ ...current, [field.key]: e.target.value }))}
                    className="h-10 w-12 cursor-pointer rounded border bg-transparent"
                  />
                  <Input
                    dir="ltr"
                    value={draftColors[field.key]}
                    onChange={(e) => setDraftColors((current) => ({ ...current, [field.key]: e.target.value }))}
                    className="font-mono text-xs"
                  />
                </div>
              </label>
            ))}
          </div>
          <DialogFooter className="gap-2 sm:justify-start">
            <Button type="button" disabled={colorsBusy} onClick={() => void saveColors()}>
              {colorsBusy ? t('store.saving') : t('store.applyColors')}
            </Button>
            <Button type="button" variant="outline" onClick={() => setColorsOpen(false)}>
              {t('common.cancel')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
