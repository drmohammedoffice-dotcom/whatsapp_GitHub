'use client';

import { FormEvent, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import {
  AlertTriangle,
  BadgePercent,
  Check,
  ChevronDown,
  Clock3,
  Gift,
  HardDrive,
  Headphones,
  MapPin,
  Phone,
  ShieldCheck,
  Sparkles,
  Truck,
  XCircle,
} from 'lucide-react';
import { API_URL } from '@/lib/utils';
import { initMetaPixel, trackMeta } from '@/lib/meta-pixel';
import {
  FLASH_DEFAULT_TESTIMONIALS,
  fillLandingVars,
  mergeLandingCopy,
} from './flash-landing-data';
import { CourseBrands } from './course-brands';
import type { StoreThemeColors } from '@/lib/store-themes';

const FALLBACK_THEME: StoreThemeColors = {
  bg: '#071428',
  bgAlt: '#134e4a',
  text: '#f8fafc',
  muted: '#cbd5e1',
  accent: '#fbbf24',
  accentText: '#071428',
  card: 'rgba(255,255,255,0.06)',
  border: 'rgba(255,255,255,0.12)',
};

const LANDING_WA = '9647864314333';

export type LandingPayload = {
  key: string;
  storeSlug: string;
  brandName: string;
  currency: string;
  promoEndsAt: string;
  metaPixelId?: string | null;
  theme?: StoreThemeColors;
  whatsappPhone?: string | null;
  copy?: Record<string, unknown> | null;
  testimonials: Array<{ name: string; text: string; stars: number; date?: string; photoUrl?: string | null }>;
  product: {
    id: string;
    name: string;
    description: string | null;
    price: number;
    originalPrice: number | null;
    discount: number;
    storageGb: string;
    deliveryFee: number;
    inStock: boolean;
    media: Array<{ id: string; kind: string; url: string }>;
  };
};

function iqd(n: number) {
  return `${Math.round(n).toLocaleString('en-US')} د.ع`;
}

function useCountdown(iso: string) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);
  const end = new Date(iso).getTime();
  const diff = Math.max(0, end - now);
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  const seconds = Math.floor((diff % 60000) / 1000);
  return { days, hours, minutes, seconds, expired: diff <= 0 };
}

function pad(n: number) {
  return String(n).padStart(2, '0');
}

function waDigits(raw?: string | null) {
  const digits = String(raw || '').replace(/\D/g, '');
  if (digits.length >= 10) return digits.startsWith('964') ? digits : digits.replace(/^0/, '964');
  return LANDING_WA;
}

