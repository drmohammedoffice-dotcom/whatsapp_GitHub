'use client';

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Check, ShieldCheck, Sparkles, Truck } from 'lucide-react';
import { API_URL } from '@/lib/utils';
import {
  IBRAQ_LANDING_KEY,
  IBRAQ_PRODUCT_NAME,
  IBRAQ_SCENTS,
  IBRAQ_WHY,
  formatIqd,
  normalizeIraqiMobileClient,
  resolveIbraqClientPricing,
  type IbraqPackQty,
} from '@/lib/ibraq-musk';
import {
  newTikTokEventId,
  tiktokPixelInlineScript,
  trackTikTokBrowser,
} from '@/lib/tiktok-pixel-script';

export type IbraqLandingPayload = {
  key: string;
  storeSlug: string;
  brandName: string;
  currency: string;
  tiktokPixelCode?: string | null;
  tiktokPixelConfigured?: boolean;
  governorates?: string[];
  packs?: {
    one: { packQty: 1; subtotal: number; shippingCost: number; total: number; freeShipping: boolean; savings: number };
    two: { packQty: 2; subtotal: number; shippingCost: number; total: number; freeShipping: boolean; savings: number };
  } | null;
  product: {
    id: string;
    name: string;
    description: string | null;
    price: number;
    deliveryFee: number;
    inStock: boolean;
    media: Array<{ id: string; kind: string; url: string }>;
  };
};

type SuccessState = {
  orderNumber: string;
  packQty: number;
  total: number;
  shippingCost: number;
  freeShipping?: boolean;
};

function readAttribution() {
  if (typeof window === 'undefined') {
    return { ttclid: undefined as string | undefined, utm: {} as Record<string, string | undefined> };
  }
  const sp = new URLSearchParams(window.location.search);
  const fromUrl = sp.get('ttclid') || undefined;
  let fromStore: string | undefined;
  try {
    fromStore = sessionStorage.getItem('ttclid') || undefined;
  } catch {
    fromStore = undefined;
  }
  const ttclid = fromUrl || fromStore;
  if (fromUrl) {
    try {
      sessionStorage.setItem('ttclid', fromUrl);
    } catch {
      /* ignore */
    }
  }
  const keys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'] as const;
  const utm: Record<string, string | undefined> = {};
  for (const k of keys) {
    const v = sp.get(k) || undefined;
    if (v) {
      utm[k] = v;
      try {
        sessionStorage.setItem(k, v);
      } catch {
        /* ignore */
      }
    } else {
      try {
        utm[k] = sessionStorage.getItem(k) || undefined;
      } catch {
        utm[k] = undefined;
      }
    }
  }
  return { ttclid, utm };
}

