'use client';

import { motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

type TrackPayload = {
  redirectUrl: string;
};

function isSetupMode(params: URLSearchParams) {
  const setup = params.get('setup') ?? params.get('builder') ?? params.get('event_builder');
  return setup === '1' || setup === 'true' || setup === 'yes';
}

function WhatsAppMark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 32 32" aria-hidden="true">
      <path
        fill="#25D366"
        d="M16.02 3C9.4 3 4.03 8.37 4.03 15c0 2.28.64 4.4 1.75 6.22L4 29l7.98-1.72A11.9 11.9 0 0 0 16.02 27C22.64 27 28 21.63 28 15S22.64 3 16.02 3z"
      />
      <path
        fill="#fff"
        d="M21.7 18.8c-.3-.15-1.79-.88-2.07-.98-.28-.1-.48-.15-.68.15-.2.3-.78.98-.96 1.18-.18.2-.35.22-.65.07-.3-.15-1.27-.47-2.42-1.49-.9-.8-1.5-1.79-1.68-2.09-.18-.3-.02-.46.13-.61.14-.14.3-.35.45-.53.15-.18.2-.3.3-.5.1-.2.05-.38-.02-.53-.08-.15-.68-1.63-.93-2.23-.24-.58-.49-.5-.68-.51h-.58c-.2 0-.53.08-.8.38-.28.3-1.05 1.03-1.05 2.5s1.08 2.9 1.23 3.1c.15.2 2.12 3.23 5.14 4.53.72.31 1.28.5 1.72.64.72.23 1.38.2 1.9.12.58-.09 1.79-.73 2.04-1.44.25-.71.25-1.32.18-1.44-.08-.12-.28-.2-.58-.35z"
      />
    </svg>
  );
}

export function TikTokRedirectClient({
  slug,
  pixelCode,
}: {
  slug: string;
  pixelCode?: string | null;
}) {
  const searchParams = useSearchParams();
  const started = useRef(false);
  const [waUrl, setWaUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const setupMode = isSetupMode(searchParams);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    if (setupMode) {
      setLoading(false);
      return;
    }

    const qs = searchParams.toString();
    const trackUrl = `${API_URL}/api/tiktok-integration/public/track/${encodeURIComponent(slug)}${qs ? `?${qs}` : ''}`;

    fetch(trackUrl, { cache: 'no-store' })
      .then((r) => r.json() as Promise<TrackPayload>)
      .then((data) => {
        if (!data.redirectUrl) throw new Error('missing redirect');
        setWaUrl(data.redirectUrl);
      })
      .catch(() => {
        setError('تعذر تجهيز رابط واتساب. حاول مرة أخرى.');
      })
      .finally(() => setLoading(false));
  }, [slug, searchParams, setupMode]);

  if (setupMode) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0b141a] px-6 text-center text-sm text-white/80">
        {pixelCode
          ? `TikTok Pixel ${pixelCode} نشط على هذه الصفحة. يمكنك استخدام Event Builder الآن.`
          : 'إعداد البكسل غير موجود لهذا الرابط.'}
      </div>
    );
  }

  return (
    <div
      dir="rtl"
      className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-5 py-10 text-center text-white"
      style={{
        background:
          'radial-gradient(120% 80% at 50% -10%, #1faa59 0%, #128c45 38%, #075e54 72%, #041f1a 100%)',
      }}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.14]"
        style={{
          backgroundImage:
            'radial-gradient(circle at 20% 20%, #fff 0 1px, transparent 1.5px), radial-gradient(circle at 80% 30%, #fff 0 1px, transparent 1.5px), radial-gradient(circle at 40% 80%, #fff 0 1px, transparent 1.5px)',
          backgroundSize: '46px 46px',
        }}
      />

      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: 'easeOut' }}
        className="relative z-10 flex w-full max-w-md flex-col items-center"
      >
        <motion.div
          initial={{ scale: 0.86, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.08, type: 'spring', stiffness: 220, damping: 18 }}
          className="mb-7 flex h-24 w-24 items-center justify-center rounded-[28px] bg-white shadow-[0_18px_50px_rgba(0,0,0,0.28)]"
        >
          <WhatsAppMark className="h-16 w-16" />
        </motion.div>

        <h1 className="mb-3 font-[family-name:var(--font-landing-ar,Tahoma,Arial)] text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
          واتساب
        </h1>
        <p className="mb-8 max-w-sm text-base leading-relaxed text-white/90 sm:text-lg">
          للطلب اضغط هنا وراسلونا عبر الواتساب
        </p>

        {error ? (
          <p className="mb-4 rounded-xl bg-black/25 px-4 py-3 text-sm text-red-100">{error}</p>
        ) : null}

        <motion.a
          href={waUrl ?? undefined}
          onClick={(event) => {
            if (!waUrl) event.preventDefault();
          }}
          whileHover={waUrl ? { scale: 1.03 } : undefined}
          whileTap={waUrl ? { scale: 0.98 } : undefined}
          className={`inline-flex min-h-14 w-full items-center justify-center gap-3 rounded-2xl px-6 text-lg font-bold shadow-[0_14px_35px_rgba(0,0,0,0.28)] transition ${
            waUrl
              ? 'bg-white text-[#075e54] hover:bg-[#f3fff7]'
              : 'cursor-wait bg-white/40 text-white/80'
          }`}
          aria-disabled={!waUrl}
        >
          <WhatsAppMark className="h-7 w-7" />
          {loading ? 'جاري التحضير…' : 'اضغط هنا وراسلنا عبر واتساب'}
        </motion.a>

        <p className="mt-5 text-xs text-white/65">سيتم فتح محادثة واتساب مباشرة بعد الضغط</p>
      </motion.div>
    </div>
  );
}
