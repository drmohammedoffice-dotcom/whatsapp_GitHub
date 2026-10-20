'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { FileText, Copy, ExternalLink, FolderTree, Package, Palette, PencilRuler, Plus, Search, Settings2, Store, Trash2, Files } from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { PlanGate } from '@/components/billing/plan-gate';
import { useTranslation } from '@/components/providers/locale-provider';
import { PageHeader } from '@/components/shared/page-header';
import { ApplyProductColorsDialog } from '@/components/store/apply-product-colors-dialog';
import { ProductEditorDialog, type ProductColorOption, type StoreCategory, type StoreProduct } from '@/components/store/product-editor-dialog';
import { FlashLandingCopyEditor } from '@/components/store/flash-landing-copy-editor';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { STORE_THEME_PRESETS, type StoreThemeColors } from '@/lib/store-themes';
import { sanitizeBrowserMetaPixelId } from '@/lib/meta-pixel';
import { parseIqdAmount } from '@/lib/parse-iqd';
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
  themeKey?: string;
  theme?: StoreThemeColors;
};
type Movement = {
  id: string;
  delta: number;
  quantityAfter: number;
  reason: string;
  note?: string | null;
  createdAt: string;
  product: { id: string; name: string };
};
type CustomTheme = { id: string; name: string; colors: StoreThemeColors };
type StoreBanner = {
  id: string;
  title: string | null;
  subtitle: string | null;
  linkUrl: string | null;
  enabled: boolean;
};

function inStock(p: StoreProduct) {
  return !p.outOfStockManual && p.quantity > 0;
}

function toLocalInput(iso?: string | null) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const BLANK_COLORS: StoreThemeColors = {
  bg: '#020617',
  bgAlt: '#134e4a',
  text: '#f8fafc',
  muted: '#94a3b8',
  accent: '#10b981',
  accentText: '#022c22',
  card: '#0f172a',
  border: '#334155',
};

