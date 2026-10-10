'use client';

import { useState } from 'react';
import { Film } from 'lucide-react';

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
  const [videoFailed, setVideoFailed] = useState(false);
  if (posterUrl && !posterFailed) {
    return (
      <img
        src={posterUrl}
        alt=""
        referrerPolicy="no-referrer"
        className="h-full w-full object-cover"
        onError={() => setPosterFailed(true)}
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
