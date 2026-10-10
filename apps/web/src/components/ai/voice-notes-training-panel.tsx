'use client';

import { Loader2, Mic, Square, Trash2, Upload } from 'lucide-react';
import { FormEvent, useEffect, useRef, useState } from 'react';
import { useTranslation } from '@/components/providers/locale-provider';
import { AlertBanner } from '@/components/shared/alert-banner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { type AiTrainingPlatform } from '@/lib/ai-platforms';
import { api, apiUpload, fetchAuthedBlobUrl, parseApiError } from '@/lib/utils';

type VoiceNote = {
  id: string;
  title: string;
  description?: string | null;
  tags?: string | null;
  mimeType: string;
  fileName?: string | null;
  createdAt: string;
};

function AudioPreview({ id }: { id: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
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
  }, [id]);

  if (!url) {
    return <div className="rounded-md bg-muted px-3 py-4 text-xs text-muted-foreground">…</div>;
  }
  return <audio src={url} controls className="w-full" />;
}

export function VoiceNotesTrainingPanel({
  platform = 'WHATSAPP',
}: {
  platform?: AiTrainingPlatform;
}) {
  const { t } = useTranslation();
  const [items, setItems] = useState<VoiceNote[]>([]);
  const [uploading, setUploading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [noticeVariant, setNoticeVariant] = useState<'success' | 'error'>('success');
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);

  async function load() {
    setItems(await api<VoiceNote[]>(`/ai/training-media?platform=${platform}&voiceNotes=1`));
  }

  useEffect(() => {
    load().catch(console.error);
  }, [platform]);

  useEffect(() => {
    return () => {
      if (recordedUrl) URL.revokeObjectURL(recordedUrl);
      mediaRecorderRef.current?.stream.getTracks().forEach((track) => track.stop());
    };
  }, [recordedUrl]);

  async function startRecording() {
    setNotice(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')
          ? 'audio/ogg;codecs=opus'
          : 'audio/webm';
      const recorder = new MediaRecorder(stream, { mimeType });
      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        if (recordedUrl) URL.revokeObjectURL(recordedUrl);
        setRecordedBlob(blob);
        setRecordedUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach((track) => track.stop());
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setRecording(true);
    } catch (err) {
      setNoticeVariant('error');
      setNotice(parseApiError(err) || t('ai.voiceNotesMicDenied'));
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
    setRecording(false);
  }

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formEl = event.currentTarget;
    setUploading(true);
    setNotice(null);
    try {
      const form = new FormData(formEl);
      const title = String(form.get('title') ?? '').trim();
      const description = String(form.get('description') ?? '').trim();
      const tags = String(form.get('tags') ?? '').trim();
      if (!title) throw new Error(t('ai.voiceNotesTitleRequired'));
      if (!description) throw new Error(t('ai.voiceNotesDescRequired'));

      const fileInput = form.get('file');
      let file: File | null = null;
      if (fileInput instanceof File && fileInput.size > 0) {
        file = fileInput;
      } else if (recordedBlob) {
        const ext = recordedBlob.type.includes('ogg') ? 'ogg' : 'webm';
        file = new File([recordedBlob], `voice-${Date.now()}.${ext}`, {
          type: recordedBlob.type || 'audio/webm',
        });
      }
      if (!file) throw new Error(t('ai.voiceNotesFileRequired'));

      const body = new FormData();
      body.append('file', file);
      body.append('title', title);
      body.append('description', description);
      body.append('tags', tags);
      body.append('platform', platform);
      body.append('isVoiceNote', 'true');
      await apiUpload('/ai/training-media', body);

      formEl.reset();
      setRecordedBlob(null);
      if (recordedUrl) URL.revokeObjectURL(recordedUrl);
      setRecordedUrl(null);
      await load();
      setNoticeVariant('success');
      setNotice(t('ai.voiceNotesUploaded'));
    } catch (err) {
      setNoticeVariant('error');
      setNotice(parseApiError(err));
    } finally {
      setUploading(false);
    }
  }

  async function remove(id: string) {
    await api(`/ai/training-media/${id}/delete`, { method: 'POST' });
    await load();
  }

  return (
    <div className="mt-8 space-y-4 border-t pt-6">
      <div>
        <h3 className="text-base font-semibold">{t('ai.voiceNotesTitle')}</h3>
        <p className="text-sm text-muted-foreground">{t('ai.voiceNotesDesc')}</p>
      </div>

      {notice ? <AlertBanner variant={noticeVariant}>{notice}</AlertBanner> : null}

      <form onSubmit={upload} className="grid gap-3 rounded-lg border bg-muted/30 p-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label>{t('ai.voiceNotesName')}</Label>
          <Input name="title" placeholder={t('ai.voiceNotesNamePlaceholder')} required />
        </div>
        <div className="space-y-2">
          <Label>{t('ai.voiceNotesTags')}</Label>
          <Input name="tags" placeholder={t('ai.voiceNotesTagsPlaceholder')} />
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label>{t('ai.voiceNotesWhen')}</Label>
          <Textarea
            name="description"
            rows={3}
            placeholder={t('ai.voiceNotesWhenPlaceholder')}
            required
          />
          <p className="text-xs text-muted-foreground">{t('ai.voiceNotesWhenHint')}</p>
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label>{t('ai.voiceNotesUpload')}</Label>
          <Input name="file" type="file" accept="audio/ogg,audio/mpeg,audio/mp4,audio/webm,audio/*" />
        </div>
        <div className="flex flex-wrap items-center gap-2 md:col-span-2">
          {!recording ? (
            <Button type="button" variant="outline" onClick={() => void startRecording()}>
              <Mic className="me-2 h-4 w-4" />
              {t('ai.voiceNotesRecord')}
            </Button>
          ) : (
            <Button type="button" variant="destructive" onClick={stopRecording}>
              <Square className="me-2 h-4 w-4" />
              {t('ai.voiceNotesStop')}
            </Button>
          )}
          {recordedUrl ? <audio src={recordedUrl} controls className="max-w-full" /> : null}
        </div>
        <Button type="submit" className="md:col-span-2" disabled={uploading || recording}>
          {uploading ? (
            <>
              <Loader2 className="me-2 h-4 w-4 animate-spin" />
              {t('ai.voiceNotesSaving')}
            </>
          ) : (
            <>
              <Upload className="me-2 h-4 w-4" />
              {t('ai.voiceNotesSave')}
            </>
          )}
        </Button>
      </form>

      {items.length > 0 ? (
        <div className="space-y-3">
          {items.map((item) => (
            <div key={item.id} className="rounded-lg border bg-card p-3">
              <div className="mb-2 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{item.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground whitespace-pre-wrap">
                    {item.description || '—'}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0"
                  onClick={() => void remove(item.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
              <AudioPreview id={item.id} />
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">{t('ai.voiceNotesEmpty')}</p>
      )}
    </div>
  );
}