export function IbraqMuskLanding({ initial }: { initial: IbraqLandingPayload | null }) {
  const [data] = useState(initial);
  const [packQty, setPackQty] = useState<IbraqPackQty>(2);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [province, setProvince] = useState('');
  const [address, setAddress] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<SuccessState | null>(null);
  const [checkoutStarted, setCheckoutStarted] = useState(false);
  const formRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLElement>(null);
  const idemRef = useRef(`ibraq_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`);
  const leadEventId = useRef(newTikTokEventId('lead'));

  const deliveryFeeOne = data?.product.deliveryFee ?? data?.packs?.one.shippingCost ?? 0;
  const pricing = useMemo(
    () => data?.packs?.[packQty === 2 ? 'two' : 'one'] ?? resolveIbraqClientPricing(packQty, deliveryFeeOne),
    [data?.packs, packQty, deliveryFeeOne],
  );
  const heroImage = data?.product.media[0]?.url || '/store/ibraq-musk/hero.svg';
  const governors = data?.governorates?.length
    ? data.governorates
    : ['بغداد', 'البصرة', 'نينوى', 'أربيل', 'النجف', 'كربلاء', 'بابل', 'الأنبار', 'ديالى', 'ذي قار', 'كركوك', 'واسط', 'ميسان', 'القادسية', 'صلاح الدين', 'المثنى', 'دهوك', 'السليمانية'];

  useEffect(() => {
    readAttribution();
  }, []);

  useEffect(() => {
    const code = data?.tiktokPixelCode;
    if (!code || typeof document === 'undefined') return;
    if (document.getElementById('tiktok-pixel-ibraq')) return;
    const script = document.createElement('script');
    script.id = 'tiktok-pixel-ibraq';
    script.text = tiktokPixelInlineScript(code, ['PageView']);
    document.head.appendChild(script);
  }, [data?.tiktokPixelCode]);

  useEffect(() => {
    const el = heroRef.current;
    if (!el || !data?.product) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        trackTikTokBrowser(
          'ViewContent',
          {
            content_id: data.product.id,
            content_name: IBRAQ_PRODUCT_NAME,
            content_type: 'product',
            value: pricing.subtotal,
            currency: 'IQD',
          },
          newTikTokEventId('vc'),
        );
        io.disconnect();
      },
      { threshold: 0.35 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [data?.product, pricing.subtotal]);

  function scrollToOrder() {
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    if (!checkoutStarted) {
      setCheckoutStarted(true);
      trackTikTokBrowser(
        'InitiateCheckout',
        {
          content_id: data?.product.id,
          content_name: IBRAQ_PRODUCT_NAME,
          content_type: 'product',
          value: pricing.total,
          currency: 'IQD',
          quantity: packQty,
        },
        newTikTokEventId('ic'),
      );
    }
  }

  function selectPack(qty: IbraqPackQty) {
    setPackQty(qty);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError(null);
    if (!name.trim() || name.trim().length < 2) {
      setError('أدخل الاسم الكامل');
      return;
    }
    const normalizedPhone = normalizeIraqiMobileClient(phone);
    if (!normalizedPhone) {
      setError('أدخل رقم هاتف عراقي صالح، مثل 07701234567');
      return;
    }
    if (!province) {
      setError('اختر المحافظة');
      return;
    }
    if (address.trim().length < 8) {
      setError('أدخل العنوان الكامل بوضوح (8 أحرف على الأقل)');
      return;
    }
    setBusy(true);
    const { ttclid, utm } = readAttribution();
    try {
      const res = await fetch(`${API_URL}/api/v1/store/public/landing/${IBRAQ_LANDING_KEY}/checkout`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          phone: normalizedPhone,
          province,
          address: address.trim(),
          packQty,
          idempotencyKey: idemRef.current,
          ttclid,
          utmSource: utm.utm_source,
          utmMedium: utm.utm_medium,
          utmCampaign: utm.utm_campaign,
          utmContent: utm.utm_content,
          utmTerm: utm.utm_term,
          eventId: leadEventId.current,
          userAgent: typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 300) : undefined,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        message?: string | string[];
        orderNumber?: string;
        packQty?: number;
        total?: number;
        shippingCost?: number;
        freeShipping?: boolean;
      };
      if (!res.ok || !json.ok) {
        const msg = Array.isArray(json.message) ? json.message.join(' · ') : json.message;
        throw new Error(msg || 'تعذر إرسال الطلب، حاول مرة أخرى');
      }
      // Lead يُرسل من السيرفر عبر Events API — لا Purchase من المتصفح
      setSuccess({
        orderNumber: String(json.orderNumber || ''),
        packQty: Number(json.packQty || packQty),
        total: Number(json.total || pricing.total),
        shippingCost: Number(json.shippingCost ?? pricing.shippingCost),
        freeShipping: Boolean(json.freeShipping ?? pricing.freeShipping),
      });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'فشل الإرسال');
    } finally {
      setBusy(false);
    }
  }

  if (!data) {
    return (
      <div dir="rtl" className="flex min-h-screen items-center justify-center bg-[#F7F3EA] p-6 text-center text-[#2A2118]">
        <div>
          <h1 className="text-xl font-bold">الصفحة غير متاحة حالياً</h1>
          <p className="mt-2 text-sm opacity-70">حدّث الصفحة أو تواصل مع الدعم.</p>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div dir="rtl" className="min-h-screen bg-[#F7F3EA] px-4 py-16 text-[#2A2118]">
        <div className="mx-auto max-w-md rounded-3xl border border-[#D4AF37]/40 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#D4AF37]/15 text-[#8A6A12]">
            <Check className="h-7 w-7" />
          </div>
          <h1 className="font-[family-name:var(--font-ibraq-display)] text-2xl font-bold">تم استلام طلبك بنجاح</h1>
          <p className="mt-2 text-sm text-[#5C4E40]">راح نتواصل وياك على رقم الهاتف لتأكيد الطلب.</p>
          <div className="mt-6 space-y-2 rounded-2xl bg-[#F7F3EA] p-4 text-sm">
            <p>رقم الطلب: <strong dir="ltr">{success.orderNumber}</strong></p>
            <p>الكمية: {success.packQty} بكج</p>
            <p>التوصيل: {success.freeShipping || success.shippingCost === 0 ? 'مجاني' : formatIqd(success.shippingCost)}</p>
            <p>الإجمالي: <strong>{formatIqd(success.total)}</strong></p>
          </div>
          <button
            type="button"
            className="mt-6 w-full rounded-full bg-[#1C1410] px-5 py-3 text-sm font-bold text-[#F7F3EA]"
            onClick={() => {
              setSuccess(null);
              idemRef.current = `ibraq_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
              leadEventId.current = newTikTokEventId('lead');
            }}
          >
            العودة للصفحة
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      dir="rtl"
      className="min-h-screen bg-[#F7F3EA] text-[#1C1410]"
      style={{
        fontFamily: 'var(--font-ibraq-body), Tahoma, sans-serif',
        backgroundImage:
          'radial-gradient(ellipse at top, rgba(212,175,55,0.12), transparent 55%), linear-gradient(180deg, #FBF8F1 0%, #F7F3EA 40%, #EFE6D6 100%)',
      }}
    >
      <header className="px-4 pb-2 pt-5 text-center">
        <p className="text-[11px] font-semibold tracking-[0.2em] text-[#8A6A12]">IBRAQ · إبراق</p>
      </header>

      <section ref={heroRef} className="mx-auto max-w-lg px-4 pb-8 pt-2">
        <div className="overflow-hidden rounded-[28px] border border-[#D4AF37]/35 bg-white shadow-[0_20px_50px_rgba(28,20,16,0.08)]">
          <div className="relative aspect-[4/5] bg-[#1C1410]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={heroImage}
              alt="مجموعة المسك من إبراق — 12 عطر"
              className="h-full w-full object-cover"
              fetchPriority="high"
            />
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-4 pt-16">
              <div className="flex flex-wrap gap-2">
                {['أصلي 100%', '12 رائحة', '20 مل لكل عطر', '240 مل إجمالي'].map((b) => (
                  <span key={b} className="rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur">
                    {b}
                  </span>
                ))}
              </div>
            </div>
          </div>
          <div className="space-y-4 p-5">
            <h1
              className="text-[1.65rem] font-bold leading-tight text-[#1C1410] sm:text-3xl"
              style={{ fontFamily: 'var(--font-ibraq-display), Georgia, serif' }}
            >
              12 رائحة مسك فاخرة… ببوكس واحد
            </h1>
            <p className="text-sm leading-7 text-[#5C4E40]">
              مسكات إبراق الأصلية 100% — تشكيلة متنوعة للجنسين، كل رائحة بطابع مختلف. مو تقليد.
            </p>
            <div className="flex flex-wrap items-end gap-3">
              <p className="text-3xl font-bold text-[#1C1410]">{formatIqd(70000)}</p>
              <p className="mb-1 text-xs text-[#8A6A12]">بكج واحد</p>
            </div>
            <div className="rounded-2xl border border-[#D4AF37] bg-[#FFF8E7] p-3">
              <p className="text-sm font-bold text-[#1C1410]">2 بكج فقط بـ {formatIqd(120000)}</p>
              <p className="mt-1 text-xs text-[#5C4E40]">وفر 20,000 د.ع · والتوصيل مجاني</p>
            </div>
            <button
              type="button"
              onClick={scrollToOrder}
              className="w-full rounded-full bg-[#1C1410] px-5 py-3.5 text-sm font-bold text-[#F7F3EA] shadow-lg transition hover:bg-black"
            >
              اطلب البكج الآن
            </button>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-lg px-4 py-8">
        <h2 className="text-xl font-bold" style={{ fontFamily: 'var(--font-ibraq-display), Georgia, serif' }}>
          ليش تلتزم برائحة وحدة؟
        </h2>
        <p className="mt-3 text-sm leading-7 text-[#5C4E40]">
          مع بوكس إبراق تحصل على 12 رائحة مختلفة، حتى تختار كل يوم الريحة اللي تناسب مزاجك ومناسبتك.
        </p>
      </section>

      <section className="mx-auto max-w-lg px-4 py-6">
        <h2 className="mb-4 text-xl font-bold" style={{ fontFamily: 'var(--font-ibraq-display), Georgia, serif' }}>
          محتويات المجموعة
        </h2>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          {IBRAQ_SCENTS.map((scent) => (
            <div
              key={scent.name}
              className="rounded-2xl border border-[#E5D8BE] bg-white/80 p-3 shadow-sm"
            >
              <p className="text-sm font-semibold">{scent.name}</p>
              <p className="mt-1 text-[11px] text-[#8A6A12]">{scent.hint} · 20 مل</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-lg px-4 py-8">
        <h2 className="mb-4 text-xl font-bold" style={{ fontFamily: 'var(--font-ibraq-display), Georgia, serif' }}>
          ليش هذا البكج؟
        </h2>
        <ul className="space-y-2.5">
          {IBRAQ_WHY.map((item) => (
            <li key={item} className="flex items-start gap-2 text-sm text-[#3A2F24]">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#8A6A12]" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mx-auto max-w-lg px-4 py-6">
        <div className="rounded-[24px] border border-[#1C1410]/10 bg-[#1C1410] p-5 text-[#F7F3EA]">
          <div className="flex items-center gap-2 text-[#D4AF37]">
            <ShieldCheck className="h-5 w-5" />
            <h2 className="text-lg font-bold">شلون تعرف إنك أخذت الأصلي؟</h2>
          </div>
          <p className="mt-3 text-sm leading-7 text-white/80">
            نحن نوفر لك مجموعة إبراق الأصلية كما هي موضحة في صور المنتج، وليست عبوات مقلدة أو معاد تعبئتها.
            مسكات إبراق الأصلية — أصلي 100% — مو تقليد.
          </p>
          <div className="mt-4 flex gap-2">
            <span className="rounded-full border border-[#D4AF37]/50 px-3 py-1 text-xs tracking-widest text-[#D4AF37]">IBRAQ</span>
            <span className="rounded-full border border-white/20 px-3 py-1 text-xs text-white/80">Original</span>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-lg px-4 py-8">
        <h2 className="mb-4 text-center text-xl font-bold" style={{ fontFamily: 'var(--font-ibraq-display), Georgia, serif' }}>
          اختر عرضك
        </h2>
        <div className="grid gap-3">
          <button
            type="button"
            onClick={() => { selectPack(1); scrollToOrder(); }}
            className={`rounded-3xl border p-4 text-start transition ${packQty === 1 ? 'border-[#1C1410] bg-white shadow-md' : 'border-[#E5D8BE] bg-white/70'}`}
          >
            <p className="text-sm font-semibold">بكج واحد</p>
            <p className="mt-1 text-2xl font-bold">{formatIqd(70000)}</p>
            <p className="mt-2 text-xs text-[#5C4E40]">التوصيل حسب نظام الشحن</p>
            <span className="mt-3 inline-block rounded-full bg-[#1C1410] px-4 py-2 text-xs font-bold text-white">أطلب بكج واحد</span>
          </button>
          <button
            type="button"
            onClick={() => { selectPack(2); scrollToOrder(); }}
            className={`relative rounded-3xl border-2 p-5 text-start transition ${packQty === 2 ? 'border-[#D4AF37] bg-[#FFF8E7] shadow-lg' : 'border-[#D4AF37]/50 bg-[#FFFCF3]'}`}
          >
            <span className="absolute -top-2.5 start-4 rounded-full bg-[#D4AF37] px-2.5 py-0.5 text-[10px] font-bold text-[#1C1410]">
              الأكثر طلبًا
            </span>
            <p className="text-sm font-semibold">بكجين</p>
            <p className="mt-1 text-2xl font-bold">{formatIqd(120000)}</p>
            <p className="mt-1 text-xs font-medium text-[#8A6A12]">وفر {formatIqd(20000)}</p>
            <p className="mt-2 flex items-center gap-1 text-xs text-[#5C4E40]">
              <Truck className="h-3.5 w-3.5" /> التوصيل مجاني
            </p>
            <span className="mt-3 inline-block rounded-full bg-[#D4AF37] px-4 py-2 text-xs font-bold text-[#1C1410]">أطلب بكجين</span>
          </button>
        </div>
      </section>

      <section ref={formRef} id="order" className="mx-auto max-w-lg scroll-mt-24 px-4 pb-28 pt-4">
        <div className="rounded-[28px] border border-[#D4AF37]/40 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-[#8A6A12]" />
            <h2 className="text-lg font-bold">نموذج الطلب</h2>
          </div>
          <div className="mb-4 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => selectPack(1)}
              className={`rounded-2xl border px-3 py-3 text-xs font-semibold ${packQty === 1 ? 'border-[#1C1410] bg-[#1C1410] text-white' : 'border-[#E5D8BE]'}`}
            >
              بكج واحد — {formatIqd(70000)}
            </button>
            <button
              type="button"
              onClick={() => selectPack(2)}
              className={`rounded-2xl border px-3 py-3 text-xs font-semibold ${packQty === 2 ? 'border-[#D4AF37] bg-[#D4AF37] text-[#1C1410]' : 'border-[#E5D8BE]'}`}
            >
              بكجين — {formatIqd(120000)} + توصيل مجاني
            </button>
          </div>
          <form className="space-y-3" onSubmit={(e) => void onSubmit(e)}>
            <label className="block text-xs font-medium text-[#5C4E40]">
              الاسم الكامل
              <input
                className="mt-1 h-11 w-full rounded-xl border border-[#E5D8BE] bg-[#FBF8F1] px-3 text-sm outline-none focus:border-[#D4AF37]"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onFocus={() => {
                  if (!checkoutStarted) {
                    setCheckoutStarted(true);
                    trackTikTokBrowser(
                      'InitiateCheckout',
                      {
                        content_id: data.product.id,
                        content_name: IBRAQ_PRODUCT_NAME,
                        value: pricing.total,
                        currency: 'IQD',
                      },
                      newTikTokEventId('ic'),
                    );
                  }
                }}
                autoComplete="name"
              />
            </label>
            <label className="block text-xs font-medium text-[#5C4E40]">
              رقم الهاتف
              <input
                className="mt-1 h-11 w-full rounded-xl border border-[#E5D8BE] bg-[#FBF8F1] px-3 text-sm outline-none focus:border-[#D4AF37]"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                inputMode="tel"
                dir="ltr"
                placeholder="07701234567"
                autoComplete="tel"
              />
            </label>
            <label className="block text-xs font-medium text-[#5C4E40]">
              المحافظة
              <select
                className="mt-1 h-11 w-full rounded-xl border border-[#E5D8BE] bg-[#FBF8F1] px-3 text-sm outline-none focus:border-[#D4AF37]"
                value={province}
                onChange={(e) => setProvince(e.target.value)}
              >
                <option value="">اختر المحافظة</option>
                {governors.map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </label>
            <label className="block text-xs font-medium text-[#5C4E40]">
              العنوان الكامل
              <textarea
                className="mt-1 min-h-24 w-full rounded-xl border border-[#E5D8BE] bg-[#FBF8F1] px-3 py-2 text-sm outline-none focus:border-[#D4AF37]"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="المنطقة، أقرب نقطة دالة…"
              />
            </label>

            <div className="rounded-2xl bg-[#F7F3EA] p-3 text-sm">
              <div className="flex justify-between"><span>سعر المنتجات</span><strong>{formatIqd(pricing.subtotal)}</strong></div>
              <div className="mt-1 flex justify-between">
                <span>التوصيل</span>
                <strong>{pricing.freeShipping || pricing.shippingCost === 0 ? 'مجاني' : formatIqd(pricing.shippingCost)}</strong>
              </div>
              <div className="mt-2 flex justify-between border-t border-[#E5D8BE] pt-2 text-base">
                <span>الإجمالي</span>
                <strong>{formatIqd(pricing.total)}</strong>
              </div>
            </div>

            {error ? <p className="text-sm text-red-700">{error}</p> : null}

            <button
              type="submit"
              disabled={busy || data.product.inStock === false}
              className="w-full rounded-full bg-[#1C1410] px-5 py-3.5 text-sm font-bold text-[#F7F3EA] disabled:opacity-60"
            >
              {busy ? 'جارٍ إرسال الطلب…' : 'تأكيد الطلب'}
            </button>
          </form>
        </div>
      </section>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[#E5D8BE] bg-white/95 p-3 backdrop-blur md:hidden">
        <button
          type="button"
          onClick={scrollToOrder}
          className="w-full rounded-full bg-[#1C1410] px-4 py-3 text-sm font-bold text-[#F7F3EA]"
        >
          {packQty === 2 ? `اطلب بكجين — ${formatIqd(120000)}` : `اطلب الآن — ${formatIqd(70000)}`}
        </button>
      </div>
    </div>
  );
}
