'use client';

import { useEffect, useState } from 'react';
import { fetchAuthedBlobUrl } from '@/lib/utils';

export function AssistantMedia({ messageId, kind, mime }: { messageId: string; kind?: string | null; mime?: string | null }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!kind || messageId.startsWith('local-')) return;
    let active = true;
    let objectUrl: string | null = null;
    fetchAuthedBlobUrl(`/assistant/messages/${messageId}/media`)
      .then((blobUrl) => {
        if (!active) {
          URL.revokeObjectURL(blobUrl);
          return;
        }
        objectUrl = blobUrl;
        setUrl(blobUrl);
      })
      .catch(() => {
        if (active) setUrl(null);
      });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [messageId, kind]);

  if (!kind || !url) return null;
  if (kind === 'IMAGE' || mime?.startsWith('image/')) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={url} alt="" className="mb-2 max-h-48 w-full rounded-lg object-cover" />
    );
  }
  return <audio src={url} controls className="mb-2 w-full" />;
}
