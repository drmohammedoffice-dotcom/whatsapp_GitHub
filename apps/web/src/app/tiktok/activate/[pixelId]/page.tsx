import Script from 'next/script';
import { Suspense } from 'react';
import { tiktokPixelInlineScript, whitelistBrowserPixelEvents } from '@/lib/tiktok-pixel-script';
import { ActivateClient } from './activate-client';

export const dynamic = 'force-dynamic';

type Props = {
  params: Promise<{ pixelId: string }>;
  searchParams: Promise<{ events?: string }>;
};

/** Browser activation — never fire conversion events (Contact/Lead/Purchase) from this page. */
export default async function TikTokActivatePixelPage({ params, searchParams }: Props) {
  const { pixelId } = await params;
  const { events: eventsParam } = await searchParams;
  const requested = (eventsParam ?? 'PageView,ViewContent')
    .split(',')
    .map((e) => e.trim())
    .filter(Boolean);
  const events = whitelistBrowserPixelEvents(requested);
  const extraEvents = events.filter((e) => e !== 'PageView');

  return (
    <>
      {pixelId ? (
        <Script
          id={`ttq-activate-${pixelId}`}
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: tiktokPixelInlineScript(pixelId, extraEvents),
          }}
        />
      ) : null}
      <Suspense>
        <ActivateClient pixelId={pixelId} />
      </Suspense>
    </>
  );
}
