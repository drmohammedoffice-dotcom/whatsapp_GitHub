'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bot, ImagePlus, Loader2, MessageCircle, Mic, Send, ThumbsDown, ThumbsUp, Trash2, X } from 'lucide-react';
import { useTranslation } from '@/components/providers/locale-provider';
import { Button } from '@/components/ui/button';
import { AssistantMedia } from '@/components/assistant/assistant-media';
import { setVoiceHandlers, subscribeVoice, getVoiceSnapshot } from '@/components/assistant/assistant-voice-runtime';
import {
  deleteAssistantConversation,
  fetchAssistantConfig,
  fetchAssistantConversation,
  sendAssistantChat,
  sendAssistantFeedback,
  sendAssistantMedia,
  type AssistantAction,
  type AssistantChatResult,
  type AssistantConfig,
  type AssistantMessage,
  type AssistantSuggestion,
} from '@/lib/assistant-api';
import { cn } from '@/lib/utils';

function renderLiteMarkdown(text: string) {
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  const withCode = escaped.replace(/`([^`]+)`/g, '<code class="rounded bg-muted px-1 py-0.5 text-xs">$1</code>');
  const withBold = withCode.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  const withBreaks = withBold.replace(/\n/g, '<br />');
  return withBreaks;
}

async function compressImage(file: File): Promise<File> {
  if (!file.type.startsWith('image/')) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 1280 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.72));
    if (!blob) return file;
    return new File([blob], file.name.replace(/\.\w+$/, '.jpg'), { type: 'image/jpeg' });
  } catch {
    return file;
  }
}

export function AssistantWidget({ hideChrome = false, callActive = false }: { hideChrome?: boolean; callActive?: boolean }) {
  const { t, locale, dir } = useTranslation();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [config, setConfig] = useState<AssistantConfig | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [supportUrl, setSupportUrl] = useState<string | null>(null);
  const [showSupport, setShowSupport] = useState(false);
  const [suggestions, setSuggestions] = useState<AssistantSuggestion[]>([]);
  const [askHuman, setAskHuman] = useState(false);
  const [pendingActions, setPendingActions] = useState<AssistantAction[]>([]);
  const [recording, setRecording] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);

  useEffect(() => {
    if (hideChrome) return;
    void fetchAssistantConfig()
      .then((cfg) => {
        setConfig(cfg);
        setSupportUrl(cfg.supportUrl);
        setSuggestions(cfg.suggestions);
      })
      .catch(() => setConfig(null));
  }, [hideChrome]);

  useEffect(() => {
    return subscribeVoice(() => {
      const id = getVoiceSnapshot().conversationId;
      if (id) setConversationId(id);
    });
  }, []);

  useEffect(() => {
    setVoiceHandlers({
      onNavigate: () => {
        setOpen(false);
      },
      onHandoff: (url) => {
        setSupportUrl(url);
        setShowSupport(true);
        setOpen(true);
      },
      onTranscript: () => {
        const id = getVoiceSnapshot().conversationId;
        if (id) {
          void fetchAssistantConversation(id)
            .then((full) => setMessages(full.messages ?? []))
            .catch(() => undefined);
        }
      },
      onConversation: (id) => setConversationId(id),
    });
  }, [router]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, busy, open]);

  const welcome = locale === 'ar' ? config?.welcomeAr : config?.welcomeEn;

  const visibleSuggestions = useMemo(() => {
    if (messages.length === 0) return config?.suggestions ?? [];
    return suggestions;
  }, [messages.length, config?.suggestions, suggestions]);

  if (!config?.enabled) return null;

  function applyResult(result: AssistantChatResult, keepOpen = false) {
    setConversationId(result.conversationId);
    setSupportUrl(result.supportUrl);
    setShowSupport(result.showSupport);
    setSuggestions(result.suggestions);
    setPendingActions(result.actions ?? result.message.actions ?? []);
    const actions = result.actions ?? [];
    if (result.autoNavigate && actions[0]?.path) {
      router.push(actions[0].path);
      if (!keepOpen && !callActive) setOpen(false);
    }
  }

  async function refreshMessages(id: string) {
    const full = await fetchAssistantConversation(id);
    setMessages(full.messages ?? []);
  }

  async function send(text: string) {
    const content = text.trim();
    if (!content || busy) return;
    setBusy(true);
    setError(null);
    setAskHuman(false);
    const optimistic: AssistantMessage = {
      id: `local-${Date.now()}`,
      role: 'USER',
      content,
      createdAt: new Date().toISOString(),
    };
    setMessages((current) => [...current, optimistic]);
    setInput('');
    try {
      const result = await sendAssistantChat({ conversationId: conversationId ?? undefined, content });
      applyResult(result);
      await refreshMessages(result.conversationId);
    } catch (err) {
      const message = err instanceof Error ? err.message : t('errors.requestFailed');
      setError(message);
      setMessages((current) => current.filter((row) => row.id !== optimistic.id));
    } finally {
      setBusy(false);
    }
  }

  async function sendFile(file: File, caption?: string, keepOpen = false) {
    if (busy) throw new Error(t('assistant.thinking'));
    setBusy(true);
    setError(null);
    setAskHuman(false);
    const prepared = file.type.startsWith('image/') ? await compressImage(file) : file;
    const optimistic: AssistantMessage = {
      id: `local-${Date.now()}`,
      role: 'USER',
      content: caption || (prepared.type.startsWith('image/') ? t('assistant.photoSent') : t('assistant.voiceSent')),
      mediaType: prepared.type.startsWith('image/') ? 'IMAGE' : 'AUDIO',
      createdAt: new Date().toISOString(),
    };
    setMessages((current) => [...current, optimistic]);
    try {
      const result = await sendAssistantMedia({
        conversationId: conversationId ?? undefined,
        content: caption,
        file: prepared,
      });
      applyResult(result, keepOpen);
      await refreshMessages(result.conversationId);
      return result.message.content;
    } catch (err) {
      const message = err instanceof Error ? err.message : t('errors.requestFailed');
      setError(message);
      setMessages((current) => current.filter((row) => row.id !== optimistic.id));
      throw err;
    } finally {
      setBusy(false);
    }
  }

  async function clearChat() {
    if (conversationId) {
      try {
        await deleteAssistantConversation(conversationId);
      } catch {
        /* ignore */
      }
    }
    setConversationId(null);
    setMessages([]);
    setShowSupport(false);
    setPendingActions([]);
    setSuggestions(config?.suggestions ?? []);
    setError(null);
  }

  async function vote(id: string, helpful: boolean) {
    try {
      await sendAssistantFeedback(id, helpful);
      setMessages((current) => current.map((row) => (row.id === id ? { ...row, helpful } : row)));
      if (!helpful) setAskHuman(true);
    } catch {
      /* ignore */
    }
  }

  async function startVoice() {
    if (busy || recording) return;
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';
      const recorder = new MediaRecorder(stream, { mimeType });
      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        const blob = new Blob(chunksRef.current, { type: mimeType });
        if (blob.size > 800) {
          const ext = mimeType.includes('ogg') ? 'ogg' : 'webm';
          void sendFile(new File([blob], `voice-${Date.now()}.${ext}`, { type: mimeType }));
        }
      };
      recorderRef.current = recorder;
      recorder.start();
      setRecording(true);
    } catch {
      setError(t('assistant.micDenied'));
    }
  }

  function stopVoice() {
    recorderRef.current?.stop();
    setRecording(false);
  }

  return (
    <>
      {!hideChrome && !callActive && (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-5 z-40 flex h-14 items-center gap-2 rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-lg hover:bg-primary/90 ltr:right-5 rtl:left-5"
        aria-label={t('assistant.open')}
      >
        <Bot className="h-5 w-5" />
        <span className="hidden sm:inline">{t('assistant.fab')}</span>
      </button>
      )}

      {open && !hideChrome && (
        <div className="fixed inset-0 z-50 flex items-end justify-end bg-black/30 p-0 sm:items-end sm:p-5 ltr:sm:justify-end rtl:sm:justify-start">
          <div
            dir={dir}
            className="relative flex h-[100dvh] w-full flex-col bg-background shadow-2xl sm:h-[min(720px,88vh)] sm:max-w-md sm:rounded-2xl sm:border"
          >
            <header className="flex items-center justify-between border-b px-4 py-3">
              <div>
                <p className="text-sm font-semibold">{t('assistant.title')}</p>
                <p className="text-xs text-muted-foreground">{t('assistant.subtitle')}</p>
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" onClick={() => void clearChat()} title={t('assistant.clear')}>
                  <Trash2 className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => setOpen(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </header>

            <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
              <div className="rounded-2xl bg-muted/70 px-3 py-2 text-sm">{welcome}</div>
              {messages.map((row) => (
                <div key={row.id} className={cn('flex', row.role === 'USER' ? 'justify-end' : 'justify-start')}>
                  <div
                    className={cn(
                      'max-w-[85%] rounded-2xl px-3 py-2 text-sm',
                      row.role === 'USER' ? 'bg-primary text-primary-foreground' : 'bg-muted',
                    )}
                  >
                    <AssistantMedia messageId={row.id} kind={row.mediaType} mime={row.mediaMime} />
                    <div dangerouslySetInnerHTML={{ __html: renderLiteMarkdown(row.content) }} />
                    {row.role === 'ASSISTANT' && !row.id.startsWith('local-') && (
                      <div className="mt-2 flex gap-2">
                        <button type="button" onClick={() => void vote(row.id, true)} className="opacity-70 hover:opacity-100">
                          <ThumbsUp className={cn('h-3.5 w-3.5', row.helpful === true && 'text-emerald-600')} />
                        </button>
                        <button type="button" onClick={() => void vote(row.id, false)} className="opacity-70 hover:opacity-100">
                          <ThumbsDown className={cn('h-3.5 w-3.5', row.helpful === false && 'text-destructive')} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {busy && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  {recording ? t('assistant.recording') : t('assistant.thinking')}
                </div>
              )}
              {error && <p className="text-xs text-destructive">{error}</p>}
              {(showSupport || askHuman) && supportUrl && (
                <a
                  href={supportUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-3 py-2 text-sm font-medium text-white"
                >
                  <MessageCircle className="h-4 w-4" />
                  {t('assistant.talkHuman')}
                </a>
              )}
              {pendingActions.map((action) => (
                <button
                  key={action.path}
                  type="button"
                  className="flex w-full items-center justify-center rounded-xl border px-3 py-2 text-sm hover:bg-accent"
                  onClick={() => {
                    router.push(action.path);
                    setOpen(false);
                  }}
                >
                  {t('assistant.openSection')}: {locale === 'ar' ? action.labelAr : action.labelEn}
                </button>
              ))}
              {visibleSuggestions.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {visibleSuggestions.map((item) => (
                    <button
                      key={item.ar}
                      type="button"
                      className="rounded-full border px-3 py-1 text-xs hover:bg-accent"
                      onClick={() => void send(locale === 'ar' ? item.ar : item.en)}
                    >
                      {locale === 'ar' ? item.ar : item.en}
                    </button>
                  ))}
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            <div className="border-t p-3">
              {supportUrl && (
                <a
                  href={supportUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mb-2 flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium hover:bg-accent"
                >
                  <MessageCircle className="h-3.5 w-3.5" />
                  {t('assistant.talkHuman')}
                </a>
              )}
              <form
                className="flex items-end gap-1"
                onSubmit={(e) => {
                  e.preventDefault();
                  void send(input);
                }}
              >
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = '';
                    if (file) void sendFile(file, input.trim() || undefined);
                  }}
                />
                <Button type="button" variant="ghost" size="icon" disabled={busy} onClick={() => fileRef.current?.click()} title={t('assistant.sendPhoto')}>
                  <ImagePlus className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant={recording ? 'destructive' : 'ghost'}
                  size="icon"
                  disabled={busy && !recording}
                  onPointerDown={(e) => {
                    e.preventDefault();
                    void startVoice();
                  }}
                  onPointerUp={stopVoice}
                  onPointerCancel={stopVoice}
                  onContextMenu={(e) => e.preventDefault()}
                  title={t('assistant.holdToTalk')}
                >
                  <Mic className="h-4 w-4" />
                </Button>
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={recording ? t('assistant.recording') : t('assistant.placeholder')}
                  className="h-10 flex-1 rounded-lg border bg-background px-3 text-sm"
                />
                <Button type="submit" disabled={busy || !input.trim()} size="icon">
                  <Send className="h-4 w-4" />
                </Button>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