function Cta({ onClick, children, className = '' }: { onClick: () => void; children: ReactNode; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-5 py-3 text-sm font-bold shadow-lg transition hover:opacity-90 sm:px-6 sm:py-3.5 sm:text-base ${className}`}
      style={{ background: 'var(--lp-accent)', color: 'var(--lp-accent-text)' }}
    >
      {children}
    </button>
  );
}

const FLASH_DEMO_VIDEO_IDS = ['SjiEAdU35M0', 'FpVB-3GaDeY'] as const;

function YoutubeAutoplayEmbed({ videoId, title }: { videoId: string; title: string }) {
  const box = useRef<HTMLDivElement>(null);
  const [play, setPlay] = useState(false);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setPlay(true);
      },
      { threshold: 0.4, rootMargin: '0px 0px -8% 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  const src = `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&mute=1&playsinline=1&rel=0&modestbranding=1`;
  return (
    <article>
      <h3 className="mb-3 text-center text-sm font-semibold sm:text-base" style={{ color: 'var(--lp-accent)' }}>
        {title}
      </h3>
      <div
        ref={box}
        className="aspect-video overflow-hidden rounded-2xl bg-black shadow-xl ring-1 ring-[color:var(--lp-border)]"
      >
        {play ? (
          <iframe
            title={title}
            src={src}
            className="h-full w-full border-0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-sm" style={{ color: 'var(--lp-muted)' }}>
            الفيديو يشتغل لما توصل لهون
          </div>
        )}
      </div>
    </article>
  );
}

function WhatsAppFab({ phone, productName }: { phone: string; productName: string }) {
  const href = `https://wa.me/${phone}?text=${encodeURIComponent(`مرحبا، أريد أسأل عن ${productName}`)}`;
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      aria-label="واتساب"
      className="fixed bottom-24 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg shadow-black/30 ring-2 ring-white/20 md:bottom-6"
      style={{ insetInlineStart: '1rem' }}
    >
      <svg viewBox="0 0 24 24" className="h-7 w-7 fill-current" aria-hidden>
        <path d="M12.04 2C6.5 2 2 6.4 2 11.86c0 1.75.46 3.45 1.34 4.95L2 22l5.35-1.4a10.2 10.2 0 0 0 4.69 1.13h.01c5.54 0 10.04-4.4 10.04-9.86C22.08 6.4 17.58 2 12.04 2zm5.84 14.13c-.24.67-1.4 1.23-1.93 1.31-.5.07-1.13.1-1.83-.12-.42-.13-.96-.31-1.66-.61-2.92-1.26-4.82-4.2-4.97-4.4-.15-.2-1.2-1.6-1.2-3.05 0-1.45.76-2.16 1.03-2.46.26-.29.58-.37.77-.37.19 0 .38 0 .54.01.18.01.41-.07.64.49.24.58.82 2 .89 2.15.07.15.12.32.02.52-.1.2-.15.32-.3.5-.15.17-.31.39-.44.52-.15.15-.3.31-.13.6.15.29.68 1.12 1.46 1.82 1 .9 1.84 1.18 2.13 1.31.29.13.46.11.63-.07.18-.17.73-.85.93-1.14.19-.29.39-.24.64-.14.26.1 1.63.77 1.91.91.28.13.47.2.54.31.07.12.07.67-.17 1.34z" />
      </svg>
    </a>
  );
}

