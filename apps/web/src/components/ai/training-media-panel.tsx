'use client';

import { FileText, ImageIcon, Loader2, Trash2, Upload, Video } from 'lucide-react';
import { ChangeEvent, FormEvent, useEffect, useState } from 'react';
import { useTranslation } from '@/components/providers/locale-provider';
import { AlertBanner } from '@/components/shared/alert-banner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { api, apiUpload, fetchAuthedBlobUrl, parseApiError } from '@/lib/utils';

type TrainingMedia = {
  id: string;
  title: string;
  productName?: string | null;
  description?: string | null;
  mediaType: string;
  mimeType: string;
  fileName?: string | null;
  tags?: string | null;
  createdAt: string;
};

function fileBaseName(name: string) {
  return name.replace(/\.[^.]+$/, '').trim() || name;
}

function buildMediaTitle(prefix: string, file: File) {
  const base = fileBaseName(file.name);
  return prefix ? `${prefix} - ${base}` : base;
}

function MediaIcon({ type }: { type: string }) {
  if (type === 'VIDEO') return <Video className="h-8 w-8 text-muted-foreground" />;
  if (type === 'IMAGE') return <ImageIcon className="h-8 w-8 text-muted-foreground" />;
  return <FileText className="h-8 w-8 text-muted-foreground" />;
}

function MediaPreview({ id, type }: { id: string; type: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (type !== 'IMAGE' && type !== 'VIDEO') return;
    let active = true;
    let objectUrl: string | null = null;
    fetchAuthedBlobUrl(`/ai/training-media/${id}/file`)
      .then((blobUrl) => {
        if (!active) {
          URL.revokeObjectURL(blobUrl);
          return;
        }
        objectUrl = blobUrl;
        setUrl(blobUrl);
      })
      .catch(() => active && setUrl(null));
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [id, type]);

  if (type === 'IMAGE' && url) {
    return <img src={url} alt="" className="h-24 w-full rounded-md object-cover" />;
  }
  if (type === 'VIDEO' && url) {
    return <video src={url} className="h-24 w-full rounded-md object-cover" controls />;
  }
  return (
    <div className="flex h-24 items-center justify-center rounded-md bg-muted">
      <MediaIcon type={type} />
    </div>
  );
}

export function TrainingMediaPanel() {
  const { t } = useTranslation();
  const [items, setItems] = useState<TrainingMedia[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number } | null>(null);
  const [selectedCount, setSelectedCount] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const [noticeVariant, setNoticeVariant] = useState<'success' | 'error'>('success');

  async function load() {
    setItems(await api<TrainingMedia[]>('/ai/training-media'));
  }

  useEffect(() => { load().catch(console.error); }, []);

  function onFilesChange(event: ChangeEvent<HTMLInputElement>) {
    setSelectedCount(event.target.files?.length ?? 0);
  }

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formEl = event.currentTarget;
    setUploading(true);
    setNotice(null);
    setUploadProgress(null);

    try {
      const form = new FormData(formEl);
      const fileList = form.getAll('files');
      const files = fileList.filter((entry): entry is File => entry instanceof File && entry.size > 0);
      if (!files.length) throw new Error(t('ai.trainingMediaFileRequired'));

      const titlePrefix = String(form.get('title') ?? '').trim();
      const productName = String(form.get('productName') ?? '');
      const tags = String(form.get('tags') ?? '');

      let success = 0;
      let failed = 0;
      let lastError: unknown = null;

      for (let i = 0; i < files.length; i += 1) {
        const file = files[i];
        setUploadProgress({ current: i + 1, total: files.length });
        try {
          const body = new FormData();
          body.append('file', file);
          body.append('title', buildMediaTitle(titlePrefix, file));
          body.append('productName', productName);
          body.append('tags', tags);
          await apiUpload('/ai/training-media', body);
          success += 1;
        } catch (err) {
          failed += 1;
          lastError = err;
        }
      }

      if (success > 0) {
        formEl.reset();
        setSelectedCount(0);
        await load();
      }

      if (failed === 0) {
        setNoticeVariant('success');
        setNotice(
          files.length === 1
            ? t('ai.trainingMediaUploaded')
            : t('ai.trainingMediaUploadedMultiple').replace('{count}', String(success)),
        );
      } else if (success > 0) {
        setNoticeVariant('error');
        setNotice(
          t('ai.trainingMediaUploadPartial')
            .replace('{success}', String(success))
            .replace('{total}', String(files.length))
            .replace('{failed}', String(failed)),
        );
      } else {
        throw lastError ?? new Error(t('ai.trainingMediaFileRequired'));
      }
    } catch (err) {
      setNoticeVariant('error');
      setNotice(parseApiError(err));
    } finally {
      setUploading(false);
      setUploadProgress(null);
    }
  }

  async function remove(id: string) {
    await api(`/ai/training-media/${id}/delete`, { method: 'POST' });
    await load();
  }

  return (
    <div className="space-y-4 border-t pt-6">
      <div>
        <h3 className="text-base font-semibold">{t('ai.trainingMediaTitle')}</h3>
        <p className="text-sm text-muted-foreground">{t('ai.trainingMediaDesc')}</p>
      </div>

      {notice && (
        <AlertBanner variant={noticeVariant}>{notice}</AlertBanner>
      )}

      <form onSubmit={upload} className="grid gap-3 rounded-lg border bg-muted/30 p-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label>{t('ai.trainingMediaTitleLabel')}</Label>
          <Input name="title" placeholder={t('ai.trainingMediaTitlePlaceholder')} />
        </div>
        <div className="space-y-2">
          <Label>{t('ai.trainingMediaProduct')}</Label>
          <Input name="productName" placeholder={t('ai.trainingMediaProductPlaceholder')} />
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label>{t('ai.trainingMediaTags')}</Label>
          <Input name="tags" placeholder={t('ai.trainingMediaTagsPlaceholder')} />
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label>{t('ai.trainingMediaFile')}</Label>
          <Input
            name="files"
            type="file"
            multiple
            accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx"
            required
            onChange={onFilesChange}
          />
          <p className="text-xs text-muted-foreground">{t('ai.trainingMediaFilesHint')}</p>
          {selectedCount > 0 && (
            <p className="text-xs font-medium text-foreground">
              {t('ai.trainingMediaFilesSelected').replace('{count}', String(selectedCount))}
            </p>
          )}
        </div>
        <Button type="submit" className="md:col-span-2" disabled={uploading}>
          {uploading ? (
            <>
              <Loader2 className="me-2 h-4 w-4 animate-spin" />
              {uploadProgress
                ? t('ai.trainingMediaUploadingProgress')
                    .replace('{current}', String(uploadProgress.current))
                    .replace('{total}', String(uploadProgress.total))
                : t('ai.trainingMediaUploading')}
            </>
          ) : (
            <>
              <Upload className="me-2 h-4 w-4" />
              {t('ai.trainingMediaUpload')}
            </>
          )}
        </Button>
      </form>

      {items.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <div key={item.id} className="overflow-hidden rounded-lg border bg-card">
              <MediaPreview id={item.id} type={item.mediaType} />
              <div className="space-y-1 p-3">
                <p className="truncate text-sm font-medium">{item.title}</p>
                {item.productName && <p className="truncate text-xs text-muted-foreground">{item.productName}</p>}
                <div className="flex items-center justify-between pt-1">
                  <span className="text-[10px] uppercase text-muted-foreground">{item.mediaType}</span>
                  <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => remove(item.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
