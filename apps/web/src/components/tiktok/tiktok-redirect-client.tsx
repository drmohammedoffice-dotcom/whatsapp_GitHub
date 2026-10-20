'use client';

import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

type TrackPayload = {
  redirectUrl?: string | null;
  active?: boolean;
  subscriptionExpired?: boolean;
};

function isSetupMode(params: URLSearchParams) {
  const setup = params.get('setup') ?? params.get('builder') ?? params.get('event_builder');
  return setup === '1' || setup === 'true' || setup === 'yes';
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
  const [error, setError] = useState<string | null>(null);
  const setupMode = isSetupMode(searchParams);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    if (setupMode) return;

    const qs = searchParams.toString();
    const trackUrl = `${API_URL}/api/tiktok-integration/public/track/${encodeURIComponent(slug)}${qs ? `?${qs}` : ''}`;

    fetch(trackUrl, { cache: 'no-store' })
      .then((r) => r.json() as Promise<TrackPayload>)
      .then((data) => {
        if (data.subscriptionExpired || data.active === false || !data.redirectUrl) {
          throw new Error('subscription_inactive');
        }
        window.setTimeout(() => {
          window.location.replace(data.redirectUrl!);
        }, 180);
      })
      .catch((err) => {
        setError(
          err instanceof Error && err.message === 'subscription_inactive'
            ? 'الرابط غير متاح حالياً بسبب انتهاء الاشتراك. سيعود للعمل بعد إعادة التفعيل.'
            : 'تعذر فتح واتساب. حاول مرة أخرى.',
        );
      });
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

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white px-6 text-center text-sm text-neutral-700">
        <p>{error}</p>
      </div>
    );
  }

  return <div className="min-h-screen bg-white" />;
}
