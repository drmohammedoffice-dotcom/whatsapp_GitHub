'use client';

import { useEffect, useState } from 'react';
import { Film } from 'lucide-react';

function withBust(url: string) {
  if (!url) return url;
  try {
    const parsed = new URL(url);
    if (!parsed.searchParams.has('_cl')) parsed.searchParams.set('_cl', '1');
    return parsed.toString();
  } catch {
    return url.includes('?') ? `${url}&_cl=1` : `${url}?_cl=1`;
  }
}

export function TikTokVideoThumb({
  posterUrl,
  videoUrl,
}: {
  posterUrl?: string;
  videoUrl?: string;
  /** retained for callers; embed iframe removed (broke as Â on list thumbnails) */
  itemId?: string;
}) {
  const [posterFailed, setPosterFailed] = useState(false);
  const [retryPoster, setRetryPoster] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);

  useEffect(() => {
    setPosterFailed(false);
    setRetryPoster(false);
    setVideoFailed(false);
  }, [posterUrl, videoUrl]);

  if (posterUrl && !posterFailed) {
    return (
      <img
        key={`${posterUrl}:${retryPoster ? 'retry' : 'first'}`}
        src={retryPoster ? withBust(posterUrl) : posterUrl}
        alt=""
        referrerPolicy={retryPoster ? undefined : 'no-referrer'}
        loading="lazy"
        decoding="async"
        className="h-full w-full object-cover"
        onError={() => {
          if (!retryPoster) {
            setRetryPoster(true);
            return;
          }
          setPosterFailed(true);
        }}
      />
    );
  }
  if (videoUrl && !videoFailed) {
    return (
      <video
        src={videoUrl}
        muted
        playsInline
        preload="metadata"
        className="h-full w-full object-cover"
        onError={() => setVideoFailed(true)}
      />
    );
  }
  return (
    <span className="flex h-full w-full flex-col items-center justify-center gap-0.5 bg-muted text-muted-foreground" aria-hidden>
      <Film className="h-4 w-4 opacity-70" />
      <span className="text-[9px] leading-none">فيديو</span>
    </span>
  );
}