export default function StorePage() {
  const { t, locale } = useTranslation();
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [categories, setCategories] = useState<StoreCategory[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [customThemes, setCustomThemes] = useState<CustomTheme[]>([]);
  const [banners, setBanners] = useState<StoreBanner[]>([]);
  const [bannerUrls, setBannerUrls] = useState<Record<string, string>>({});
  const [q, setQ] = useState('');
  const [stock, setStock] = useState<'all' | 'in' | 'out'>('all');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState<StoreProduct | null>(null);
  const [open, setOpen] = useState(false);
  const [mediaUrls, setMediaUrls] = useState<Record<string, string>>({});
  const [catUrls, setCatUrls] = useState<Record<string, string>>({});
  const [draftColors, setDraftColors] = useState<StoreThemeColors>(BLANK_COLORS);
  const [pixelDraft, setPixelDraft] = useState('');
  const [pixelSaving, setPixelSaving] = useState(false);
  const [priceDraft, setPriceDraft] = useState('');
  const [compareDraft, setCompareDraft] = useState('');
  const [priceSaving, setPriceSaving] = useState(false);
  const [priceError, setPriceError] = useState<string | null>(null);
  const [sharedColors, setSharedColors] = useState<ProductColorOption[]>([]);
  const [sharedColorsOpen, setSharedColorsOpen] = useState(false);

  const load = useCallback(async () => {
    const qs = new URLSearchParams({ q, stock });
    if (categoryFilter) qs.set('categoryId', categoryFilter);
    const [list, store, log, cats, themes, slides, palette] = await Promise.all([
      api<StoreProduct[]>(`/products?${qs.toString()}`),
      api<Settings>('/store/settings'),
      api<Movement[]>('/store/stock'),
      api<StoreCategory[]>('/store/categories'),
      api<CustomTheme[]>('/store/themes'),
      api<StoreBanner[]>('/store/banners'),
      api<{ colors: ProductColorOption[] }>('/store/color-palette').catch(() => ({ colors: [] as ProductColorOption[] })),
    ]);
    setProducts(list);
    setSettings(store);
    setMovements(log);
    setCategories(cats);
    setCustomThemes(themes);
    setBanners(slides);
    setSharedColors(
      (palette.colors || []).map((c, index) => ({
        id: c.id || `c_${index + 1}`,
        name: c.name || '',
        hex: c.hex || '#000000',
        imageId: null,
      })),
    );
    if (store.theme) setDraftColors(store.theme);
  }, [q, stock, categoryFilter]);

  useEffect(() => {
    load().catch(console.error);
  }, [load]);

  useEffect(() => {
    if (!editing) return;
    const fresh = products.find((p) => p.id === editing.id);
    if (fresh) setEditing(fresh);
  }, [products, editing?.id]);

  useEffect(() => {
    let cancelled = false;
    const ids = products.flatMap((p) => p.images.map((m) => m.id));
    (async () => {
      const next: Record<string, string> = {};
      for (const id of ids) {
        try {
          next[id] = await fetchAuthedBlobUrl(`/store/media/${id}`);
        } catch {
          /* skip */
        }
      }
      if (!cancelled) {
        setMediaUrls((prev) => {
          Object.values(prev).forEach((u) => URL.revokeObjectURL(u));
          return next;
        });
      } else {
        Object.values(next).forEach((u) => URL.revokeObjectURL(u));
      }
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
        if (!cat.imageStorageKey && !(cat as { imageMimeType?: string }).imageMimeType) continue;
        try {
          next[cat.id] = await fetchAuthedBlobUrl(`/store/categories/${cat.id}/image`);
        } catch {
          /* no image */
        }
      }
      if (!cancelled) {
        setCatUrls((prev) => {
          Object.values(prev).forEach((u) => URL.revokeObjectURL(u));
          return next;
        });
      }
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
      if (!cancelled) {
        setBannerUrls((prev) => {
          Object.values(prev).forEach((u) => URL.revokeObjectURL(u));
          return next;
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [banners]);

  const filteredHint = useMemo(() => products.filter((p) => !inStock(p)).length, [products]);
  const landingProduct = useMemo(
    () => products.find((p) => p.metadata?.landingKey === 'flash-12-courses') || products.find((p) => p.metadata?.landingKey),
    [products],
  );

  useEffect(() => {
    if (!landingProduct) return;
    setPixelDraft(landingProduct.metadata?.metaPixelId || '');
  }, [landingProduct?.id, landingProduct?.metadata?.metaPixelId]);

  useEffect(() => {
    if (!landingProduct) return;
    setPriceDraft(String(landingProduct.metadata?.salePrice || landingProduct.unitPrice || ''));
    setCompareDraft(String(landingProduct.metadata?.compareAtPrice || ''));
  }, [landingProduct?.id, landingProduct?.unitPrice, landingProduct?.metadata?.salePrice, landingProduct?.metadata?.compareAtPrice]);
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
    hideQuantity: t('store.hideQuantity'),
    minOrderQuantity: t('store.minOrderQuantity'),
    minOrderQuantityHint: t('store.minOrderQuantityHint'),
    colorsTitle: t('store.colorsTitle'),
    colorsHint: t('store.colorsHint'),
    colorsNeedImages: t('store.colorsNeedImages'),
    addColor: t('store.addColor'),
    colorName: t('store.colorName'),
    colorSwatch: t('store.colorSwatch'),
    colorImage: t('store.colorImage'),
    colorImageOption: t('store.colorImageOption'),
    loadStoreColors: t('store.loadStoreColors'),
    applyColorsToProducts: t('store.applyColorsToProducts'),
    applyColorsTitle: t('store.applyColorsTitle'),
    applyColorsDesc: t('store.applyColorsDesc'),
    applyColorsAll: t('store.applyColorsAll'),
    applyColorsPick: t('store.applyColorsPick'),
    applyColorsSelectAll: t('store.applyColorsSelectAll'),
    applyColorsLinkByPosition: t('store.applyColorsLinkByPosition'),
    applyColorsSavePalette: t('store.applyColorsSavePalette'),
    applyColorsSubmit: t('store.applyColorsSubmit'),
    applyColorsClose: t('store.applyColorsClose'),
    applyColorsNeedColors: t('store.applyColorsNeedColors'),
    applyColorsNeedProducts: t('store.applyColorsNeedProducts'),
    applyColorsDone: t('store.applyColorsDone'),
    applyColorsNoOther: t('store.applyColorsNoOther'),
    applyColorsEmpty: t('store.applyColorsEmpty'),
    category: t('store.category'),
    noCategory: t('store.noCategory'),
    markOut: t('store.markOut'),
    media: t('store.media'),
    mediaHint: t('store.mediaHint'),
    save: t('store.save'),
    saving: t('store.saving'),
    imageFitTitle: t('store.imageFitTitle'),
    imageFitHint: t('store.imageFitHint'),
    imageFitMode: t('store.imageFitMode'),
    imageFitCover: t('store.imageFitCover'),
    imageFitContain: t('store.imageFitContain'),
    imageFitPosition: t('store.imageFitPosition'),
    imagePosCenter: t('store.imagePosCenter'),
    imagePosTop: t('store.imagePosTop'),
    imagePosBottom: t('store.imagePosBottom'),
    imagePosLeft: t('store.imagePosLeft'),
    imagePosRight: t('store.imagePosRight'),
    imageFitZoom: t('store.imageFitZoom'),
  };

  async function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!settings) return;
    const form = new FormData(event.currentTarget);
    const rates: Record<string, number> = {};
    for (const [key, value] of form.entries()) {
      if (typeof key === 'string' && key.startsWith('rate:') && typeof value === 'string') {
        const gov = key.slice(5);
        const num = Number(value);
        if (gov && Number.isFinite(num)) rates[gov] = num;
      }
    }
    const localEnd = String(form.get('promoEndsAt') || '');
    await api('/store/settings', {
      method: 'POST',
      body: JSON.stringify({
        brandName: form.get('brandName'),
        deliveryMode: form.get('deliveryMode'),
        deliveryFee: Number(form.get('deliveryFee') || 0),
        deliveryRates: rates,
        giftWhatsappPhone: form.get('giftWhatsappPhone'),
        defaultLocale: form.get('defaultLocale'),
        currency: form.get('currency'),
        isPublished: form.get('isPublished') === 'on',
        promoEnabled: form.get('promoEnabled') === 'on',
        promoText: String(form.get('promoText') || ''),
        promoEndsAt: localEnd ? new Date(localEnd).toISOString() : null,
      }),
    });
    const logo = form.get('logo') as File | null;
    if (logo?.size) {
      const fd = new FormData();
      fd.append('file', logo);
      await apiUpload('/store/logo', fd);
    }
    await load();
  }

  async function addCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const created = await api<StoreCategory>('/store/categories', {
      method: 'POST',
      body: JSON.stringify({ name: form.get('name') }),
    });
    const image = form.get('image') as File | null;
    if (image?.size) {
      const fd = new FormData();
      fd.append('file', image);
      await apiUpload(`/store/categories/${created.id}/image`, fd);
    }
    event.currentTarget.reset();
    await load();
  }

  return (
    <AppShell>
      <PlanGate feature="online_store">
        <PageHeader
          title={t('store.title')}
          description={t('store.description')}
          actions={(
            <div className="flex flex-wrap gap-2">
              <Button asChild>
                <Link href="/ai/store/editor">
                  <PencilRuler className="me-2 h-4 w-4" />
                  {t('store.visualEditor')}
                </Link>
              </Button>
              {settings?.storeUrl ? (
                <Button asChild variant="outline">
                  <Link href={settings.storeUrl} target="_blank">
                    <ExternalLink className="me-2 h-4 w-4" />
                    {t('store.openStore')}
                  </Link>
                </Button>
              ) : null}
            </div>
          )}
        />
        {filteredHint > 0 && (
          <div className="mb-4 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
            {filteredHint} {t('store.outOfStock')}
          </div>
        )}
        <Tabs defaultValue="products" className="mt-2">
          <TabsList className="mb-4 flex-wrap">
            <TabsTrigger value="products">
              <Package className="me-2 h-4 w-4" />
              {t('store.products')}
            </TabsTrigger>
            <TabsTrigger value="categories">
              <FolderTree className="me-2 h-4 w-4" />
              {t('store.categories')}
            </TabsTrigger>
            <TabsTrigger value="appearance">
              <Palette className="me-2 h-4 w-4" />
              {t('store.appearance')}
            </TabsTrigger>
            <TabsTrigger value="settings">
              <Settings2 className="me-2 h-4 w-4" />
              {t('store.settings')}
            </TabsTrigger>
            {landingProduct ? (
              <TabsTrigger value="landing">
                <FileText className="me-2 h-4 w-4" />
                صفحة الهبوط
              </TabsTrigger>
            ) : null}
            <TabsTrigger value="stock">
              <Store className="me-2 h-4 w-4" />
              {t('store.stockLog')}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="products">
            <Card className="mb-4 border-violet-500/30 shadow-card">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{t('store.sharedColorsTitle')}</CardTitle>
                <CardDescription>{t('store.sharedColorsDesc')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  {sharedColors.length === 0 ? (
                    <p className="text-sm text-muted-foreground">{t('store.applyColorsEmpty')}</p>
                  ) : (
                    sharedColors.map((c) => (
                      <span key={c.id} className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm">
                        <span className="h-4 w-4 rounded-full border" style={{ background: c.hex }} />
                        {c.name}
                      </span>
                    ))
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setSharedColors((prev) => [
                        ...prev,
                        { id: `c_${Date.now().toString(36)}`, name: '', hex: '#000000', imageId: null },
                      ])
                    }
                  >
                    <Plus className="me-1 h-3.5 w-3.5" />
                    {t('store.addColor')}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => setSharedColorsOpen(true)}
                    disabled={!sharedColors.some((c) => c.name.trim())}
                  >
                    <Copy className="me-1 h-3.5 w-3.5" />
                    {t('store.sharedColorsManage')}
                  </Button>
                </div>
                {sharedColors.length > 0 ? (
                  <div className="space-y-2">
                    {sharedColors.map((color, index) => (
                      <div key={color.id} className="grid gap-2 sm:grid-cols-[auto_1fr_auto]">
                        <input
                          type="color"
                          value={/^#([0-9a-fA-F]{6})$/.test(color.hex) ? color.hex : '#000000'}
                          onChange={(e) =>
                            setSharedColors((prev) => prev.map((c, i) => (i === index ? { ...c, hex: e.target.value } : c)))
                          }
                          className="h-10 w-12 cursor-pointer rounded border bg-transparent p-1"
                        />
                        <Input
                          value={color.name}
                          onChange={(e) =>
                            setSharedColors((prev) => prev.map((c, i) => (i === index ? { ...c, name: e.target.value } : c)))
                          }
                          placeholder={t('store.colorName')}
                        />
                        <Button
                          type="button"
                          size="icon"
                          variant="outline"
                          onClick={() => setSharedColors((prev) => prev.filter((_, i) => i !== index))}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : null}
              </CardContent>
            </Card>
            {landingProduct ? (
              <Card className="mb-4 border-amber-500/40 shadow-card">
                <CardHeader>
                  <CardTitle>سعر الفلاشة في صفحة الهبوط وإتمام الشراء</CardTitle>
                  <CardDescription>
                    هذا الرقم هو اللي يظهر للزبون في الصفحة وفي رسالة تم استلام الطلب. اكتب السعر بدون فاصلة، مثل 25000.
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="flash-sale-price">السعر الحالي (د.ع)</Label>
                    <Input id="flash-sale-price" dir="ltr" inputMode="numeric" value={priceDraft} onChange={(e) => setPriceDraft(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="flash-compare-price">السعر قبل الخصم (د.ع)</Label>
                    <Input id="flash-compare-price" dir="ltr" inputMode="numeric" value={compareDraft} onChange={(e) => setCompareDraft(e.target.value)} />
                  </div>
                  {priceError ? <p className="sm:col-span-2 text-sm text-red-600">{priceError}</p> : null}
                  <div className="sm:col-span-2">
                    <Button
                      type="button"
                      disabled={priceSaving}
                      onClick={async () => {
                        const price = parseIqdAmount(priceDraft);
                        if (!price) {
                          setPriceError('أدخل السعر الحالي بأرقام، مثل 25000');
                          return;
                        }
                        setPriceError(null);
                        setPriceSaving(true);
                        try {
                          await api(`/products/${landingProduct.id}`, {
                            method: 'PATCH',
                            body: JSON.stringify({
                              unitPrice: price,
                              metadata: {
                                ...(landingProduct.metadata || {}),
                                salePrice: price,
                                compareAtPrice: parseIqdAmount(compareDraft) || undefined,
                              },
                            }),
                          });
                          await load();
                        } catch (err) {
                          setPriceError(err instanceof Error ? err.message : 'تعذر حفظ السعر');
                        } finally {
                          setPriceSaving(false);
                        }
                      }}
                    >
                      {priceSaving ? t('store.saving') : 'حفظ سعر الفلاشة'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : null}
            {landingProduct ? (
              <Card className="mb-4 border-sky-500/40 shadow-card">
                <CardHeader>
                  <CardTitle>بكسل ميتا لصفحة الفلاشة</CardTitle>
                  <CardDescription>
                    لا تبحث عن كلمة ID داخل نافذة التعديل. الصق هنا كود مدير الإعلانات كاملاً أو الرقم الظاهر بعد fbq('init'). الصفحة:{' '}
                    <a className="underline" href={`/store/${landingProduct.metadata?.landingKey}`} target="_blank" rel="noreferrer">
                      /store/{landingProduct.metadata?.landingKey}
                    </a>
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-3">
                  <Label htmlFor="store-landing-meta-pixel">كود البكسل أو الرقم</Label>
                  <Textarea
                    id="store-landing-meta-pixel"
                    dir="ltr"
                    rows={6}
                    className="font-mono text-xs"
                    value={pixelDraft}
                    onChange={(e) => setPixelDraft(e.target.value)}
                    placeholder="<!-- Meta Pixel Code --> ... fbq('init', '...');"
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      disabled={pixelSaving}
                      onClick={async () => {
                        setPixelSaving(true);
                        try {
                          await api(`/products/${landingProduct.id}`, {
                            method: 'PATCH',
                            body: JSON.stringify({
                              metadata: {
                                ...(landingProduct.metadata || {}),
                                metaPixelId: sanitizeBrowserMetaPixelId(pixelDraft),
                              },
                            }),
                          });
                          await load();
                        } finally {
                          setPixelSaving(false);
                        }
                      }}
                    >
                      {pixelSaving ? t('store.saving') : 'حفظ بكسل ميتا'}
                    </Button>
                    {landingProduct.metadata?.metaPixelId ? (
                      <p className="text-sm text-emerald-700 dark:text-emerald-300">البكسل مربوط. افتح صفحة الهبوط ثم Events Manager.</p>
                    ) : (
                      <p className="text-sm text-muted-foreground">لم يُحفظ رقم بعد.</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            ) : null}
            <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center">
              <div className="relative flex-1">
                <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input className="ps-9" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('store.search')} />
              </div>
              <select className="h-10 rounded-lg border bg-background px-3 text-sm" value={stock} onChange={(e) => setStock(e.target.value as typeof stock)}>
                <option value="all">{t('store.filterAll')}</option>
                <option value="in">{t('store.filterIn')}</option>
                <option value="out">{t('store.filterOut')}</option>
              </select>
              <select className="h-10 rounded-lg border bg-background px-3 text-sm" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
                <option value="">{t('store.allCategories')}</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <Button
                onClick={() => {
                  setEditing(null);
                  setOpen(true);
                }}
              >
                <Plus className="h-4 w-4" />
                {t('store.addProduct')}
              </Button>
            </div>
            {products.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="py-16 text-center text-muted-foreground">{t('store.empty')}</CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {products.map((p) => {
                  const cover = p.images[0];
                  const ok = inStock(p);
                  const catName = categories.find((c) => c.id === p.categoryId)?.name;
                  return (
                    <Card key={p.id} className="overflow-hidden border-0 shadow-card">
                      <div className="relative aspect-[4/3] bg-muted">
                        {cover && mediaUrls[cover.id] ? (
                          cover.kind === 'VIDEO' ? (
                            <video src={mediaUrls[cover.id]} className="h-full w-full object-cover" muted />
                          ) : (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={mediaUrls[cover.id]} alt="" className="h-full w-full object-cover" />
                          )
                        ) : null}
                        <Badge className={`absolute end-3 top-3 ${ok ? 'bg-emerald-600' : 'bg-destructive'}`}>
                          {ok ? `${t('store.inStock')} · ${p.quantity}` : t('store.outOfStock')}
                        </Badge>
                      </div>
                      <CardHeader className="space-y-1">
                        <CardTitle className="text-lg">{p.name}</CardTitle>
                        {catName ? <Badge variant="secondary">{catName}</Badge> : null}
                        <CardDescription className="line-clamp-2">{p.description}</CardDescription>
                        <p className="text-base font-semibold">
                          {p.unitPrice.toLocaleString()} IQD
                        </p>
                        {p.metadata?.landingKey ? (
                          <a
                            href={`/store/${p.metadata.landingKey}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-sm text-primary underline-offset-2 hover:underline"
                          >
                            صفحة الهبوط
                          </a>
                        ) : null}
                        {p.metadata?.metaPixelId ? (
                          <p className="text-xs text-muted-foreground">Meta Pixel مربوط</p>
                        ) : null}
                      </CardHeader>
                      <CardContent className="flex gap-2">
                        <Button
                          variant="secondary"
                          className="flex-1"
                          onClick={() => {
                            setEditing(p);
                            setOpen(true);
                          }}
                        >
                          {t('store.editProduct')}
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          title={t('store.duplicateProduct')}
                          onClick={async () => {
                            await api(`/products/${p.id}/duplicate`, { method: 'POST' });
                            await load();
                          }}
                        >
                          <Files className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="destructive"
                          size="icon"
                          onClick={async () => {
                            if (!window.confirm(p.name)) return;
                            await api(`/products/${p.id}`, { method: 'DELETE' });
                            await load();
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="categories">
            <Card className="mb-4 border-0 shadow-card">
              <CardHeader>
                <CardTitle>{t('store.addCategory')}</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={addCategory} className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
                  <Input name="name" required placeholder={t('store.categoryName')} />
                  <Input name="image" type="file" accept="image/*" />
                  <Button type="submit">{t('store.saveCategory')}</Button>
                </form>
              </CardContent>
            </Card>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {categories.map((c) => (
                <Card key={c.id} className="overflow-hidden border-0 shadow-card">
                  <div className="aspect-[16/9] bg-muted">
                    {catUrls[c.id] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={catUrls[c.id]} alt="" className="h-full w-full object-cover" />
                    ) : null}
                  </div>
                  <CardContent className="space-y-3 pt-4">
                    <form
                      className="grid gap-2"
                      onSubmit={async (e) => {
                        e.preventDefault();
                        const form = new FormData(e.currentTarget);
                        await api(`/store/categories/${c.id}`, {
                          method: 'PATCH',
                          body: JSON.stringify({ name: form.get('name') }),
                        });
                        const image = form.get('image') as File | null;
                        if (image?.size) {
                          const fd = new FormData();
                          fd.append('file', image);
                          await apiUpload(`/store/categories/${c.id}/image`, fd);
                        }
                        await load();
                      }}
                    >
                      <Input name="name" defaultValue={c.name} />
                      <Input name="image" type="file" accept="image/*" />
                      <p className="text-xs text-muted-foreground">
                        {c._count?.products ?? 0} {t('store.products')}
                      </p>
                      <div className="flex gap-2">
                        <Button type="submit" className="flex-1" variant="secondary">
                          {t('store.saveCategory')}
                        </Button>
                        <Button
                          type="button"
                          variant="destructive"
                          size="icon"
                          onClick={async () => {
                            if (!window.confirm(t('store.deleteCategoryConfirm'))) return;
                            await api(`/store/categories/${c.id}`, { method: 'DELETE' });
                            await load();
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </form>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="appearance">
            <div className="grid gap-4">
              <Card className="border-0 shadow-card">
                <CardHeader>
                  <CardTitle>{t('store.presetThemes')}</CardTitle>
                  <CardDescription>{t('store.presetThemesDesc')}</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {STORE_THEME_PRESETS.map((theme) => (
                    <button
                      key={theme.key}
                      type="button"
                      onClick={async () => {
                        await api('/store/themes/apply', { method: 'POST', body: JSON.stringify({ themeKey: theme.key }) });
                        await load();
                      }}
                      className={`overflow-hidden rounded-xl border text-start ${settings?.themeKey === theme.key ? 'ring-2 ring-primary' : ''}`}
                    >
                      <div className="h-16" style={{ background: `linear-gradient(135deg, ${theme.colors.bgAlt}, ${theme.colors.bg})` }} />
                      <div className="flex items-center justify-between px-3 py-2">
                        <span className="text-sm font-medium">{locale === 'ar' ? theme.nameAr : theme.nameEn}</span>
                        <span className="h-4 w-4 rounded-full" style={{ background: theme.colors.accent }} />
                      </div>
                    </button>
                  ))}
                </CardContent>
              </Card>

              <Card className="border-0 shadow-card">
                <CardHeader>
                  <CardTitle>{t('store.customTheme')}</CardTitle>
                  <CardDescription>{t('store.customThemeDesc')}</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-3">
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {(Object.keys(BLANK_COLORS) as Array<keyof StoreThemeColors>).map((key) => {
                      const labelKey = {
                        bg: 'store.colorBg',
                        bgAlt: 'store.colorBgAlt',
                        text: 'store.colorText',
                        muted: 'store.colorMuted',
                        accent: 'store.colorAccent',
                        accentText: 'store.colorAccentText',
                        card: 'store.colorCard',
                        border: 'store.colorBorder',
                      }[key];
                      const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(draftColors[key]) ? draftColors[key] : '#10b981';
                      return (
                        <label key={key} className="space-y-1 text-xs">
                          <span className="text-muted-foreground">{t(labelKey)}</span>
                          <Input type="color" value={hex} onChange={(e) => setDraftColors((c) => ({ ...c, [key]: e.target.value }))} />
                        </label>
                      );
                    })}
                  </div>
                  <form
                    className="flex flex-col gap-2 sm:flex-row"
                    onSubmit={async (e) => {
                      e.preventDefault();
                      const form = new FormData(e.currentTarget);
                      const name = String(form.get('name') || t('store.customTheme'));
                      const created = await api<CustomTheme>('/store/themes', {
                        method: 'POST',
                        body: JSON.stringify({ name, colors: draftColors }),
                      });
                      await api('/store/themes/apply', {
                        method: 'POST',
                        body: JSON.stringify({ customThemeId: created.id, colors: draftColors }),
                      });
                      e.currentTarget.reset();
                      await load();
                    }}
                  >
                    <Input name="name" placeholder={t('store.themeName')} required className="sm:max-w-xs" />
                    <Button type="submit">{t('store.saveAndApplyTheme')}</Button>
                  </form>
                  <div className="grid gap-2">
                    {customThemes.map((theme) => (
                      <div key={theme.id} className="flex items-center justify-between rounded-lg border px-3 py-2">
                        <button
                          type="button"
                          className="text-sm font-medium"
                          onClick={async () => {
                            await api('/store/themes/apply', { method: 'POST', body: JSON.stringify({ customThemeId: theme.id }) });
                            await load();
                          }}
                        >
                          {theme.name}
                        </button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={async () => {
                            await api(`/store/themes/${theme.id}`, { method: 'DELETE' });
                            await load();
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-card">
                <CardHeader>
                  <CardTitle>{t('store.banners')}</CardTitle>
                  <CardDescription>{t('store.bannersDesc')}</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-3">
                  <form
                    className="grid gap-2 sm:grid-cols-2"
                    onSubmit={async (e) => {
                      e.preventDefault();
                      const form = e.currentTarget;
                      const fd = new FormData(form);
                      const file = fd.get('file');
                      if (!(file instanceof File) || !file.size) return;
                      await apiUpload('/store/banners', fd);
                      form.reset();
                      await load();
                    }}
                  >
                    <Input name="file" type="file" accept="image/*" required className="sm:col-span-2" />
                    <Input name="title" placeholder={t('store.bannerTitle')} />
                    <Input name="subtitle" placeholder={t('store.bannerSubtitle')} />
                    <Button type="submit" className="sm:col-span-2">
                      {t('store.addBanner')}
                    </Button>
                  </form>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {banners.map((banner) => (
                      <div key={banner.id} className="overflow-hidden rounded-xl border">
                        <div className="aspect-[16/7] bg-muted">
                          {bannerUrls[banner.id] ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={bannerUrls[banner.id]} alt="" className="h-full w-full object-cover" />
                          ) : null}
                        </div>
                        <div className="flex items-center justify-between gap-2 px-3 py-2">
                          <p className="truncate text-sm">{banner.title || '—'}</p>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={async () => {
                              await api(`/store/banners/${banner.id}`, { method: 'DELETE' });
                              await load();
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {landingProduct ? (
            <TabsContent value="landing">
              <FlashLandingCopyEditor product={landingProduct} onSaved={load} />
            </TabsContent>
          ) : null}

          <TabsContent value="settings">
            {settings && (
              <Card className="border-0 shadow-card">
                <CardHeader>
                  <CardTitle>{t('store.settings')}</CardTitle>
                  <CardDescription>{settings.storeUrl}</CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={saveSettings} className="grid gap-4">
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <Input readOnly value={settings.storeUrl} className="flex-1 dir-ltr text-start" />
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={async () => {
                          await navigator.clipboard.writeText(settings.storeUrl);
                          setCopied(true);
                          setTimeout(() => setCopied(false), 1500);
                        }}
                      >
                        <Copy className="h-4 w-4" />
                        {copied ? t('store.copied') : t('store.copyUrl')}
                      </Button>
                      <Button type="button" asChild variant="outline">
                        <Link href={settings.storeUrl} target="_blank">
                          <ExternalLink className="h-4 w-4" />
                          {t('store.openStore')}
                        </Link>
                      </Button>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label>{t('store.brandName')}</Label>
                        <Input name="brandName" defaultValue={settings.brandName} required />
                      </div>
                      <div className="space-y-2">
                        <Label>{t('store.currency')}</Label>
                        <Input name="currency" defaultValue={settings.currency} className="dir-ltr text-start font-mono" />
                      </div>
                      <div className="space-y-2">
                        <Label>{t('store.logo')}</Label>
                        <Input name="logo" type="file" accept="image/*" />
                      </div>
                      <div className="space-y-2">
                        <Label>{t('store.giftWhatsapp')}</Label>
                        <Input name="giftWhatsappPhone" defaultValue={settings.giftWhatsappPhone ?? ''} className="dir-ltr text-start font-mono" placeholder="9647…" />
                      </div>
                      <div className="space-y-2">
                        <Label>{t('store.deliveryMode')}</Label>
                        <select name="deliveryMode" defaultValue={settings.deliveryMode} className="h-10 w-full rounded-lg border bg-background px-3 text-sm">
                          <option value="FIXED">{t('store.deliveryFixed')}</option>
                          <option value="VARIABLE">{t('store.deliveryVariable')}</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <Label>{t('store.deliveryFee')}</Label>
                        <Input name="deliveryFee" type="number" min={0} step="1" lang="en" dir="ltr" className="dir-ltr text-start font-mono" defaultValue={settings.deliveryFee} />
                      </div>
                      <div className="space-y-2">
                        <Label>{t('store.locale')}</Label>
                        <select name="defaultLocale" defaultValue={settings.defaultLocale} className="h-10 w-full rounded-lg border bg-background px-3 text-sm">
                          <option value="ar">العربية</option>
                          <option value="en">English</option>
                        </select>
                      </div>
                      <label className="flex items-center gap-2 text-sm">
                        <input type="checkbox" name="isPublished" defaultChecked={settings.isPublished} />
                        {t('store.published')}
                      </label>
                    </div>
                    <div className="grid gap-3 rounded-xl border p-4">
                      <p className="font-medium">{t('store.promoTitle')}</p>
                      <label className="flex items-center gap-2 text-sm">
                        <input type="checkbox" name="promoEnabled" defaultChecked={settings.promoEnabled} />
                        {t('store.promoEnabled')}
                      </label>
                      <div className="space-y-2">
                        <Label>{t('store.promoText')}</Label>
                        <Textarea name="promoText" defaultValue={settings.promoText ?? ''} rows={2} />
                      </div>
                      <div className="space-y-2">
                        <Label>{t('store.promoEndsAt')}</Label>
                        <Input name="promoEndsAt" type="datetime-local" lang="en" dir="ltr" className="dir-ltr max-w-sm text-start font-mono" defaultValue={toLocalInput(settings.promoEndsAt)} />
                      </div>
                    </div>
                    <div className="grid gap-2 rounded-xl border p-3 md:grid-cols-2">
                      {(settings.governorates ?? []).map((gov) => (
                        <label key={gov} className="flex items-center gap-2 text-sm">
                          <span className="w-28 shrink-0">{gov}</span>
                          <Input name={`rate:${gov}`} type="number" min={0} lang="en" dir="ltr" className="dir-ltr font-mono" defaultValue={settings.deliveryRates?.[gov] ?? settings.deliveryFee} />
                        </label>
                      ))}
                    </div>
                    <Button type="submit">{t('store.saveSettings')}</Button>
                  </form>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="stock">
            <Card className="border-0 shadow-card">
              <CardContent className="divide-y p-0">
                {movements.map((m) => (
                  <div key={m.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                    <div>
                      <p className="font-medium">{m.product.name}</p>
                      <p className="text-muted-foreground">
                        {m.reason} · {m.note || '—'}
                      </p>
                    </div>
                    <div className="text-end">
                      <p className={m.delta < 0 ? 'text-destructive' : 'text-emerald-600'}>
                        {m.delta > 0 ? '+' : ''}
                        {m.delta}
                      </p>
                      <p className="text-xs text-muted-foreground">{m.quantityAfter}</p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <ProductEditorDialog
          open={open}
          product={editing}
          categories={categories}
          mediaUrls={mediaUrls}
          labels={editorLabels}
          allProducts={products}
          onOpenChange={setOpen}
          onSaved={load}
        />

        <ApplyProductColorsDialog
          open={sharedColorsOpen}
          products={products}
          colors={sharedColors}
          onOpenChange={setSharedColorsOpen}
          onDone={load}
          labels={{
            title: t('store.applyColorsTitle'),
            desc: t('store.applyColorsDesc'),
            applyAll: t('store.applyColorsAll'),
            pickProducts: t('store.applyColorsPick'),
            selectAll: t('store.applyColorsSelectAll'),
            linkByPosition: t('store.applyColorsLinkByPosition'),
            savePalette: t('store.applyColorsSavePalette'),
            apply: t('store.applyColorsSubmit'),
            close: t('store.applyColorsClose'),
            needColors: t('store.applyColorsNeedColors'),
            needProducts: t('store.applyColorsNeedProducts'),
            applied: t('store.applyColorsDone'),
            noOther: t('store.applyColorsNoOther'),
            emptyPalette: t('store.applyColorsEmpty'),
          }}
        />
      </PlanGate>
    </AppShell>
  );
}
