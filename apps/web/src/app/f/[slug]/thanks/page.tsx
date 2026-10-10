'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';

const TIKTOK_SCHEMES = [
  'snssdk1233://', // TikTok (Android/iOS common)
  'snssdk1180://',
  'tiktok://',
  'musically://',
];

function openTikTokApp() {
  if (typeof window === 'undefined') return;

  // Best effort: close in-app webview / go back in TikTok browser
  try {
    if (window.history.length > 1) {
      window.history.back();
    }
  } catch {
    /* ignore */
  }

  // Deep-link back into TikTok app
  for (const scheme of TIKTOK_SCHEMES) {
    try {
      const iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      iframe.src = scheme;
      document.body.appendChild(iframe);
      setTimeout(() => iframe.remove(), 1500);
    } catch {
      /* ignore */
    }
  }

  // Direct navigation fallback (works in many TikTok webviews)
  window.location.href = TIKTOK_SCHEMES[0]!;

  // Last resort: TikTok website (still better than our marketing homepage)
  setTimeout(() => {
    if (!document.hidden) {
      window.location.href = 'https://www.tiktok.com';
    }
  }, 1200);
}

function ThanksInner() {
  const search = useSearchParams();
  const order = search.get('order');
  const title = search.get('title') || 'تم استلام طلبك بنجاح';
  const message = search.get('message') || 'شكراً لك! سيتواصل معك فريقنا قريباً.';
  const [seconds, setSeconds] = useState(3);

  useEffect(() => {
    const tick = window.setInterval(() => {
      setSeconds((s) => Math.max(0, s - 1));
    }, 1000);
    const redirect = window.setTimeout(() => {
      openTikTokApp();
    }, 3000);
    return () => {
      window.clearInterval(tick);
      window.clearTimeout(redirect);
    };
  }, []);

  return (
    <div dir="rtl" className="flex min-h-screen items-center justify-center bg-gradient-to-b from-slate-950 via-[#121212] to-black p-6">
      <div className="w-full max-w-md rounded-3xl bg-white p-8 text-center shadow-2xl">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-3xl text-emerald-600">
          ✓
        </div>
        <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
        <p className="mt-3 text-sm leading-7 text-slate-600">{message}</p>
        {order ? (
          <p className="mt-4 rounded-xl bg-slate-50 px-4 py-3 font-mono text-sm text-slate-800">
            رقم الطلب: {order}
          </p>
        ) : null}

        <p className="mt-5 text-xs text-slate-500">
          {seconds > 0
            ? `جاري إرجاعك إلى تطبيق تيك توك خلال ${seconds}…`
            : 'جاري فتح تطبيق تيك توك…'}
        </p>

        <div className="mt-6 flex flex-col gap-2">
          <button
            type="button"
            onClick={() => openTikTokApp()}
            className="rounded-2xl bg-black px-4 py-3 text-sm font-semibold text-white"
          >
            العودة إلى تيك توك
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ThanksPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center">…</div>}>
      <ThanksInner />
    </Suspense>
  );
}