export function FlashLanding({ initial }: { initial: LandingPayload | null }) {
  const [data, setData] = useState(initial);
  const [open, setOpen] = useState(false);
  const [faq, setFaq] = useState<number | null>(0);
  const [openCourse, setOpenCourse] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{
    orderNumber: string;
    productName: string;
    total: number;
    currency: string;
  } | null>(null);
  const [idem] = useState(() => (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `k-${Date.now()}`));
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [name, setName] = useState('');
  const gallery = useMemo(() => {
    const apiImages = (data?.product.media || []).filter((m) => m.kind !== 'VIDEO').map((m) => m.url);
    const fallback = ['/store/flash-12-courses/hero-dark.jpg', '/store/flash-12-courses/hero-light.jpg'];
    return apiImages.length ? apiImages : fallback;
  }, [data]);
  const hero = gallery[0] || '/store/flash-12-courses/hero-dark.jpg';
  const count = useCountdown(data?.promoEndsAt || new Date(Date.now() + 259200000).toISOString());
  const reviews: Array<{ name: string; text: string; stars: number; date?: string; photoUrl?: string | null }> = data?.testimonials?.length
    ? data.testimonials
    : FLASH_DEFAULT_TESTIMONIALS;
  const theme = data?.theme || FALLBACK_THEME;
  const copy = mergeLandingCopy(data?.copy);
  const waPhone = waDigits(data?.whatsappPhone);
  const lpVars = {
    '--lp-bg': theme.bg,
    '--lp-bg-alt': theme.bgAlt,
    '--lp-text': theme.text,
    '--lp-muted': theme.muted,
    '--lp-accent': theme.accent,
    '--lp-accent-text': theme.accentText,
    '--lp-card': theme.card,
    '--lp-border': theme.border,
    } as CSSProperties;

  useEffect(() => {
    if (!data?.metaPixelId) return;
    initMetaPixel(data.metaPixelId);
    trackMeta('ViewContent', {
      content_name: data.product.name,
      content_ids: [data.product.id],
      content_type: 'product',
      value: data.product.price,
      currency: data.currency || 'IQD',
    });
  }, [data?.metaPixelId, data?.product.id, data?.product.name, data?.product.price, data?.currency]);

  useEffect(() => {
    fetch(`${API_URL}/api/v1/store/public/landing/flash-12-courses`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((row) => {
        if (row) setData(row);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!count.expired) return;
    fetch(`${API_URL}/api/v1/store/public/landing/flash-12-courses`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((row) => {
        if (row) setData(row);
      })
      .catch(() => undefined);
  }, [count.expired]);

  function goOrder() {
    setOpen(true);
    trackMeta('InitiateCheckout', {
      content_name: data?.product.name,
      content_ids: data?.product.id ? [data.product.id] : undefined,
      content_type: 'product',
      value: data?.product.price,
      currency: data?.currency || 'IQD',
    });
    requestAnimationFrame(() => document.getElementById('flash-order')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/api/v1/store/public/landing/flash-12-courses/checkout`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ phone, address, name: name || undefined, idempotencyKey: idem }),
      });
      const json = await res.json().catch(
        () =>
          ({}) as {
            message?: string | string[];
            orderNumber?: string;
            productName?: string;
            price?: number;
            originalPrice?: number;
            total?: number;
            currency?: string;
          },
      );
      if (!res.ok) {
        const raw = json.message;
        const message = Array.isArray(raw) ? raw[0] : raw;
        throw new Error(message || 'تعذر إرسال الطلب. تحقق من البيانات وحاول مرة أخرى.');
      }
      const paid = Number(json.total ?? json.price ?? data?.product.price);
      setSuccess({
        orderNumber: json.orderNumber,
        productName: json.productName || data?.product.name || 'فلاشة ذهبية – 12 دورة احترافية',
        total: Number.isFinite(paid) ? paid : Number(data?.product.price) || 0,
        currency: json.currency || 'IQD',
      });
      if (Number.isFinite(Number(json.price))) {
        setData((prev) =>
          prev
            ? {
                ...prev,
                product: {
                  ...prev.product,
                  price: Number(json.price),
                  originalPrice: json.originalPrice ?? prev.product.originalPrice,
                },
              }
            : prev,
        );
      }
      trackMeta(
        'Purchase',
        {
          content_name: json.productName || data?.product.name,
          content_ids: data?.product.id ? [data.product.id] : undefined,
          content_type: 'product',
          value: Number.isFinite(paid) ? paid : json.total,
          currency: json.currency || 'IQD',
        },
        json.orderNumber ? `flash-${json.orderNumber}` : undefined,
      );
      setOpen(false);
      if (typeof window !== 'undefined') {
        window.history.replaceState(null, '', '/store/flash-12-courses#order-ok');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر إرسال الطلب.');
    } finally {
      setSubmitting(false);
    }
  }

  if (!data) {
    return (
      <div dir="rtl" className="flex min-h-screen items-center justify-center px-6 text-center" style={{ ...lpVars, background: theme.bg, color: theme.text }}>
        <p className="max-w-md text-lg text-white/80">{copy.unavailable}</p>
      </div>
    );
  }

  const price = data.product.price;
  const original = data.product.originalPrice;
  const save = original && original > price ? original - price : 0;
  const pct = original && original > 0 ? Math.round((save / original) * 100) : 0;
  const vars = {
    price: iqd(price),
    original: original ? iqd(original) : '',
    compare: original ? ` بدل ${iqd(original)}` : '',
    compareBar: original ? `كان ${iqd(original)} · ` : '',
    save: save > 0 ? iqd(save) : '',
    pct: String(pct),
  };
  const tx = (s: string) => fillLandingVars(s, vars);

  if (success) {
    return (
      <div dir="rtl" className="flex min-h-screen items-center justify-center px-4 py-16" style={{ ...lpVars, background: theme.bg, color: theme.text }}>
        <div className="w-full max-w-lg rounded-3xl p-8 text-center shadow-2xl" style={{ background: theme.card, border: `1px solid ${theme.border}` }}>
          <p className="text-4xl">🎉</p>
          <h1 className="mt-4 font-[family-name:var(--font-arabic)] text-3xl font-bold">تم استلام طلبك بنجاح</h1>
          <p className="mt-3" style={{ color: theme.muted }}>شكراً لطلبك. سنتواصل معك على رقم الهاتف الذي أدخلته لتأكيد تفاصيل الطلب والتوصيل.</p>
          <dl className="mt-8 space-y-3 rounded-2xl bg-black/30 p-5 text-start text-sm">
            <div className="flex justify-between gap-3">
              <dt style={{ color: theme.muted }}>رقم الطلب</dt>
              <dd className="font-mono" dir="ltr">
                #{success.orderNumber}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt style={{ color: theme.muted }}>المنتج</dt>
              <dd>{success.productName}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt style={{ color: theme.muted }}>السعر</dt>
              <dd>{iqd(success.total)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt style={{ color: theme.muted }}>التوصيل</dt>
              <dd>مجاني</dd>
            </div>
            <div className="flex justify-between gap-3 text-base font-semibold" style={{ color: theme.accent }}>
              <dt>المجموع</dt>
              <dd>{iqd(success.total)}</dd>
            </div>
          </dl>
          <button
            type="button"
            onClick={() => {
              setSuccess(null);
              setPhone('');
              setAddress('');
              setName('');
              setError(null);
              if (typeof window !== 'undefined') {
                window.history.replaceState(null, '', '/store/flash-12-courses');
              }
            }}
            className="mt-8 inline-flex rounded-full px-6 py-3 font-semibold"
            style={{ background: theme.accent, color: theme.accentText }}
          >
            البقاء في صفحة العرض
          </button>
        </div>
        <WhatsAppFab phone={waPhone} productName={success.productName} />
      </div>
    );
  }

  return (
    <div
      dir="rtl"
      className="flash-lp min-h-screen overflow-x-hidden pb-28 font-[family-name:var(--font-arabic)]"
      style={{
        ...lpVars,
        background: `radial-gradient(circle at top, ${theme.bgAlt} 0%, ${theme.bg} 46%)`,
        color: theme.text,
      }}
    >
      <div className="border-b px-3 py-2 text-center text-xs sm:px-4 sm:py-2.5 sm:text-sm" style={{ borderColor: theme.border, background: `${theme.accent}22` }}>
        {tx(copy.topBar)}
      </div>

      <nav className="sticky top-0 z-50 border-b backdrop-blur" style={{ borderColor: theme.border, background: `${theme.bg}eb` }}>
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-3 py-2 sm:px-4 sm:py-3">
          <p className="truncate text-xs font-semibold sm:text-sm" style={{ color: theme.accent }}>{copy.navBrand}</p>
          <div className="hidden items-center gap-4 text-sm sm:flex" style={{ color: theme.muted }}>
            <a href="#courses" className="hover:opacity-100" style={{ color: theme.text }}>
              {copy.navCourses}
            </a>
            <a href="#value" className="hover:opacity-100" style={{ color: theme.text }}>
              {copy.navValue}
            </a>
            <a href="#reviews" className="hover:opacity-100" style={{ color: theme.text }}>
              {copy.navReviews}
            </a>
          </div>
          <Cta onClick={goOrder} className="px-3 py-2 text-xs sm:px-4 sm:text-sm">
            {copy.navCta}
          </Cta>
        </div>
      </nav>

      <header className="mx-auto grid max-w-6xl items-center gap-6 px-3 py-8 sm:px-4 sm:py-10 lg:grid-cols-2 lg:gap-10 lg:py-16">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full bg-[color-mix(in_srgb,var(--lp-accent)_18%,transparent)] px-3 py-1 text-xs font-semibold text-[var(--lp-accent)] sm:text-sm">
            <Sparkles className="h-4 w-4" /> {copy.heroBadge}
          </p>
          <h1 className="mt-3 text-[1.65rem] font-extrabold leading-snug sm:mt-4 sm:text-4xl lg:text-5xl">
            {copy.heroTitle}
          </h1>
          <p className="mt-3 max-w-xl text-base leading-7 text-white/80 sm:mt-4 sm:text-lg">
            {tx(copy.heroLead)}
          </p>
          <ul className="mt-4 space-y-2 text-sm text-white/80 sm:mt-5">
            {copy.heroBullets.map((item) => (
              <li key={item} className="flex items-start gap-2">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-[var(--lp-accent)]" />
                {item}
              </li>
            ))}
          </ul>
          <div className="mt-5 flex flex-wrap items-end gap-3 sm:mt-6 sm:gap-4">
            {original ? <span className="text-base text-white/40 line-through sm:text-lg">{iqd(original)}</span> : null}
            <span className="text-3xl font-black text-[var(--lp-accent)] sm:text-4xl">{iqd(price)}</span>
            {pct > 0 ? (
              <span className="rounded-full px-3 py-1 text-sm font-bold" style={{ background: 'var(--lp-accent)', color: 'var(--lp-accent-text)' }}>
                خصم {pct}%
              </span>
            ) : null}
          </div>
          <div className="mt-6 flex flex-col gap-3 sm:mt-8 sm:flex-row sm:flex-wrap">
            <Cta onClick={goOrder}>{copy.heroCta}</Cta>
            <a href="#courses" className="rounded-full border border-white/20 px-6 py-3 text-center text-sm font-semibold text-white/90 hover:bg-white/10 sm:py-3.5 sm:text-base">
              {copy.heroCoursesLink}
            </a>
          </div>
        </div>
        <div className="relative mx-auto w-full max-w-sm lg:max-w-md">
          <div className="absolute inset-8 rounded-full bg-[color-mix(in_srgb,var(--lp-accent)_25%,transparent)] blur-3xl" />
          <img
            src={hero}
            alt={data.product.name}
            width={720}
            height={880}
            fetchPriority="high"
            decoding="async"
            className="relative z-10 mx-auto w-full rounded-[1.5rem] object-cover shadow-2xl ring-1 ring-[color:var(--lp-border)] sm:rounded-[2rem]"
          />
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-4">
        <p className="text-center text-sm text-white/60">{copy.countdownLabel}</p>
        <div className="mt-4 grid grid-cols-4 gap-2 sm:mx-auto sm:max-w-lg">
          {[
            [pad(count.days), 'أيام'],
            [pad(count.hours), 'ساعة'],
            [pad(count.minutes), 'دقيقة'],
            [pad(count.seconds), 'ثانية'],
          ].map(([v, l]) => (
            <div key={l} className="rounded-2xl bg-[var(--lp-card)] py-4 text-center ring-1 ring-[color:var(--lp-border)]">
              <div className="font-mono text-2xl font-bold text-[var(--lp-accent)] sm:text-3xl" dir="ltr">
                {v}
              </div>
              <div className="mt-1 text-xs text-white/55">{l}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12">
        <h2 className="text-center text-2xl font-bold sm:text-3xl">{copy.stepsTitle}</h2>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {copy.steps.map((s) => (
            <article key={s.n} className="rounded-2xl bg-[var(--lp-card)] p-6 ring-1 ring-[color:var(--lp-border)]">
              <span className="font-mono text-[var(--lp-accent)]">{s.n}</span>
              <h3 className="mt-2 text-lg font-bold">{s.title}</h3>
              <p className="mt-2 text-sm text-white/65">{s.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="courses" className="mx-auto max-w-6xl px-3 py-8 sm:px-4">
        <h2 className="text-center text-2xl font-bold sm:text-3xl">{copy.coursesTitle}</h2>
        <p className="mx-auto mt-3 max-w-2xl text-center text-sm text-white/65 sm:text-base">
          {copy.coursesSubtitle}
        </p>
        <div className="mt-8 grid grid-cols-1 gap-4 sm:mt-10 sm:grid-cols-2 sm:gap-5">
          {copy.courses.map((c, index) => {
            const expanded = openCourse === c.n;
            return (
              <article key={c.n} className="overflow-hidden rounded-2xl bg-[var(--lp-card)] ring-1 ring-[color:var(--lp-border)] sm:rounded-3xl">
                <img
                  src={c.image}
                  alt={c.title}
                  width={720}
                  height={405}
                  loading={index < 2 ? 'eager' : 'lazy'}
                  decoding="async"
                  className="h-36 w-full object-cover sm:h-44"
                />
                <button
                  type="button"
                  className="flex w-full items-center gap-2 p-3 text-start sm:gap-3 sm:p-5"
                  onClick={() => setOpenCourse(expanded ? null : c.n)}
                >
                  <div className="min-w-0 flex-1">
                    <span className="font-mono text-xs text-[var(--lp-accent)] sm:text-sm">دورة {c.n}</span>
                    <h3 className="mt-0.5 text-base font-bold leading-snug sm:text-lg">{c.title}</h3>
                    <p className="mt-1 text-xs leading-6 text-white/60 sm:text-sm">{c.blurb}</p>
                  </div>
                  <CourseBrands names={c.brands} />
                  <ChevronDown className={`h-5 w-5 shrink-0 text-[var(--lp-accent)] transition ${expanded ? 'rotate-180' : ''}`} />
                </button>
                {expanded ? (
                  <div className="border-t border-white/10 px-4 pb-5 sm:px-5">
                    <p className="pt-4 text-sm leading-7 text-white/75">{c.detail}</p>
                    <p className="mt-4 text-sm font-semibold text-[var(--lp-accent)]">{copy.courseLearnLabel}</p>
                    <ul className="mt-2 space-y-2">
                      {c.learn.map((item) => (
                        <li key={item} className="flex items-start gap-2 text-sm text-white/75">
                          <Check className="mt-0.5 h-4 w-4 shrink-0 text-[var(--lp-accent)]" />
                          {item}
                        </li>
                      ))}
                    </ul>
                    <Cta onClick={goOrder} className="mt-5 w-full">
                      {copy.courseCta}
                    </Cta>
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
        <div className="mt-8 text-center sm:mt-10">
          <Cta onClick={goOrder}>{copy.coursesCta}</Cta>
        </div>
      </section>

      {gallery.length > 1 ? (
        <section className="mx-auto grid max-w-5xl gap-4 px-4 sm:grid-cols-2">
          {gallery.slice(0, 2).map((src) => (
            <img key={src} src={src} alt="فلاشة الدورات" width={800} height={1000} loading="lazy" className="h-auto w-full rounded-3xl object-cover ring-1 ring-[color:var(--lp-border)]" />
          ))}
        </section>
      ) : null}

      <section id="value" className="mx-auto max-w-6xl px-4 py-16">
        <h2 className="text-center text-2xl font-bold sm:text-3xl">{copy.valueTitle}</h2>
        <p className="mx-auto mt-3 max-w-2xl text-center text-sm text-white/65 sm:text-base">{copy.valueSubtitle}</p>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {copy.benefits.map((b) => (
            <article key={b.title} className="rounded-2xl bg-[var(--lp-card)] p-5 ring-1 ring-[color:var(--lp-border)]">
              <h3 className="font-bold text-[var(--lp-accent)]">{b.title}</h3>
              <p className="mt-2 text-sm text-white/65">{b.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-4 px-4 lg:grid-cols-2">
        <article className="rounded-3xl bg-emerald-500/10 p-6 ring-1 ring-emerald-400/30">
          <h2 className="flex items-center gap-2 text-2xl font-bold">
            <Gift className="h-5 w-5 text-[var(--lp-accent)]" /> {copy.gainsTitle}
          </h2>
          <ul className="mt-5 space-y-3">
            {copy.gains.map((item) => (
              <li key={item} className="flex items-start gap-2 text-sm text-white/85">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
                {item}
              </li>
            ))}
          </ul>
        </article>
        <article className="rounded-3xl bg-red-500/10 p-6 ring-1 ring-red-400/25">
          <h2 className="flex items-center gap-2 text-2xl font-bold">
            <AlertTriangle className="h-5 w-5 text-red-300" /> {copy.lossesTitle}
          </h2>
          <ul className="mt-5 space-y-3">
            {copy.losses.map((item) => (
              <li key={item} className="flex items-start gap-2 text-sm text-white/80">
                <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-300" />
                {item}
              </li>
            ))}
          </ul>
        </article>
      </section>
      <div className="mt-8 text-center">
        <Cta onClick={goOrder}>{copy.delayCta}</Cta>
      </div>

      <section className="mx-auto max-w-6xl px-4 py-16">
        <h2 className="text-center text-2xl font-bold sm:text-3xl">{copy.audiencesTitle}</h2>
        <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {copy.audiences.map((a) => (
            <article key={a.title} className="rounded-2xl bg-white/[0.04] p-5 ring-1 ring-[color:var(--lp-border)]">
              <h3 className="font-bold">{a.title}</h3>
              <p className="mt-2 text-sm text-white/60">{a.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-4 py-8 text-center">
        <h2 className="text-2xl font-bold sm:text-3xl">{copy.offerTitle}</h2>
        <p className="mt-3 text-sm text-white/65 sm:text-base">{copy.offerSubtitle}</p>
        {original ? <p className="mt-6 text-xl text-white/40 line-through">{iqd(original)}</p> : null}
        <p className="mt-2 text-5xl font-black text-[var(--lp-accent)]">{iqd(price)}</p>
        {save > 0 ? (
          <p className="mt-4 text-lg">
            توفّر {iqd(save)}{' '}
            <span className="ms-2 rounded-full px-3 py-1 text-sm font-bold" style={{ background: 'var(--lp-accent)', color: 'var(--lp-accent-text)' }}>
              خصم {pct}%
            </span>
          </p>
        ) : null}
        <Cta onClick={goOrder} className="mt-8">
          {tx(copy.offerCta)}
        </Cta>
      </section>

      <section id="reviews" className="mx-auto max-w-6xl px-4 py-16">
        <h2 className="text-center text-2xl font-bold sm:text-3xl">{copy.reviewsTitle}</h2>
        <p className="mx-auto mt-3 max-w-2xl text-center text-sm text-white/65">{copy.reviewsSubtitle}</p>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {reviews.map((t) => (
            <article key={`${t.name}-${t.text.slice(0, 18)}`} className="rounded-2xl bg-[var(--lp-card)] p-5 ring-1 ring-[color:var(--lp-border)]">
              <p className="text-[var(--lp-accent)]">{'★'.repeat(t.stars)}</p>
              <p className="mt-3 text-white/80">{t.text}</p>
              <p className="mt-4 text-sm font-semibold">{t.name}</p>
              {t.date ? <p className="text-xs text-white/40">{t.date}</p> : null}
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-4 py-8">
        <h2 className="text-center text-2xl font-bold sm:text-3xl">{copy.faqTitle}</h2>
        <div className="mt-8 space-y-2">
          {copy.faqs.map((item, i) => (
            <div key={item.q} className="overflow-hidden rounded-2xl ring-1 ring-[color:var(--lp-border)]">
              <button type="button" className="flex w-full items-center justify-between px-5 py-4 text-start font-semibold" onClick={() => setFaq(faq === i ? null : i)}>
                {item.q}
                <span className="text-[var(--lp-accent)]">{faq === i ? '−' : '+'}</span>
              </button>
              {faq === i ? <p className="px-5 pb-4 text-sm leading-7 text-white/65">{item.a}</p> : null}
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto grid max-w-5xl gap-3 px-4 py-8 sm:grid-cols-5">
        {[
          [Truck, copy.trustDelivery],
          [HardDrive, data.product.storageGb],
          [BadgePercent, copy.trustCourses],
          [Headphones, copy.trustPhone],
          [ShieldCheck, copy.trustAccount],
        ].map(([Icon, label]) => (
          <div key={String(label)} className="flex items-center gap-2 rounded-2xl bg-[var(--lp-card)] px-3 py-3 text-sm ring-1 ring-[color:var(--lp-border)]">
            <Icon className="h-4 w-4 text-[var(--lp-accent)]" />
            {label as string}
          </div>
        ))}
      </section>

      <section id="flash-order" className="mx-auto max-w-lg px-4 py-16">
        <form onSubmit={submit} className="rounded-3xl bg-white p-6 text-[#071428] shadow-2xl">
          <h2 className="text-2xl font-bold">{copy.orderTitle}</h2>
          <p className="mt-2 text-sm text-slate-600">{copy.orderHint}</p>
          <div className="mt-4 flex items-baseline justify-between">
            <span className="text-sm text-slate-500">{copy.orderTotal}</span>
            <span className="text-2xl font-black">{iqd(price)}</span>
          </div>
          {original ? <p className="text-sm text-slate-400 line-through">{iqd(original)}</p> : null}
          <p className="text-sm font-semibold text-emerald-700">{copy.orderFreeDelivery}</p>
          <label className="mt-5 block text-sm font-semibold">
            {copy.orderName} <span className="font-normal text-slate-400">{copy.orderNameOptional}</span>
            <input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full rounded-xl border px-3 py-3" maxLength={80} />
          </label>
          <label className="mt-4 block text-sm font-semibold">
            {copy.orderPhone}
            <span className="mt-1 flex items-center gap-2 rounded-xl border px-3">
              <Phone className="h-4 w-4 text-slate-400" />
              <input required value={phone} onChange={(e) => setPhone(e.target.value)} dir="ltr" inputMode="tel" placeholder="0770 000 0000" className="w-full py-3 outline-none" />
            </span>
          </label>
          <label className="mt-4 block text-sm font-semibold">
            {copy.orderAddress}
            <span className="mt-1 flex items-start gap-2 rounded-xl border px-3">
              <MapPin className="mt-3 h-4 w-4 text-slate-400" />
              <textarea required value={address} onChange={(e) => setAddress(e.target.value)} rows={3} minLength={8} placeholder={copy.orderAddressPlaceholder} className="w-full py-3 outline-none" />
            </span>
          </label>
          {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
          <button type="submit" disabled={submitting || !data.product.inStock} className="mt-6 w-full rounded-full py-3.5 font-bold disabled:opacity-60" style={{ background: 'var(--lp-bg)', color: 'var(--lp-text)' }}>
            {submitting ? copy.orderSubmitting : tx(copy.orderSubmit)}
          </button>
          {!data.product.inStock ? <p className="mt-2 text-center text-sm text-red-600">نفدت الكمية حالياً.</p> : null}
        </form>
      </section>

      <section className="px-4 pb-6 text-center">
        <Cta onClick={goOrder}>{copy.footerCta}</Cta>
        <p className="mt-6 flex items-center justify-center gap-2 text-xs" style={{ color: 'var(--lp-muted)' }}>
          <ShieldCheck className="h-4 w-4" /> {copy.footerNote}
        </p>
        <p className="mt-3 flex items-center justify-center gap-2 text-xs opacity-80" style={{ color: 'var(--lp-muted)' }}>
          <Clock3 className="h-4 w-4" /> {copy.footerTimer}
        </p>
      </section>

      <section id="flash-videos" className="mx-auto max-w-6xl px-4 pb-28 pt-6 md:pb-16">
        <h2 className="text-center text-2xl font-bold sm:text-3xl">{copy.videosTitle}</h2>
        <p className="mx-auto mt-3 max-w-2xl text-center text-sm" style={{ color: 'var(--lp-muted)' }}>
          {copy.videosSubtitle}
        </p>
        <div className="mt-8 grid gap-6 md:grid-cols-2">
          <YoutubeAutoplayEmbed videoId={FLASH_DEMO_VIDEO_IDS[0]} title={copy.videoOneTitle} />
          <YoutubeAutoplayEmbed videoId={FLASH_DEMO_VIDEO_IDS[1]} title={copy.videoTwoTitle} />
        </div>
      </section>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t p-3 backdrop-blur md:hidden" style={{ borderColor: 'var(--lp-border)', background: 'color-mix(in srgb, var(--lp-bg) 95%, transparent)' }}>
        <button type="button" onClick={goOrder} className="w-full rounded-full py-3 font-bold" style={{ background: 'var(--lp-accent)', color: 'var(--lp-accent-text)' }}>
          {tx(copy.stickyCta)}
        </button>
      </div>

      <WhatsAppFab phone={waPhone} productName={data.product.name} />

      {open ? <button type="button" className="fixed inset-0 z-30 bg-black/40 md:hidden" aria-label="إغلاق" onClick={() => setOpen(false)} /> : null}
    </div>
  );
}
