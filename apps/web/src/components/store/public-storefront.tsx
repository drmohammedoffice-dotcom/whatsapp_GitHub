'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, ChevronLeft, ChevronRight, EyeOff, MessageCircle, Minus, Pencil, Plus, Search, ShoppingBag } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { API_URL } from '@/lib/utils';
import { DEFAULT_STORE_THEME, type StoreThemeColors } from '@/lib/store-themes';
import { tiktokPixelInlineScript } from '@/lib/tiktok-pixel-script';

type Media = { id: string; kind: 'IMAGE' | 'VIDEO'; url: string };
export type PublicProductColor = {
  id: string;
  name: string;
  hex: string;
  imageId: string | null;
  imageUrl?: string | null;
};
export type PublicProduct = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  compareAtPrice?: number | null;
  currency: string;
  quantity: number;
  hideQuantity?: boolean;
  /** أقل كمية عند الإضافة للسلة (افتراضي 1) */
  minOrderQuantity?: number;
  inStock: boolean;
  categoryId: string | null;
  categoryName: string | null;
  media: Media[];
  colors?: PublicProductColor[];
  isActive?: boolean;
  /** داخل إطار البطاقة الثابت — لا يغيّر حجم الأيقونة الخارجية */
  imageObjectFit?: 'cover' | 'contain';
  imageObjectPosition?: string;
  imageZoom?: number;
};

export type StoreEditHandlers = {
  onEditProduct?: (productId: string) => void;
  onAddProduct?: (categoryId?: string) => void;
  onDuplicateProduct?: (productId: string) => void;
  onDeleteProduct?: (productId: string) => void;
  onHideProduct?: (productId: string) => void;
  onMoveProduct?: (productId: string, direction: -1 | 1) => void;
  onEditCategory?: (categoryId: string) => void;
  onAddCategory?: () => void;
  onDuplicateCategory?: (categoryId: string) => void;
  onDeleteCategory?: (categoryId: string) => void;
  onHideCategory?: (categoryId: string) => void;
  onMoveCategory?: (categoryId: string, direction: -1 | 1) => void;
  onEditBanners?: () => void;
  onOpenColors?: () => void;
};
export type PublicCategory = { id: string; name: string; imageUrl: string | null; isActive?: boolean };
export type PublicSettings = {
  slug: string;
  brandName: string;
  currency: string;
  defaultLocale: 'ar' | 'en';
  deliveryMode: string;
  deliveryFee: number;
  deliveryRates: Record<string, number>;
  giftWhatsappPhone: string | null;
  storeUrl: string;
  logoUrl: string | null;
  governorates: string[];
  promoEnabled?: boolean;
  promoEndsAt?: string | null;
  promoText?: string | null;
  theme?: StoreThemeColors;
  tiktokPixelCode?: string | null;
};
export type PublicBanner = {
  id: string;
  title: string | null;
  subtitle: string | null;
  linkUrl: string | null;
  imageUrl: string;
  imageObjectFit?: 'cover' | 'contain';
  imageObjectPosition?: string;
  imageZoom?: number;
};
export type PublicStore = {
  settings: PublicSettings;
  products: PublicProduct[];
  categories?: PublicCategory[];
  banners?: PublicBanner[];
  governorates: string[];
};

export type CartItem = { productId: string; quantity: number; colorId?: string | null; colorName?: string | null };

const copy = {
  ar: {
    cart: 'السلة',
    add: 'أضف للسلة',
    buyNow: 'شراء',
    out: 'نفدت الكمية',
    checkout: 'إتمام الطلب',
    empty: 'سلتك فارغة',
    phone: 'رقم الهاتف',
    gov: 'المحافظة',
    city: 'المدينة',
    landmark: 'أقرب نقطة دالة',
    complete: 'إكمال الطلب',
    gift: 'أرسله كهدية',
    giftWa: 'اضغط هنا وتواصل معنا إذا أردت إرسال المنتج كهدية',
    thanks: 'شكراً لك. طلبك قيد التجهيز بأقرب وقت.',
    items: 'المنتجات',
    subtotal: 'مجموع المنتجات',
    delivery: 'التوصيل',
    grand: 'المبلغ الإجمالي',
    total: 'الإجمالي',
    lang: 'English',
    remove: 'حذف',
    orderNo: 'رقم الطلب',
    all: 'الكل',
    days: 'يوم',
    hours: 'ساعة',
    minutes: 'دقيقة',
    seconds: 'ثانية',
    ended: 'انتهى العرض',
    search: 'ابحث عن منتج…',
    details: 'التفاصيل',
    back: 'العودة للمتجر',
    qty: 'الكمية',
    minQty: 'أقل كمية',
    available: 'متوفر',
    color: 'اللون',
    chooseColor: 'اختر اللون',
    chat: 'واتساب',
    similar: 'اقتراحات',
    noResults: 'لا توجد نتائج',
    shopByCategory: 'تسوق حسب القسم',
    newArrivals: 'وصل حديثاً',
    viewAll: 'عرض الكل',
    editHint: 'وضع التطوير — التعديلات تظهر مباشرة',
  },
  en: {
    cart: 'Cart',
    add: 'Add to cart',
    buyNow: 'Buy now',
    out: 'Out of stock',
    checkout: 'Checkout',
    empty: 'Your cart is empty',
    phone: 'Phone number',
    gov: 'Governorate',
    city: 'City',
    landmark: 'Nearest landmark',
    complete: 'Complete order',
    gift: 'Send as a gift',
    giftWa: 'Click here and contact us if you want to send the product as a gift',
    thanks: 'Thank you. Your order is being prepared shortly.',
    items: 'Items',
    subtotal: 'Items total',
    delivery: 'Delivery',
    grand: 'Grand total',
    total: 'Total',
    lang: 'العربية',
    remove: 'Remove',
    orderNo: 'Order number',
    all: 'All',
    days: 'd',
    hours: 'h',
    minutes: 'm',
    seconds: 's',
    ended: 'Offer ended',
    search: 'Search products…',
    details: 'Details',
    back: 'Back to store',
    qty: 'Qty',
    minQty: 'Min. qty',
    available: 'In stock',
    color: 'Color',
    chooseColor: 'Choose a color',
    chat: 'WhatsApp',
    similar: 'Suggestions',
    noResults: 'No results',
    shopByCategory: 'Shop by category',
    newArrivals: 'New arrivals',
    viewAll: 'View all',
    editHint: 'Builder mode — edits apply live',
  },
};

function productMinOrder(product: PublicProduct): number {
  const configured = Math.max(1, Math.floor(Number(product.minOrderQuantity) || 1) || 1);
  if (!product.quantity || product.quantity < 1) return configured;
  return Math.min(configured, product.quantity);
}

