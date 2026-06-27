'use client';

import { Download, FileText, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from '@/components/providers/locale-provider';
import { Button } from '@/components/ui/button';
import { downloadAuthedFile, fetchAuthedBlobUrl } from '@/lib/utils';

type MediaMessage = {
  id: string;
  type: string;
  mediaStorageKey?: string | null;
  mediaMimeType?: string | null;
  mediaFileName?: string | null;
  mediaSizeBytes?: number | null;
};

function formatSize(bytes?: number | null) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function MessageMedia({ conversationId, message }: { conversationId: string; message: MediaMessage }) {
  const { t } = useTranslation();
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const basePath = `/conversations/${conversationId}/messages/${message.id}/media`;
  const mime = message.mediaMimeType ?? '';
  const isImage = mime.startsWith('image/') || message.type === 'IMAGE' || message.type === 'STICKER';
  const isVideo = mime.startsWith('video/') || message.type === 'VIDEO';
  const isAudio = mime.startsWith('audio/') || message.type === 'AUDIO';
  const inlineRenderable = isImage || isVideo || isAudio;
  const fileName = message.mediaFileName ?? `${message.id}`;

  useEffect(() => {
    if (!message.mediaStorageKey || !inlineRenderable) return;
    let revoked: string | null = null;
    let active = true;
    fetchAuthedBlobUrl(basePath)
      .then((objectUrl) => {
        if (!active) {
          URL.revokeObjectURL(objectUrl);
          return;
        }
        revoked = objectUrl;
        setUrl(objectUrl);
      })
      .catch(() => active && setError(true));
    return () => {
      active = false;
      if (revoked) URL.revokeObjectURL(revoked);
    };
  }, [basePath, message.mediaStorageKey, inlineRenderable]);

  async function handleDownload() {
    setDownloading(true);
    try {
      await downloadAuthedFile(`${basePath}?download=1`, fileName);
    } catch {
      setError(true);
    } finally {
      setDownloading(false);
    }
  }

  if (!message.mediaStorageKey) {
    return <span className="text-xs opacity-70">{message.type}</span>;
  }

  return (
    <div className="space-y-1.5">
      {inlineRenderable && !error && (
        <>
          {!url && (
            <div className="flex h-32 w-full items-center justify-center rounded-lg bg-background/40">
              <Loader2 className="h-4 w-4 animate-spin opacity-70" />
            </div>
          )}
          {url && isImage && (
            <a href={url} target="_blank" rel="noreferrer">
              <img src={url} alt={fileName} className="max-h-64 w-auto rounded-lg object-cover" />
            </a>
          )}
          {url && isVideo && <video src={url} controls className="max-h-64 w-full rounded-lg" />}
          {url && isAudio && <audio src={url} controls className="w-full" />}
        </>
      )}

      {(!inlineRenderable || error) && (
        <div className="flex items-center gap-2 rounded-lg bg-background/40 px-3 py-2">
          <FileText className="h-5 w-5 shrink-0 opacity-70" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium">{fileName}</p>
            <p className="text-[10px] opacity-70">{formatSize(message.mediaSizeBytes)}</p>
          </div>
        </div>
      )}

      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-7 gap-1.5 px-2 text-[11px]"
        onClick={handleDownload}
        disabled={downloading}
      >
        {downloading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
        {t('inbox.download')}
      </Button>
    </div>
  );
}
