'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { InstantFormRenderer } from '@/components/instant-forms/form-renderer';
import {
  fetchPublicInstantForm,
  submitPublicInstantForm,
} from '@/lib/instant-forms/api';
import type { InstantFormDocument } from '@/lib/instant-forms/document';
import {
  newTikTokEventId,
  tiktokPixelInlineScript,
  trackTikTokBrowser,
} from '@/lib/tiktok-pixel-script';

type Props = {
  slug: string;
  initialDocument?: InstantFormDocument | null;
  initialWhatsappNumber?: string | null;
  initialSeoTitle?: string | null;
  initialError?: string | null;
};

export default function PublicInstantFormClient({
  slug,
  initialDocument = null,
  initialWhatsappNumber = null,
  initialSeoTitle = null,
  initialError = null,
}: Props) {
  const search = useSearchParams();
  const router = useRouter();
  const [doc, setDoc] = useState<InstantFormDocument | null>(initialDocument);
  const [whatsappNumber, setWhatsappNumber] = useState<string | null>(initialWhatsappNumber);
  const [pixelCode, setPixelCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(initialError);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [checkoutStarted, setCheckoutStarted] = useState(false);
  const leadEventId = useMemo(() => newTikTokEventId('lead'), []);

  const attribution = useMemo(
    () => {
      const fromUrl = search.get('ttclid') || undefined;
      let fromStore: string | undefined;
      try {
        fromStore = typeof window !== 'undefined' ? sessionStorage.getItem('ttclid') || undefined : undefined;
      } catch {
        fromStore = undefined;
      }
      return {
        utmSource: search.get('utm_source') || undefined,
        utmMedium: search.get('utm_medium') || undefined,
        utmCampaign: search.get('utm_campaign') || undefined,
        utmContent: search.get('utm_content') || undefined,
        utmTerm: search.get('utm_term') || undefined,
        ttclid: fromUrl || fromStore,
        fbclid: search.get('fbclid') || undefined,
        gclid: search.get('gclid') || undefined,
      };
    },
    [search],
  );

  useEffect(() => {
    const ttclid = search.get('ttclid');
    if (ttclid) {
      try {
        sessionStorage.setItem('ttclid', ttclid);
      } catch {
        /* ignore */
      }
    }
  }, [search]);

  useEffect(() => {
    if (initialSeoTitle && typeof document !== 'undefined') {
      document.title = initialSeoTitle;
    }
  }, [initialSeoTitle]);

  useEffect(() => {
    if (doc || !slug) return;
    let cancelled = false;
    void fetchPublicInstantForm(slug)
      .then((data) => {
        if (cancelled) return;
        setDoc(data.document);
        setWhatsappNumber(data.whatsappNumber);
        setPixelCode((data as { tiktokPixelCode?: string | null }).tiktokPixelCode ?? null);
        setError(null);
        if (typeof document !== 'undefined' && data.seoTitle) {
          document.title = data.seoTitle;
        }
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : 'Not found');
      });
    return () => {
      cancelled = true;
    };
  }, [slug, doc]);

  useEffect(() => {
    if (!pixelCode || typeof document === 'undefined') return;
    if (document.getElementById('tiktok-pixel-form')) return;
    const script = document.createElement('script');
    script.id = 'tiktok-pixel-form';
    script.text = tiktokPixelInlineScript(pixelCode, ['PageView', 'ViewContent']);
    document.head.appendChild(script);
    // ViewContent إضافي ببيانات المنتج بعد تحميل SDK
    window.setTimeout(() => {
      trackTikTokBrowser(
        'ViewContent',
        {
          content_id: slug,
          content_name: doc?.product?.name || initialSeoTitle || slug,
          content_type: 'product',
          value: Number(doc?.product?.price) || 1,
          currency: doc?.product?.currency || 'IQD',
        },
        newTikTokEventId('vc'),
      );
    }, 800);
  }, [pixelCode, slug, doc?.product?.name, doc?.product?.price, doc?.product?.currency, initialSeoTitle]);

  useEffect(() => {
    if (!pixelCode || checkoutStarted) return;
    const onFocusIn = () => {
      if (checkoutStarted) return;
      setCheckoutStarted(true);
      trackTikTokBrowser(
        'InitiateCheckout',
        {
          content_id: slug,
          content_name: doc?.product?.name || slug,
          content_type: 'product',
          value: Number(doc?.product?.price) || 1,
          currency: doc?.product?.currency || 'IQD',
        },
        newTikTokEventId('ic'),
      );
    };
    document.addEventListener('focusin', onFocusIn, { once: true });
    return () => document.removeEventListener('focusin', onFocusIn);
  }, [pixelCode, checkoutStarted, slug, doc?.product?.name, doc?.product?.price, doc?.product?.currency]);

  if (error && !doc) {
    return (
      <div dir="rtl" className="flex min-h-screen items-center justify-center bg-slate-50 p-6 text-center">
        <div>
          <h1 className="text-xl font-bold text-slate-900">الاستمارة غير متاحة</h1>
          <p className="mt-2 text-sm text-slate-600">
            تأكد أن الاستمارة منشورة، أو أعد فتح الرابط القصير من لوحة التحكم.
          </p>
          <p className="mt-1 text-xs text-slate-400">{error}</p>
        </div>
      </div>
    );
  }

  if (!doc) {
    return (
      <div dir="rtl" className="flex min-h-screen items-center justify-center bg-slate-50 text-sm text-slate-500">
        جاري التحميل…
      </div>
    );
  }

  return (
    <InstantFormRenderer
      document={doc}
      mode="live"
      whatsappNumber={whatsappNumber}
      submitting={submitting}
      fieldErrors={fieldErrors}
      onSubmit={async (answers) => {
        setSubmitting(true);
        setFieldErrors({});
        try {
          const result = await submitPublicInstantForm(slug, {
            answers,
            ...attribution,
            eventId: leadEventId,
            deviceType: /Mobi|Android/i.test(navigator.userAgent) ? 'mobile' : 'desktop',
            browser: navigator.userAgent.slice(0, 180),
          });
          const qs = new URLSearchParams({
            order: result.orderNumber,
            title: result.thankYou.title,
            message: result.thankYou.message,
          });
          router.push(`/f/${encodeURIComponent(slug)}/thanks?${qs.toString()}`);
        } catch (e) {
          const err = e as Error & { errors?: Array<{ fieldId: string; message: string }> };
          if (err.errors?.length) {
            const map: Record<string, string> = {};
            for (const item of err.errors) map[item.fieldId] = item.message;
            setFieldErrors(map);
            document.getElementById(`field-${err.errors[0]!.fieldId}`)?.scrollIntoView({
              behavior: 'smooth',
              block: 'center',
            });
          } else {
            setError(err.message || 'فشل الإرسال');
            const firstRequired = doc.blocks
              .find((b) => b.type === 'form')
              ?.props.fields as Array<{ id: string; required?: boolean; label: string }> | undefined;
            const missing = (firstRequired || []).find((f) => f.required && !answers[f.id]);
            if (missing) {
              setFieldErrors({ [missing.id]: `${missing.label} مطلوب` });
              document.getElementById(`field-${missing.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
          }
        } finally {
          setSubmitting(false);
        }
      }}
    />
  );
}