function discountPct(price: number, compareAt?: number | null) {
  if (!compareAt || compareAt <= price) return null;
  return Math.round(((compareAt - price) / compareAt) * 100);
}

function cartKey(slug: string) {
  return `chatloora.store.cart.${slug}`;
}

export function readCart(slug: string): CartItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(cartKey(slug));
    const parsed = raw ? (JSON.parse(raw) as CartItem[]) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function writeCart(slug: string, items: CartItem[]) {
  window.localStorage.setItem(cartKey(slug), JSON.stringify(items));
}

export function deliveryFee(settings: PublicSettings, governorate?: string) {
  if (settings.deliveryMode !== 'VARIABLE') return Number(settings.deliveryFee) || 0;
  const key = governorate?.trim() || '';
  if (key && settings.deliveryRates[key] != null) return Number(settings.deliveryRates[key]) || 0;
  return Number(settings.deliveryFee) || 0;
}

function flyToCart(source: HTMLElement, target: HTMLElement) {
  const from = source.getBoundingClientRect();
  const to = target.getBoundingClientRect();
  const ghost = source.cloneNode(true) as HTMLElement;
  ghost.style.cssText = [
    'position:fixed',
    `left:${from.left}px`,
    `top:${from.top}px`,
    `width:${from.width}px`,
    `height:${from.height}px`,
    'z-index:90',
    'pointer-events:none',
    'border-radius:18px',
    'object-fit:cover',
    'box-shadow:0 12px 40px rgba(0,0,0,.35)',
    'margin:0',
  ].join(';');
  document.body.appendChild(ghost);
  const dx = to.left + to.width / 2 - (from.left + from.width / 2);
  const dy = to.top + to.height / 2 - (from.top + from.height / 2);
  const anim = ghost.animate(
    [
      { transform: 'translate(0,0) scale(1)', opacity: 1 },
      { transform: `translate(${dx * 0.4}px, ${dy * 0.2 - 40}px) scale(0.7)`, opacity: 0.9, offset: 0.45 },
      { transform: `translate(${dx}px, ${dy}px) scale(0.12)`, opacity: 0.2 },
    ],
    { duration: 720, easing: 'cubic-bezier(.22,.9,.28,1)', fill: 'forwards' },
  );
  anim.finished.then(() => ghost.remove()).catch(() => ghost.remove());
}

function bannerImageStyle(banner: PublicBanner) {
  const objectFit = banner.imageObjectFit === 'contain' ? 'contain' : 'cover';
  const objectPosition = banner.imageObjectPosition || 'center';
  const zoom = Math.min(200, Math.max(50, banner.imageZoom || 100));
  const scale = zoom / 100;
  const origin =
    objectPosition === 'top'
      ? 'center top'
      : objectPosition === 'bottom'
        ? 'center bottom'
        : objectPosition === 'left'
          ? 'left center'
          : objectPosition === 'right'
            ? 'right center'
            : 'center center';
  return {
    objectFit: objectFit as 'cover' | 'contain',
    objectPosition,
    transform: scale !== 1 ? `scale(${scale})` : undefined,
    transformOrigin: origin,
  };
}

function BannerCarousel({ banners, accent }: { banners: PublicBanner[]; accent: string }) {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (banners.length < 2) return;
    const id = window.setInterval(() => setIndex((i) => (i + 1) % banners.length), 5200);
    return () => window.clearInterval(id);
  }, [banners.length]);
  if (!banners.length) return null;
  const current = banners[Math.min(index, banners.length - 1)]!;
  const imgStyle = bannerImageStyle(current);
  const inner = (
    <div className="relative aspect-[21/9] min-h-[160px] overflow-hidden rounded-3xl border shadow-xl sm:min-h-[220px]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={current.imageUrl} alt={current.title || ''} className="h-full w-full" style={imgStyle} />
      <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />
      {(current.title || current.subtitle) && (
        <div className="absolute inset-x-0 bottom-0 p-5">
          {current.title ? <p className="text-lg font-semibold text-white sm:text-2xl">{current.title}</p> : null}
          {current.subtitle ? <p className="mt-1 text-sm text-white/85">{current.subtitle}</p> : null}
        </div>
      )}
      {banners.length > 1 && (
        <div className="absolute inset-x-0 bottom-2 flex justify-center gap-1.5">
          {banners.map((item, i) => (
            <button
              key={item.id}
              type="button"
              aria-label={item.title || `banner ${i + 1}`}
              className="h-1.5 rounded-full transition-all"
              style={{ width: i === index ? 18 : 7, background: i === index ? accent : 'rgba(255,255,255,0.5)' }}
              onClick={(e) => {
                e.preventDefault();
                setIndex(i);
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
  if (current.linkUrl) {
    return (
      <a href={current.linkUrl} target="_blank" rel="noreferrer" className="mb-8 block">
        {inner}
      </a>
    );
  }
  return <div className="mb-8">{inner}</div>;
}

function MediaCarousel({
  media,
  accent,
  objectFit = 'cover',
  objectPosition = 'center',
  zoom = 100,
  activeMediaId,
}: {
  media: Media[];
  accent: string;
  objectFit?: 'cover' | 'contain';
  objectPosition?: string;
  zoom?: number;
  activeMediaId?: string | null;
}) {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (!activeMediaId) return;
    const next = media.findIndex((m) => m.id === activeMediaId);
    if (next >= 0) setIndex(next);
  }, [activeMediaId, media]);
  if (!media.length) return <div className="aspect-[4/3] bg-black/20" />;
  const current = media[Math.min(index, media.length - 1)]!;
  const go = (dir: number) => setIndex((i) => (i + dir + media.length) % media.length);
  const scale = Math.min(200, Math.max(50, zoom)) / 100;
  const origin =
    objectPosition === 'top'
      ? 'center top'
      : objectPosition === 'bottom'
        ? 'center bottom'
        : objectPosition === 'left'
          ? 'left center'
          : objectPosition === 'right'
            ? 'right center'
            : 'center center';
  const mediaStyle = {
    objectFit,
    objectPosition,
    transform: scale !== 1 ? `scale(${scale})` : undefined,
    transformOrigin: origin,
  } as const;
  return (
    <div className="relative aspect-[4/3] overflow-hidden bg-black/20">
      {current.kind === 'VIDEO' ? (
        <video
          src={current.url}
          className="h-full w-full"
          style={mediaStyle}
          muted
          playsInline
          controls={media.length === 1}
        />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={current.url} alt="" className="store-product-shot h-full w-full" style={mediaStyle} />
      )}
      {media.length > 1 && (
        <>
          <button type="button" className="absolute start-2 top-1/2 z-20 -translate-y-1/2 rounded-full bg-black/45 p-1.5" onClick={() => go(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button type="button" className="absolute end-2 top-1/2 z-20 -translate-y-1/2 rounded-full bg-black/45 p-1.5" onClick={() => go(1)}>
            <ChevronRight className="h-4 w-4" />
          </button>
          <div className="absolute inset-x-0 bottom-2 flex justify-center gap-1">
            {media.map((item, i) => (
              <button
                key={item.id}
                type="button"
                className="h-1.5 rounded-full"
                style={{ width: i === index ? 16 : 6, background: i === index ? accent : 'rgba(255,255,255,0.45)' }}
                onClick={() => setIndex(i)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function Countdown({ endsAt, labels }: { endsAt: string; labels: (typeof copy)['ar'] }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  const diff = new Date(endsAt).getTime() - now;
  if (!Number.isFinite(diff) || diff <= 0) return <p className="text-sm opacity-80">{labels.ended}</p>;
  const total = Math.floor(diff / 1000);
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const cell = (value: number, label: string) => (
    <div className="min-w-[3.5rem] rounded-2xl bg-black/25 px-2 py-2 text-center">
      <p className="font-mono text-xl font-bold tabular-nums">{String(value).padStart(2, '0')}</p>
      <p className="text-[10px] opacity-80">{label}</p>
    </div>
  );
  return (
    <div className="flex flex-wrap justify-center gap-2">
      {cell(days, labels.days)}
      {cell(hours, labels.hours)}
      {cell(minutes, labels.minutes)}
      {cell(seconds, labels.seconds)}
    </div>
  );
}

export function PublicStorefront({
  slug,
  mode,
  productId,
  editMode = false,
  previewData,
  editHandlers,
}: {
  slug: string;
  mode: 'shop' | 'checkout' | 'product';
  productId?: string;
  editMode?: boolean;
  previewData?: PublicStore | null;
  editHandlers?: StoreEditHandlers;
}) {
  const [data, setData] = useState<PublicStore | null>(previewData ?? null);
  const [error, setError] = useState<string | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [locale, setLocale] = useState<'ar' | 'en'>('ar');
  const [done, setDone] = useState<string | null>(null);
  const [giftOpen, setGiftOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [categoryId, setCategoryId] = useState<string>('');
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [actionMenu, setActionMenu] = useState<null | { kind: 'product' | 'category'; id: string }>(null);
  const [selectedColorId, setSelectedColorId] = useState<string | null>(null);
  const [detailQty, setDetailQty] = useState(1);
  const cartFabRef = useRef<HTMLAnchorElement>(null);
  const router = useRouter();

  useEffect(() => {
    setSelectedColorId(null);
  }, [productId]);

  useEffect(() => {
    if (mode !== 'product' || !productId || !data) return;
    const product = data.products.find((p) => p.id === productId);
    if (!product) return;
    setDetailQty(productMinOrder(product));
    if (!product.colors?.length) return;
    setSelectedColorId((current) => {
      if (current && product.colors!.some((c) => c.id === current)) return current;
      return product.colors![0]!.id;
    });
  }, [mode, productId, data]);

  useEffect(() => {
    if (!actionMenu) return;
    const close = () => setActionMenu(null);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, [actionMenu]);

  useEffect(() => {
    if (previewData) {
      setData(previewData);
      setLocale(previewData.settings.defaultLocale === 'en' ? 'en' : 'ar');
      setError(null);
      return;
    }
    fetch(`${API_URL}/api/v1/store/public/${encodeURIComponent(slug)}`)
      .then(async (r) => {
        if (!r.ok) throw new Error('Store not found');
        return r.json() as Promise<PublicStore>;
      })
      .then((store) => {
        setData(store);
        setLocale(store.settings.defaultLocale === 'en' ? 'en' : 'ar');
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Error'));
    setCart(readCart(slug));
    try {
      const ttclid = new URLSearchParams(window.location.search).get('ttclid');
      if (ttclid) sessionStorage.setItem('ttclid', ttclid);
    } catch {
      /* ignore */
    }
  }, [slug, previewData]);

  useEffect(() => {
    const code = data?.settings.tiktokPixelCode?.trim();
    if (!code || typeof document === 'undefined') return;
    if (document.getElementById('tiktok-pixel-store')) return;
    const script = document.createElement('script');
    script.id = 'tiktok-pixel-store';
    script.text = tiktokPixelInlineScript(code, ['PageView']);
    document.head.appendChild(script);
  }, [data?.settings.tiktokPixelCode]);

  const t = copy[locale];
  const dir = locale === 'ar' ? 'rtl' : 'ltr';

  const persist = useCallback(
    (items: CartItem[]) => {
      setCart(items);
      writeCart(slug, items);
    },
    [slug],
  );

  useEffect(() => {
    if (!data?.products?.length || !cart.length) return;
    let changed = false;
    const next = cart
      .map((item) => {
        const product = data.products.find((p) => p.id === item.productId);
        if (!product) return item;
        const min = productMinOrder(product);
        const qty = Math.min(product.quantity, Math.max(min, item.quantity));
        if (qty !== item.quantity) {
          changed = true;
          return { ...item, quantity: qty };
        }
        return item;
      })
      .filter((item) => {
        const product = data.products.find((p) => p.id === item.productId);
        if (!product || !product.inStock || product.quantity < productMinOrder(product)) {
          changed = true;
          return false;
        }
        return true;
      });
    if (changed) persist(next);
  }, [data, cart, persist]);

  const lines = useMemo(() => {
    if (!data) return [];
    return cart
      .map((item) => {
        const product = data.products.find((p) => p.id === item.productId);
        if (!product) return null;
        return { ...item, product };
      })
      .filter(Boolean) as Array<CartItem & { product: PublicProduct }>;
  }, [cart, data]);

  const subtotal = lines.reduce((sum, line) => sum + line.product.price * line.quantity, 0);
  const cartCount = cart.reduce((n, i) => n + i.quantity, 0);

  function sameCartLine(a: CartItem, productId: string, colorId?: string | null) {
    return a.productId === productId && (a.colorId || null) === (colorId || null);
  }

  function add(
    product: PublicProduct,
    origin?: HTMLElement | null,
    color?: { id: string; name: string } | null,
    amount?: number,
  ) {
    if (!product.inStock) return;
    const min = productMinOrder(product);
    if (product.quantity < min) return;
    const colorId = color?.id || null;
    const colorName = color?.name || null;
    const existing = cart.find((c) => sameCartLine(c, product.id, colorId));
    const qty = existing
      ? existing.quantity + (amount != null ? Math.max(1, Math.floor(Number(amount) || 1)) : 1)
      : Math.min(product.quantity, Math.max(min, Math.floor(Number(amount) || min)));
    if (qty > product.quantity || qty < min) return;
    persist(
      existing
        ? cart.map((c) => (sameCartLine(c, product.id, colorId) ? { ...c, quantity: qty, colorName } : c))
        : [...cart, { productId: product.id, quantity: qty, colorId, colorName }],
    );
    const target = cartFabRef.current;
    if (origin && target) flyToCart(origin, target);
  }

  function buyNow(product: PublicProduct, color?: { id: string; name: string } | null, amount?: number) {
    if (!product.inStock) return;
    const min = productMinOrder(product);
    if (product.quantity < min) return;
    const colorId = color?.id || null;
    const colorName = color?.name || null;
    const existing = cart.find((c) => sameCartLine(c, product.id, colorId));
    const startQty = Math.min(product.quantity, Math.max(min, Math.floor(Number(amount) || min)));
    const next = existing
      ? cart.map((c) =>
          sameCartLine(c, product.id, colorId)
            ? {
                ...c,
                quantity: Math.min(product.quantity, Math.max(min, amount != null ? startQty : c.quantity)),
                colorName,
              }
            : c,
        )
      : [...cart, { productId: product.id, quantity: startQty, colorId, colorName }];
    persist(next);
    router.push(`/s/${slug}/checkout`);
  }

  function ItemActionMenu({
    open,
    onToggle,
    onEdit,
    onDuplicate,
    onHide,
    onDelete,
    hidden,
  }: {
    open: boolean;
    onToggle: () => void;
    onEdit?: () => void;
    onDuplicate?: () => void;
    onHide?: () => void;
    onDelete?: () => void;
    hidden?: boolean;
  }) {
    return (
      <div className="absolute inset-0 z-20" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className="absolute inset-0"
          aria-label="خيارات التحرير"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onToggle();
          }}
        />
        {hidden ? (
          <span className="pointer-events-none absolute start-2 top-2 rounded-full bg-amber-500/90 px-2 py-0.5 text-[10px] font-semibold text-black">
            مخفي
          </span>
        ) : null}
        {open ? (
          <div
            className="absolute end-2 top-2 z-30 min-w-[9.5rem] overflow-hidden rounded-xl border bg-white text-slate-900 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button type="button" className="flex w-full items-center gap-2 px-3 py-2.5 text-start text-sm hover:bg-slate-100" onClick={() => { onEdit?.(); setActionMenu(null); }}>
              <Pencil className="h-3.5 w-3.5" /> تعديل
            </button>
            <button type="button" className="flex w-full items-center gap-2 px-3 py-2.5 text-start text-sm hover:bg-slate-100" onClick={() => { onDuplicate?.(); setActionMenu(null); }}>
              <Plus className="h-3.5 w-3.5" /> تكرار
            </button>
            <button type="button" className="flex w-full items-center gap-2 px-3 py-2.5 text-start text-sm hover:bg-slate-100" onClick={() => { onHide?.(); setActionMenu(null); }}>
              <EyeOff className="h-3.5 w-3.5" /> {hidden ? 'إظهار' : 'إخفاء مؤقتاً'}
            </button>
            <button type="button" className="flex w-full items-center gap-2 px-3 py-2.5 text-start text-sm text-rose-600 hover:bg-rose-50" onClick={() => { onDelete?.(); setActionMenu(null); }}>
              حذف
            </button>
          </div>
        ) : null}
      </div>
    );
  }

  if (error) {
    return (
      <div dir="rtl" className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-200">
        {error}
      </div>
    );
  }
  if (!data) {
    return (
      <div dir="rtl" className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-400">
        …
      </div>
    );
  }

  const settings = data.settings;
  const theme = settings.theme ?? DEFAULT_STORE_THEME;
  const govList = data.governorates?.length ? data.governorates : settings.governorates;
  const visible = categoryId ? data.products.filter((p) => p.categoryId === categoryId) : data.products;
  const showPromo = Boolean(settings.promoEnabled && settings.promoEndsAt);
  const q = query.trim().toLowerCase();
  const suggestions = q
    ? data.products
        .filter((p) => `${p.name} ${p.description || ''} ${p.categoryName || ''}`.toLowerCase().includes(q))
        .slice(0, 8)
    : [];
  const waPhone = (settings.giftWhatsappPhone || '').replace(/[^\d]/g, '');
  const waHref = waPhone
    ? `https://wa.me/${waPhone}?text=${encodeURIComponent(locale === 'ar' ? `مرحباً، أود الاستفسار من متجر ${settings.brandName}` : `Hi, I’d like to ask about ${settings.brandName}`)}`
    : null;
  const detail = mode === 'product' ? data.products.find((p) => p.id === productId) : undefined;
  const activeColor =
    detail?.colors?.length && selectedColorId
      ? detail.colors.find((c) => c.id === selectedColorId) || null
      : null;

  const arrivals = (!categoryId ? data.products : visible).slice(0, 12);
  const catalog = categoryId ? visible : data.products;

  return (
    <div
      dir={dir}
      className="min-h-screen pb-28"
      style={{
        background: `radial-gradient(circle at top, ${theme.bgAlt} 0%, ${theme.bg} 46%)`,
        color: theme.text,
      }}
    >
      {editMode ? (
        <div className="sticky top-0 z-50 border-b px-4 py-2 text-center text-sm font-medium" style={{ background: theme.accent, color: theme.accentText, borderColor: theme.border }}>
          {t.editHint}
        </div>
      ) : null}
      <header className="sticky top-0 z-20 border-b backdrop-blur" style={{ borderColor: theme.border, background: `${theme.bg}cc`, top: editMode ? 40 : 0 }}>
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <Link href={`/s/${slug}`} className="flex items-center gap-3">
            {settings.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={settings.logoUrl} alt="" className="h-10 w-10 rounded-full object-cover" />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-full" style={{ background: `${theme.accent}33`, color: theme.accent }}>
                {settings.brandName.slice(0, 1)}
              </div>
            )}
            <div>
              <p className="font-semibold">{settings.brandName}</p>
              <p className="text-xs" style={{ color: theme.muted }}>
                {t.cart}: {cartCount}
              </p>
            </div>
          </Link>
          {mode === 'shop' && (
            <div className="relative order-last w-full sm:order-none sm:max-w-md sm:flex-1">
              <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 opacity-60" />
              <input
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setSearchOpen(true);
                }}
                onFocus={() => setSearchOpen(true)}
                onBlur={() => window.setTimeout(() => setSearchOpen(false), 180)}
                placeholder={t.search}
                className="w-full rounded-full border py-2.5 pe-4 ps-10 text-sm outline-none"
                style={{ borderColor: theme.border, background: theme.card, color: theme.text }}
              />
              {searchOpen && q && (
                <div className="absolute inset-x-0 top-[calc(100%+6px)] z-30 overflow-hidden rounded-2xl border shadow-2xl" style={{ borderColor: theme.border, background: theme.card }}>
                  {suggestions.length === 0 ? (
                    <p className="px-4 py-3 text-sm" style={{ color: theme.muted }}>
                      {t.noResults}
                    </p>
                  ) : (
                    suggestions.map((product) => (
                      <Link
                        key={product.id}
                        href={`/s/${slug}/p/${product.id}`}
                        className="flex items-center gap-3 px-3 py-2 hover:bg-black/15"
                      >
                        <div className="h-12 w-12 overflow-hidden rounded-xl bg-black/20">
                          {product.media[0]?.kind === 'IMAGE' ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={product.media[0].url}
                              alt=""
                              className="h-full w-full"
                              style={{
                                objectFit: product.imageObjectFit || 'cover',
                                objectPosition: product.imageObjectPosition || 'center',
                                transform:
                                  (product.imageZoom || 100) !== 100
                                    ? `scale(${Math.min(200, Math.max(50, product.imageZoom || 100)) / 100})`
                                    : undefined,
                              }}
                            />
                          ) : null}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium">{product.name}</p>
                          <p className="text-xs" style={{ color: theme.accent }}>
                            {product.price.toLocaleString()} {product.currency}
                          </p>
                        </div>
                      </Link>
                    ))
                  )}
                </div>
              )}
            </div>
          )}
          <div className="flex items-center gap-2">
            <button type="button" className="rounded-full border px-3 py-1 text-xs" style={{ borderColor: theme.border }} onClick={() => setLocale(locale === 'ar' ? 'en' : 'ar')}>
              {t.lang}
            </button>
            {mode === 'shop' ? (
              <Link href={`/s/${slug}/checkout`} className="hidden rounded-full px-4 py-2 text-sm font-medium sm:inline-flex" style={{ background: theme.accent, color: theme.accentText }}>
                {t.checkout}
              </Link>
            ) : null}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">
        {mode === 'shop' && editMode ? (
          <div className="mb-3 flex justify-start">
            <button
              type="button"
              onClick={() => editHandlers?.onEditBanners?.()}
              className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold shadow-md"
              style={{ background: theme.accent, color: theme.accentText }}
            >
              <Pencil className="h-3.5 w-3.5" /> إدارة البنر
            </button>
          </div>
        ) : null}
        {mode === 'shop' && <BannerCarousel banners={data.banners ?? []} accent={theme.accent} />}

        {mode === 'shop' && showPromo && (
          <section className="mb-8 rounded-3xl border px-5 py-6 text-center" style={{ borderColor: theme.border, background: theme.card }}>
            <p className="mb-4 text-lg font-semibold">{settings.promoText || ' '}</p>
            <Countdown endsAt={settings.promoEndsAt!} labels={t} />
          </section>
        )}

        {mode === 'shop' && (
          <section className="mb-10">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-xl font-semibold sm:text-2xl">{t.shopByCategory}</h2>
              {editMode ? (
                <button
                  type="button"
                  onClick={() => editHandlers?.onAddCategory?.()}
                  className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold"
                  style={{ background: theme.accent, color: theme.accentText }}
                >
                  <Plus className="h-3.5 w-3.5" /> قسم
                </button>
              ) : null}
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {(data.categories ?? []).map((cat) => (
                <div
                  key={cat.id}
                  className={`group relative overflow-hidden rounded-2xl border shadow-lg ${cat.isActive === false ? 'opacity-55' : ''}`}
                  style={{ borderColor: theme.border, background: theme.card }}
                >
                  <button
                    type="button"
                    className="block w-full text-start"
                    onClick={() => {
                      if (editMode) {
                        setActionMenu((current) => (current?.kind === 'category' && current.id === cat.id ? null : { kind: 'category', id: cat.id }));
                        return;
                      }
                      setCategoryId(cat.id === categoryId ? '' : cat.id);
                    }}
                  >
                    <div className="relative aspect-[4/5] overflow-hidden bg-black/20">
                      {cat.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={cat.imageUrl} alt="" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
                      ) : (
                        <div className="flex h-full items-center justify-center text-3xl font-bold opacity-40">{cat.name.slice(0, 1)}</div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                      <p className="absolute inset-x-0 bottom-0 p-3 text-sm font-semibold text-white sm:text-base">{cat.name}</p>
                    </div>
                  </button>
                  {editMode ? (
                    <ItemActionMenu
                      open={actionMenu?.kind === 'category' && actionMenu.id === cat.id}
                      hidden={cat.isActive === false}
                      onToggle={() => setActionMenu((current) => (current?.kind === 'category' && current.id === cat.id ? null : { kind: 'category', id: cat.id }))}
                      onEdit={() => editHandlers?.onEditCategory?.(cat.id)}
                      onDuplicate={() => editHandlers?.onDuplicateCategory?.(cat.id)}
                      onHide={() => editHandlers?.onHideCategory?.(cat.id)}
                      onDelete={() => editHandlers?.onDeleteCategory?.(cat.id)}
                    />
                  ) : null}
                </div>
              ))}
              {!editMode && !(data.categories?.length) ? (
                <p className="col-span-full text-sm" style={{ color: theme.muted }}>{t.noResults}</p>
              ) : null}
            </div>
            {(data.categories?.length ?? 0) > 0 ? (
              <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
                <button
                  type="button"
                  onClick={() => setCategoryId('')}
                  className="shrink-0 rounded-full px-4 py-1.5 text-xs"
                  style={{ background: !categoryId ? theme.accent : theme.card, color: !categoryId ? theme.accentText : theme.text, border: `1px solid ${theme.border}` }}
                >
                  {t.all}
                </button>
                {data.categories!.map((cat) => (
                  <button
                    key={`chip-${cat.id}`}
                    type="button"
                    onClick={() => setCategoryId(cat.id)}
                    className="shrink-0 rounded-full px-4 py-1.5 text-xs"
                    style={{
                      background: categoryId === cat.id ? theme.accent : theme.card,
                      color: categoryId === cat.id ? theme.accentText : theme.text,
                      border: `1px solid ${theme.border}`,
                    }}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>
            ) : null}
          </section>
        )}

        {mode === 'shop' && (
          <section className="mb-4">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-xl font-semibold sm:text-2xl">{categoryId ? (data.categories?.find((c) => c.id === categoryId)?.name || t.items) : t.newArrivals}</h2>
              <div className="flex items-center gap-2">
                {editMode ? (
                  <button
                    type="button"
                    onClick={() => editHandlers?.onAddProduct?.(categoryId || undefined)}
                    className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold"
                    style={{ background: theme.accent, color: theme.accentText }}
                  >
                    <Plus className="h-3.5 w-3.5" /> منتج
                  </button>
                ) : (
                  <button type="button" className="text-sm underline-offset-4 hover:underline" style={{ color: theme.accent }} onClick={() => setCategoryId('')}>
                    {t.viewAll}
                  </button>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
              {(categoryId ? catalog : arrivals).map((product) => {
                const pct = discountPct(product.price, product.compareAtPrice);
                return (
                  <article
                    key={product.id}
                    className={`group relative overflow-hidden rounded-2xl border shadow-lg transition-transform duration-200 hover:-translate-y-0.5 ${product.isActive === false ? 'opacity-55' : ''}`}
                    style={{ borderColor: theme.border, background: theme.card }}
                    onClick={() => {
                      if (!editMode) return;
                      setActionMenu((current) => (current?.kind === 'product' && current.id === product.id ? null : { kind: 'product', id: product.id }));
                    }}
                  >
                    {!editMode ? <Link href={`/s/${slug}/p/${product.id}`} className="absolute inset-0 z-[5]" aria-label={product.name} /> : null}
                    <div className="relative">
                      <MediaCarousel
                        media={product.media}
                        accent={theme.accent}
                        objectFit={product.imageObjectFit}
                        objectPosition={product.imageObjectPosition}
                        zoom={product.imageZoom}
                      />
                      {pct ? (
                        <span className="absolute start-2 top-2 z-10 rounded-md bg-rose-600 px-2 py-0.5 text-[11px] font-bold text-white">
                          {pct}%
                        </span>
                      ) : null}
                      {editMode ? (
                        <ItemActionMenu
                          open={actionMenu?.kind === 'product' && actionMenu.id === product.id}
                          hidden={product.isActive === false}
                          onToggle={() => setActionMenu((current) => (current?.kind === 'product' && current.id === product.id ? null : { kind: 'product', id: product.id }))}
                          onEdit={() => editHandlers?.onEditProduct?.(product.id)}
                          onDuplicate={() => editHandlers?.onDuplicateProduct?.(product.id)}
                          onHide={() => editHandlers?.onHideProduct?.(product.id)}
                          onDelete={() => editHandlers?.onDeleteProduct?.(product.id)}
                        />
                      ) : null}
                    </div>
                    <div className="relative z-10 space-y-1.5 p-3 pointer-events-none">
                      <h3 className="line-clamp-2 min-h-[2.5rem] text-sm font-semibold leading-snug">{product.name}</h3>
                      <div className="flex flex-wrap items-baseline gap-2">
                        <p className="text-base font-bold" style={{ color: theme.accent }}>
                          {product.price.toLocaleString()} {product.currency === 'IQD' ? 'د.ع' : product.currency}
                        </p>
                        {product.compareAtPrice && product.compareAtPrice > product.price ? (
                          <p className="text-xs line-through opacity-60">
                            {product.compareAtPrice.toLocaleString()}
                          </p>
                        ) : null}
                      </div>
                      {!editMode ? (
                        <div className="pointer-events-auto relative z-20 mt-1 grid grid-cols-2 gap-1.5">
                          <button
                            type="button"
                            disabled={!product.inStock}
                            onClick={(e) => {
                              const card = e.currentTarget.closest('article');
                              add(product, card?.querySelector('.store-product-shot') as HTMLElement | null);
                            }}
                            className="rounded-xl border py-2 text-[11px] font-semibold disabled:opacity-40 sm:text-xs"
                            style={{ borderColor: theme.border, color: theme.text, background: theme.card }}
                          >
                            {product.inStock ? t.add : t.out}
                          </button>
                          <button
                            type="button"
                            disabled={!product.inStock}
                            onClick={() => buyNow(product)}
                            className="rounded-xl py-2 text-[11px] font-semibold disabled:opacity-40 sm:text-xs"
                            style={{ background: theme.accent, color: theme.accentText }}
                          >
                            {t.buyNow}
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => editHandlers?.onEditProduct?.(product.id)}
                          className="pointer-events-auto relative z-20 mt-1 w-full rounded-xl border py-2 text-xs font-semibold"
                          style={{ borderColor: theme.border, color: theme.text }}
                        >
                          تعديل
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
            {!arrivals.length && !catalog.length ? (
              <p className="mt-6 text-center text-sm" style={{ color: theme.muted }}>{t.noResults}</p>
            ) : null}
          </section>
        )}

        {mode === 'product' && (
          detail ? (
            <div className="space-y-4">
              <Link
                href={`/s/${slug}`}
                className="sticky top-16 z-10 inline-flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3.5 text-base font-bold shadow-lg sm:w-auto sm:justify-start"
                style={{ background: theme.accent, color: theme.accentText }}
              >
                <ArrowRight className="h-5 w-5 shrink-0 rtl:rotate-0 ltr:rotate-180" />
                {t.back}
              </Link>
              <div className="grid gap-6 lg:grid-cols-[1.1fr_.9fr]">
                <div className="overflow-hidden rounded-3xl border shadow-xl" style={{ borderColor: theme.border, background: theme.card }}>
                  <MediaCarousel
                    media={detail.media}
                    accent={theme.accent}
                    objectFit={detail.imageObjectFit}
                    objectPosition={detail.imageObjectPosition}
                    zoom={detail.imageZoom}
                    activeMediaId={activeColor?.imageId || null}
                  />
                </div>
                <div className="space-y-4 rounded-3xl border p-6" style={{ borderColor: theme.border, background: theme.card }}>
                  <p className="text-xs" style={{ color: theme.muted }}>
                    {detail.categoryName}
                  </p>
                  <h1 className="text-3xl font-semibold">{detail.name}</h1>
                  <p className="whitespace-pre-wrap text-sm leading-7" style={{ color: theme.muted }}>
                    {detail.description}
                  </p>
                  <p className="text-2xl font-bold" style={{ color: theme.accent }}>
                    {detail.price.toLocaleString()} {detail.currency}
                  </p>
                  {detail.inStock ? (
                    detail.hideQuantity ? (
                      <p className="text-sm" style={{ color: theme.muted }}>
                        {t.available}
                      </p>
                    ) : (
                      <p className="text-sm" style={{ color: theme.muted }}>
                        {t.qty}: {detail.quantity}
                      </p>
                    )
                  ) : (
                    <p className="text-sm" style={{ color: theme.muted }}>
                      {t.out}
                    </p>
                  )}
                  {detail.inStock && productMinOrder(detail) > 1 ? (
                    <p className="text-sm font-medium" style={{ color: theme.accent }}>
                      {t.minQty}: {productMinOrder(detail)}
                    </p>
                  ) : null}
                  {detail.colors && detail.colors.length > 0 ? (
                    <div className="space-y-2">
                      <p className="text-sm font-medium">
                        {t.color}
                        {activeColor ? (
                          <span className="ms-2 font-normal" style={{ color: theme.muted }}>
                            — {activeColor.name}
                          </span>
                        ) : (
                          <span className="ms-2 font-normal" style={{ color: theme.muted }}>
                            — {t.chooseColor}
                          </span>
                        )}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {detail.colors.map((color) => {
                          const selected = activeColor?.id === color.id;
                          return (
                            <button
                              key={color.id}
                              type="button"
                              onClick={() => setSelectedColorId(color.id)}
                              className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition"
                              style={{
                                borderColor: selected ? theme.accent : theme.border,
                                background: selected ? `${theme.accent}18` : theme.card,
                                color: theme.text,
                                boxShadow: selected ? `0 0 0 1px ${theme.accent}` : undefined,
                              }}
                              title={color.name}
                            >
                              <span
                                className="h-5 w-5 rounded-full border border-black/15 shadow-sm"
                                style={{ background: color.hex }}
                                aria-hidden
                              />
                              <span>{color.name}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}
                  {detail.inStock ? (
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium">{t.qty}</span>
                      <div className="flex items-center gap-1 rounded-full border px-1 py-1" style={{ borderColor: theme.border }}>
                        <button
                          type="button"
                          aria-label="decrease"
                          disabled={detailQty <= productMinOrder(detail)}
                          className="flex h-9 w-9 items-center justify-center rounded-full disabled:opacity-40"
                          style={{ background: `${theme.accent}22`, color: theme.accent }}
                          onClick={() => setDetailQty((q) => Math.max(productMinOrder(detail), q - 1))}
                        >
                          <Minus className="h-4 w-4" />
                        </button>
                        <span className="min-w-10 text-center font-mono text-base tabular-nums">{detailQty}</span>
                        <button
                          type="button"
                          aria-label="increase"
                          disabled={detailQty >= detail.quantity}
                          className="flex h-9 w-9 items-center justify-center rounded-full disabled:opacity-40"
                          style={{ background: theme.accent, color: theme.accentText }}
                          onClick={() => setDetailQty((q) => Math.min(detail.quantity, q + 1))}
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ) : null}
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      disabled={
                        !detail.inStock ||
                        detail.quantity < productMinOrder(detail) ||
                        (Boolean(detail.colors?.length) && !activeColor)
                      }
                      onClick={(e) => {
                        const shot = e.currentTarget.closest('div')?.parentElement?.querySelector('.store-product-shot') as HTMLElement | null;
                        add(detail, shot, activeColor ? { id: activeColor.id, name: activeColor.name } : null, detailQty);
                      }}
                      className="rounded-2xl border py-3 text-sm font-semibold disabled:opacity-40"
                      style={{ borderColor: theme.border, color: theme.text, background: theme.card }}
                    >
                      {detail.inStock ? t.add : t.out}
                    </button>
                    <button
                      type="button"
                      disabled={
                        !detail.inStock ||
                        detail.quantity < productMinOrder(detail) ||
                        (Boolean(detail.colors?.length) && !activeColor)
                      }
                      onClick={() =>
                        buyNow(detail, activeColor ? { id: activeColor.id, name: activeColor.name } : null, detailQty)
                      }
                      className="rounded-2xl py-3 text-sm font-semibold disabled:opacity-40"
                      style={{ background: theme.accent, color: theme.accentText }}
                    >
                      {t.buyNow}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <p>{t.noResults}</p>
          )
        )}

        {mode === 'checkout' && (
          <CheckoutPanel
            slug={slug}
            t={t}
            settings={settings}
            theme={theme}
            lines={lines}
            subtotal={subtotal}
            govList={govList}
            persist={persist}
            done={done}
            setDone={setDone}
            giftOpen={giftOpen}
            setGiftOpen={setGiftOpen}
            busy={busy}
            setBusy={setBusy}
          />
        )}
      </main>

      {!editMode ? (
        <div className="pointer-events-none fixed inset-x-0 bottom-5 z-40 flex justify-center px-4">
          <div className="pointer-events-auto flex items-center gap-3">
            {waHref ? (
              <a
                href={waHref}
                target="_blank"
                rel="noreferrer"
                className="flex h-14 w-14 items-center justify-center rounded-full shadow-2xl"
                style={{ background: '#25D366', color: '#fff' }}
                aria-label={t.chat}
              >
                <MessageCircle className="h-6 w-6" />
              </a>
            ) : null}
            <Link
              ref={cartFabRef}
              href={`/s/${slug}/checkout`}
              className="relative flex h-14 w-14 items-center justify-center rounded-full shadow-2xl"
              style={{ background: theme.accent, color: theme.accentText }}
              aria-label={t.cart}
            >
              <ShoppingBag className="h-6 w-6" />
              {cartCount > 0 ? (
                <span className="absolute -end-1 -top-1 min-w-5 rounded-full bg-white px-1 text-center text-[11px] font-bold text-black">
                  {cartCount}
                </span>
              ) : null}
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function CheckoutPanel({
  slug,
  t,
  settings,
  theme,
  lines,
  subtotal,
  govList,
  persist,
  done,
  setDone,
  giftOpen,
  setGiftOpen,
  busy,
  setBusy,
}: {
  slug: string;
  t: (typeof copy)['ar'];
  settings: PublicSettings;
  theme: StoreThemeColors;
  lines: Array<CartItem & { product: PublicProduct }>;
  subtotal: number;
  govList: string[];
  persist: (items: CartItem[]) => void;
  done: string | null;
  setDone: (v: string | null) => void;
  giftOpen: boolean;
  setGiftOpen: (v: boolean) => void;
  busy: boolean;
  setBusy: (v: boolean) => void;
}) {
  const [gov, setGov] = useState(govList[0] || '');
  const ship = deliveryFee(settings, gov);
  const total = subtotal + ship;
  const field = 'w-full rounded-2xl border px-4 py-3';
  const summaryText = lines
    .map((l) => {
      const label = l.colorName ? `${l.product.name} (${l.colorName})` : l.product.name;
      return `${label} × ${l.quantity} = ${l.product.price * l.quantity} ${settings.currency}`;
    })
    .concat([`${t.delivery}: ${ship} ${settings.currency}`, `${t.total}: ${total} ${settings.currency}`])
    .join('\n');

  async function complete(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!lines.length) return;
    setBusy(true);
    try {
      const form = new FormData(event.currentTarget);
      const res = await fetch(`${API_URL}/api/v1/store/public/${encodeURIComponent(slug)}/checkout`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          items: lines.map((l) => ({
            productId: l.productId,
            quantity: l.quantity,
            colorId: l.colorId || undefined,
            colorName: l.colorName || undefined,
          })),
          phone: String(form.get('phone') || ''),
          governorate: String(form.get('governorate') || gov),
          city: String(form.get('city') || ''),
          landmark: String(form.get('landmark') || ''),
          ttclid: typeof window !== 'undefined'
            ? (new URLSearchParams(window.location.search).get('ttclid')
              || sessionStorage.getItem('ttclid')
              || undefined)
            : undefined,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as { orderNumber?: string; message?: string | string[] };
      if (!res.ok) {
        const message = Array.isArray(json.message) ? json.message.join(', ') : json.message;
        throw new Error(message || 'Failed');
      }
      persist([]);
      setDone(json.orderNumber || 'OK');
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Error');
    } finally {
      setBusy(false);
    }
  }

  const phone = (settings.giftWhatsappPhone || '').replace(/[^\d]/g, '');
  const wa = `https://wa.me/${phone}?text=${encodeURIComponent(summaryText)}`;
  const box = { borderColor: theme.border, background: theme.card };

  if (done) {
    return (
      <div className="mx-auto max-w-lg rounded-3xl border p-8 text-center" style={box}>
        <p className="text-xl font-semibold">{t.thanks}</p>
        <p className="mt-2 text-sm" style={{ color: theme.accent }}>
          {t.orderNo}: {done}
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1.1fr_.9fr]">
      <section className="rounded-3xl border p-5" style={box}>
        <h1 className="mb-4 text-xl font-semibold">{t.items}</h1>
        {lines.length === 0 ? (
          <p style={{ color: theme.muted }}>{t.empty}</p>
        ) : (
          <ul className="space-y-3">
            {lines.map((line) => {
              const colorMedia = line.colorId
                ? line.product.media.find((m) => m.id === line.product.colors?.find((c) => c.id === line.colorId)?.imageId)
                : null;
              const thumb = colorMedia || line.product.media.find((m) => m.kind === 'IMAGE') || line.product.media[0];
              const lineKey = `${line.productId}:${line.colorId || ''}`;
              const sameLine = (l: CartItem) =>
                l.productId === line.productId && (l.colorId || null) === (line.colorId || null);
              return (
                <li key={lineKey} className="flex items-center gap-3 rounded-2xl bg-black/20 p-3">
                  <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-black/30">
                    {thumb?.kind === 'IMAGE' ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={thumb.url} alt="" className="h-full w-full object-cover" />
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{line.product.name}</p>
                    {line.colorName ? (
                      <p className="mt-0.5 flex items-center gap-1.5 text-xs" style={{ color: theme.muted }}>
                        <span
                          className="inline-block h-3 w-3 rounded-full border border-white/30"
                          style={{
                            background:
                              line.product.colors?.find((c) => c.id === line.colorId)?.hex || '#888',
                          }}
                        />
                        {line.colorName}
                      </p>
                    ) : null}
                    <p className="text-sm" style={{ color: theme.muted }}>
                      {line.product.price.toLocaleString()} {settings.currency}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <div className="flex items-center gap-1 rounded-full border px-1 py-1" style={{ borderColor: theme.border }}>
                      <button
                        type="button"
                        aria-label="decrease"
                        className="flex h-8 w-8 items-center justify-center rounded-full"
                        style={{ background: `${theme.accent}22`, color: theme.accent }}
                        onClick={() => {
                          const min = productMinOrder(line.product);
                          const qty = line.quantity - 1;
                          if (qty < min) {
                            persist(lines.filter((l) => !sameLine(l)));
                            return;
                          }
                          persist(lines.map((l) => (sameLine(l) ? { ...l, quantity: qty } : l)));
                        }}
                      >
                        <Minus className="h-4 w-4" />
                      </button>
                      <span className="min-w-8 text-center font-mono text-sm tabular-nums">{line.quantity}</span>
                      <button
                        type="button"
                        aria-label="increase"
                        disabled={line.quantity >= line.product.quantity}
                        className="flex h-8 w-8 items-center justify-center rounded-full disabled:opacity-40"
                        style={{ background: theme.accent, color: theme.accentText }}
                        onClick={() => {
                          const qty = Math.min(line.product.quantity, line.quantity + 1);
                          persist(lines.map((l) => (sameLine(l) ? { ...l, quantity: qty } : l)));
                        }}
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                    <button type="button" className="text-xs text-red-300" onClick={() => persist(lines.filter((l) => !sameLine(l)))}>
                      {t.remove}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        <dl className="mt-6 space-y-2 border-t pt-4 text-sm" style={{ borderColor: theme.border }}>
          <div className="flex justify-between">
            <dt>{t.subtotal}</dt>
            <dd>
              {subtotal.toLocaleString()} {settings.currency}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt>{t.delivery}</dt>
            <dd>
              {ship.toLocaleString()} {settings.currency}
            </dd>
          </div>
          <div className="flex justify-between text-base font-semibold" style={{ color: theme.accent }}>
            <dt>{t.grand}</dt>
            <dd>
              {total.toLocaleString()} {settings.currency}
            </dd>
          </div>
        </dl>
      </section>

      <form onSubmit={complete} className="space-y-3 rounded-3xl border p-5" style={box}>
        <input name="phone" required placeholder={t.phone} dir="ltr" className={`${field} text-start font-mono`} style={{ borderColor: theme.border, background: theme.bg }} />
        <select name="governorate" value={gov} onChange={(e) => setGov(e.target.value)} className={field} style={{ borderColor: theme.border, background: theme.bg }}>
          {govList.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
        <input name="city" required placeholder={t.city} className={field} style={{ borderColor: theme.border, background: theme.bg }} />
        <input name="landmark" placeholder={t.landmark} className={field} style={{ borderColor: theme.border, background: theme.bg }} />
        <button type="submit" disabled={busy || !lines.length} className="w-full rounded-2xl py-3 font-semibold disabled:opacity-40" style={{ background: theme.accent, color: theme.accentText }}>
          {t.complete}
        </button>
        {phone ? (
          <a
            href={wa}
            target="_blank"
            rel="noreferrer"
            className="block w-full rounded-2xl border py-3 text-center text-sm font-medium underline-offset-2 hover:underline"
            style={{ borderColor: theme.accent, color: theme.accent, background: `${theme.accent}14` }}
          >
            {t.giftWa}
          </a>
        ) : (
          <button type="button" onClick={() => setGiftOpen(true)} className="w-full rounded-2xl border py-3 font-medium" style={{ borderColor: theme.accent, color: theme.accent }}>
            {t.giftWa}
          </button>
        )}
        {giftOpen && !phone ? <p className="text-center text-xs text-amber-200">رقم واتساب الهدايا غير مضبوط في إعدادات المتجر</p> : null}
      </form>
    </div>
  );
}
