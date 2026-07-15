'use client';

import { SOCKET_EVENTS } from '@watsapp/shared';
import { motion } from 'framer-motion';
import { Archive, ArrowLeft, Bot, Mic, PanelRight, Paperclip, Pin, Search, Send, Smile, Trash2, UserRound } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { AppShell } from '@/components/layout/app-shell';
import { useTranslation } from '@/components/providers/locale-provider';
import { AlertBanner } from '@/components/shared/alert-banner';
import { EmptyState } from '@/components/shared/empty-state';
import { MessageMedia } from '@/components/inbox/message-media';
import { PageHeader } from '@/components/shared/page-header';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import type { ChannelDefinition } from '@/lib/channels';
import { markTikTokQualifiedLead } from '@/lib/tiktok-integration';
import { api, apiUpload, cn, parseApiError } from '@/lib/utils';
import { createSocket } from '@/lib/socket';

type ContactSummary = {
  displayName: string;
  phone?: string | null;
  avatarUrl?: string | null;
};
type Conversation = {
  id: string;
  subject?: string;
  status: string;
  unreadCount: number;
  isArchived: boolean;
  isPinned: boolean;
  assigneeUserId?: string;
  aiMode?: string;
  contact: ContactSummary;
  messages?: Message[];
};
type Message = { id: string; direction: string; type: string; status: string; text?: string; createdAt: string; mediaStorageKey?: string | null; mediaMimeType?: string | null; mediaFileName?: string | null; mediaSizeBytes?: number | null };
type Detail = Omit<Conversation, 'messages'> & { aiMode?: string; messages: Message[]; notes: Array<{ id: string; body: string; author: { name: string } }>; comments: Array<{ id: string; body: string; author: { name: string } }>; tags: Array<{ label: { name: string; color: string } }>; events: Array<{ id: string; type: string; createdAt: string }> };

function contactInitials(contact: ContactSummary) {
  const source = contact.displayName || contact.phone || 'WA';
  const cleaned = source.replace(/@.*/g, '').trim();
  return cleaned.slice(0, 2).toUpperCase() || 'WA';
}

function formatWhatsAppPhone(phone?: string | null) {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 8) return null;
  return `+${digits}`;
}

function contactPrimaryLabel(contact: ContactSummary) {
  const phone = formatWhatsAppPhone(contact.phone);
  const name = contact.displayName?.trim();
  if (name && !name.includes('@lid') && !/^\d{15,}$/.test(name.replace(/\D/g, ''))) {
    return name;
  }
  return phone || name || 'WhatsApp';
}

type InboxViewProps = {
  channel: ChannelDefinition;
  socialMode?: boolean;
};

type PendingAttachment = { id: string; file: File; previewUrl: string; asSticker: boolean };

const STICKER_EMOJIS = [
  '😀', '😂', '😍', '😎', '🥳', '😭', '😡', '👍', '👎', '👏',
  '🙏', '💪', '🔥', '🎉', '❤️', '💯', '✅', '❌', '⭐', '🌟',
  '😢', '😴', '🤔', '😱', '🤗', '😘', '🥰', '😅', '🤩', '😋',
  '👌', '✌️', '🤝', '🙌', '💔', '💖', '🎁', '☕', '🌹', '⚡',
];

async function emojiToStickerFile(emoji: string): Promise<File | null> {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.clearRect(0, 0, size, size);
  ctx.font = `${Math.floor(size * 0.7)}px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(emoji, size / 2, size / 2 + size * 0.05);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', 0.92));
  if (!blob) return null;
  return new File([blob], `sticker-${Date.now()}.webp`, { type: 'image/webp' });
}

export function InboxView({ channel, socialMode }: InboxViewProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const ChannelIcon = channel.icon;
  const [items, setItems] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [filter, setFilter] = useState('');
  const [view, setView] = useState<'all' | 'open' | 'unread' | 'read' | 'closed' | 'pinned' | 'archived'>('all');
  const [mobilePanel, setMobilePanel] = useState<'list' | 'thread' | 'tools'>('list');
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [recording, setRecording] = useState(false);
  const [sending, setSending] = useState(false);
  const [mediaCaption, setMediaCaption] = useState('');
  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>([]);
  const [stickerPickerOpen, setStickerPickerOpen] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const cancelRecordingRef = useRef(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const selected = useMemo(() => detail ?? items.find((item) => item.id === selectedId) ?? null, [detail, items, selectedId]);

  async function load() {
    try {
      const query = new URLSearchParams();
      if (socialMode) query.set('social', 'true');
      else query.set('provider', channel.provider);
      if (view === 'open') query.set('status', 'OPEN');
      if (view === 'closed') query.set('status', 'CLOSED');
      if (view === 'unread') query.set('unread', 'true');
      if (view === 'read') query.set('read', 'true');
      if (view === 'pinned') query.set('pinned', 'true');
      if (view === 'archived') query.set('archived', 'true');
      query.set('limit', '200');
      if (filter) query.set('search', filter);
      const conversations = await api<Conversation[]>(`/conversations?${query}`);
      setItems(conversations);
      if (!selectedId && conversations[0]) setSelectedId(conversations[0].id);
      if (selectedId && !conversations.some((c) => c.id === selectedId)) {
        setSelectedId(conversations[0]?.id ?? null);
        setDetail(null);
      }
    } catch (err) {
      setError(parseApiError(err));
    }
  }

  async function loadDetail(id: string) {
    setDetail(await api<Detail>(`/conversations/${id}`));
  }

  useEffect(() => {
    setSelectedId(null);
    setDetail(null);
    load().catch(console.error);
  }, [view, channel.provider, socialMode]);

  useEffect(() => { if (selectedId) loadDetail(selectedId).catch(console.error); }, [selectedId]);

  useEffect(() => {
    const socket = createSocket();
    socket.on(SOCKET_EVENTS.CONVERSATION_UPDATED, () => load().catch(console.error));
    socket.on(SOCKET_EVENTS.CONVERSATION_ASSIGNED, () => load().catch(console.error));
    socket.on(SOCKET_EVENTS.CONVERSATION_MESSAGE_CREATED, () => { load().catch(console.error); if (selectedId) loadDetail(selectedId).catch(console.error); });
    socket.on(SOCKET_EVENTS.CONVERSATION_NOTE_CREATED, () => selectedId && loadDetail(selectedId).catch(console.error));
    socket.on(SOCKET_EVENTS.AI_TRANSFERRED, () => { load().catch(console.error); if (selectedId) loadDetail(selectedId).catch(console.error); });
    socket.on(SOCKET_EVENTS.AI_REACTIVATED, () => { if (selectedId) loadDetail(selectedId).catch(console.error); });
    socket.on(SOCKET_EVENTS.AI_PAUSED, () => { if (selectedId) loadDetail(selectedId).catch(console.error); });
    return () => { socket.disconnect(); };
  }, [selectedId, channel.provider]);

  async function submit(path: string, body?: object) {
    if (!selectedId) return;
    await api(path.replace(':id', selectedId), { method: 'POST', body: JSON.stringify(body ?? {}) });
    await Promise.all([load(), loadDetail(selectedId)]);
  }

  async function patch(path: string, body?: object) {
    if (!selectedId) return;
    await api(path.replace(':id', selectedId), { method: 'PATCH', body: JSON.stringify(body ?? {}) });
    await Promise.all([load(), loadDetail(selectedId)]);
  }

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [detail?.messages.length, selectedId]);

  useEffect(() => {
    setPendingAttachments((current) => {
      current.forEach((item) => item.previewUrl && URL.revokeObjectURL(item.previewUrl));
      return [];
    });
    setMediaCaption('');
    setStickerPickerOpen(false);
  }, [selectedId]);

  function clearPendingAttachments() {
    setPendingAttachments((current) => {
      current.forEach((item) => item.previewUrl && URL.revokeObjectURL(item.previewUrl));
      return [];
    });
    setMediaCaption('');
  }

  function removePendingAttachment(id: string) {
    setPendingAttachments((current) => {
      const target = current.find((item) => item.id === id);
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      return current.filter((item) => item.id !== id);
    });
  }

  function stageAttachments(files: File[], asSticker = false) {
    if (!files.length) return;
    const staged = files.map((file) => ({
      id: `${file.name}-${file.size}-${Math.random().toString(36).slice(2)}`,
      file,
      previewUrl: file.type.startsWith('image/') || file.type.startsWith('video/') ? URL.createObjectURL(file) : '',
      asSticker,
    }));
    setPendingAttachments((current) => [...current, ...staged]);
  }

  async function sendText() {
    const body = text.trim();
    if (!body || !selectedId || sending) return;
    setSending(true);
    setText('');
    try {
      await submit('/conversations/:id/reply', { text: body });
    } catch (err) {
      setError(parseApiError(err));
      setText(body);
    } finally {
      setSending(false);
    }
  }

  async function sendPendingAttachments() {
    if (!pendingAttachments.length || sending || !selectedId) return;
    setSending(true);
    const caption = mediaCaption.trim();
    try {
      for (let i = 0; i < pendingAttachments.length; i += 1) {
        const attachment = pendingAttachments[i];
        await uploadFile(attachment.file, {
          asSticker: attachment.asSticker,
          // Apply the caption only to the first item to avoid repeating it.
          caption: i === 0 && caption ? caption : undefined,
        });
      }
      clearPendingAttachments();
    } catch (err) {
      setError(parseApiError(err));
    } finally {
      setSending(false);
    }
  }

  async function sendStickerEmoji(emoji: string) {
    if (sending || !selectedId) return;
    setStickerPickerOpen(false);
    setSending(true);
    try {
      const file = await emojiToStickerFile(emoji);
      if (file) await uploadFile(file, { asSticker: true });
    } catch (err) {
      setError(parseApiError(err));
    } finally {
      setSending(false);
    }
  }

  async function uploadFile(file: File, options: { voiceNote?: boolean; asSticker?: boolean; caption?: string } = {}) {
    if (!selectedId) return;
    const form = new FormData();
    form.append('file', file);
    if (options.voiceNote) form.append('voiceNote', 'true');
    if (options.asSticker) form.append('asSticker', 'true');
    if (options.caption) form.append('caption', options.caption);
    await apiUpload(`/conversations/${selectedId}/reply/media`, form);
    await Promise.all([load(), loadDetail(selectedId)]);
  }

  async function startRecording() {
    if (typeof window !== 'undefined' && !window.isSecureContext) {
      setError(t('inbox.micInsecure'));
      return;
    }
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setError(t('inbox.micInsecure'));
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const preferred = ['audio/ogg;codecs=opus', 'audio/webm;codecs=opus', 'audio/webm'];
      const mimeType = typeof MediaRecorder !== 'undefined'
        ? preferred.find((type) => MediaRecorder.isTypeSupported(type))
        : undefined;
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      audioChunksRef.current = [];
      cancelRecordingRef.current = false;
      recorder.ondataavailable = (event) => { if (event.data.size > 0) audioChunksRef.current.push(event.data); };
      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        setRecording(false);
        if (cancelRecordingRef.current) return;
        const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        if (blob.size === 0) return;
        const ext = (recorder.mimeType || 'audio/webm').includes('ogg') ? 'ogg' : 'webm';
        const file = new File([blob], `voice-${Date.now()}.${ext}`, { type: blob.type });
        void uploadFile(file, { voiceNote: true });
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setRecording(true);
    } catch {
      setError(t('inbox.micPermissionDenied'));
    }
  }

  function stopRecording(cancel = false) {
    cancelRecordingRef.current = cancel;
    mediaRecorderRef.current?.stop();
    mediaRecorderRef.current = null;
  }

  return (
    <AppShell>
      <PageHeader
        title={t(channel.inboxTitleKey)}
        description={t(channel.inboxDescKey)}
        actions={(
          <div className="flex items-center gap-2">
            <Badge variant="secondary">{items.length} {t('inbox.openCount')}</Badge>
            <Button variant="outline" size="sm" asChild>
              <Link href={channel.connectHref}>{t('channels.manageConnection')}</Link>
            </Button>
          </div>
        )}
      />

      {error && (
        <AlertBanner className="mt-4" message={error} onDismiss={() => setError(null)} />
      )}

      <div className="mt-6 grid gap-4 xl:grid-cols-[320px_1fr_280px]">
        <Card className={cn('flex flex-col overflow-hidden border-0 shadow-card xl:max-h-[calc(100vh-11rem)]', mobilePanel !== 'list' && 'hidden xl:flex')}>
          <CardHeader className="space-y-4 pb-3">
            <form onSubmit={(event) => { event.preventDefault(); load().catch(console.error); }} className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder={t('inbox.search')} className="ps-9" />
            </form>
            <Tabs value={view} onValueChange={(v) => setView(v as typeof view)}>
              <TabsList className="flex h-auto flex-wrap gap-1">
                {(
                  [
                    { value: 'all' as const, labelKey: 'inbox.filterAll' },
                    { value: 'open' as const, labelKey: 'inbox.filterOpen' },
                    { value: 'unread' as const, labelKey: 'inbox.filterUnread' },
                    { value: 'read' as const, labelKey: 'inbox.filterRead' },
                    { value: 'closed' as const, labelKey: 'inbox.filterClosed' },
                    { value: 'pinned' as const, labelKey: 'inbox.filterPinned' },
                    { value: 'archived' as const, labelKey: 'inbox.filterArchived' },
                  ] as const
                ).map((item) => (
                  <TabsTrigger key={item.value} value={item.value} className="text-xs">
                    {t(item.labelKey)}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </CardHeader>
          <CardContent className="flex-1 p-0">
            <ScrollArea className="h-[calc(100vh-18rem)]">
              {items.length === 0 ? (
                <div className="p-4">
                  <EmptyState
                    icon={ChannelIcon}
                    title={t('inbox.noConversations')}
                    description={t('inbox.noConversationsChannelDesc')}
                    action={t('channels.connectNow')}
                    onAction={() => router.push(channel.connectHref)}
                  />
                </div>
              ) : (
                <div className="divide-y">
                  {items.map((conversation) => (
                    <motion.button
                      key={conversation.id}
                      whileHover={{ backgroundColor: 'hsl(var(--muted) / 0.5)' }}
                      onClick={() => { setSelectedId(conversation.id); setMobilePanel('thread'); }}
                      className={cn(
                        'flex w-full gap-3 p-4 text-left transition-colors',
                        selectedId === conversation.id && 'bg-accent',
                      )}
                    >
                      <Avatar className="h-10 w-10">
                        {conversation.contact.avatarUrl ? (
                          <AvatarImage src={conversation.contact.avatarUrl} alt={contactPrimaryLabel(conversation.contact)} />
                        ) : null}
                        <AvatarFallback className="bg-primary/10 text-primary text-xs">
                          {contactInitials(conversation.contact)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate font-medium">{contactPrimaryLabel(conversation.contact)}</span>
                          {conversation.unreadCount > 0 && (
                            <Badge className="h-5 min-w-5 justify-center px-1.5">{conversation.unreadCount}</Badge>
                          )}
                        </div>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          {formatWhatsAppPhone(conversation.contact.phone) || conversation.messages?.[0]?.text || conversation.status}
                        </p>
                        {formatWhatsAppPhone(conversation.contact.phone) && conversation.messages?.[0]?.text ? (
                          <p className="mt-0.5 truncate text-sm text-muted-foreground">
                            {conversation.messages[0].text}
                          </p>
                        ) : null}
                      </div>
                    </motion.button>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        <Card className={cn('flex h-[calc(100vh-11rem)] min-h-[34rem] flex-col overflow-hidden border-0 shadow-card', mobilePanel !== 'thread' && 'hidden xl:flex')}>
          <CardHeader className="flex flex-row items-center justify-between border-b pb-4">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" className="xl:hidden" onClick={() => setMobilePanel('list')}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
              {selected && (
                <Avatar className="h-10 w-10">
                  {selected.contact.avatarUrl ? (
                    <AvatarImage src={selected.contact.avatarUrl} alt={contactPrimaryLabel(selected.contact)} />
                  ) : null}
                  <AvatarFallback className="bg-primary/10 text-primary">
                    {contactInitials(selected.contact)}
                  </AvatarFallback>
                </Avatar>
              )}
              <div>
                <CardTitle className="text-base">
                  {selected ? contactPrimaryLabel(selected.contact) : t('inbox.selectConversation')}
                </CardTitle>
                {selected && (
                  <p className="text-xs text-muted-foreground">
                    {formatWhatsAppPhone(selected.contact.phone) || selected.status}
                  </p>
                )}
              </div>
            </div>
            {selected && (
              <div className="flex items-center gap-2">
                <Badge variant={selected.status === 'OPEN' ? 'success' : 'secondary'}>{selected.status}</Badge>
                <Button variant="ghost" size="icon" className="xl:hidden" onClick={() => setMobilePanel('tools')}>
                  <PanelRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </CardHeader>
          <CardContent className="flex min-h-0 flex-1 flex-col p-0">
            <ScrollArea className="min-h-0 flex-1 p-4">
              {detail ? (
                <div className="space-y-3">
                  {detail.messages?.map((message) => (
                    <motion.div
                      key={message.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={cn(
                        'max-w-[85%] rounded-2xl px-4 py-2.5 text-sm',
                        message.direction === 'OUTBOUND'
                          ? 'ml-auto bg-primary text-primary-foreground'
                          : 'bg-muted',
                      )}
                    >
                      {message.mediaStorageKey || ['IMAGE', 'STICKER', 'VIDEO', 'AUDIO', 'DOCUMENT'].includes(message.type) ? (
                        <div className="space-y-1.5">
                          <MessageMedia conversationId={detail.id} message={message} />
                          {message.text && <p className="whitespace-pre-wrap">{message.text}</p>}
                        </div>
                      ) : (
                        <p className="whitespace-pre-wrap">{message.text || message.type}</p>
                      )}
                      <span className="mt-1 block text-[10px] opacity-70">{message.status}</span>
                    </motion.div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              ) : (
                <EmptyState icon={ChannelIcon} title={t('inbox.noThread')} description={t('inbox.noThreadDesc')} />
              )}
            </ScrollArea>
            {selectedId && (
              <div className="shrink-0 border-t p-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/*,video/*,audio/*,.webp,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip"
                  className="hidden"
                  onChange={(event) => {
                    const files = event.target.files ? Array.from(event.target.files) : [];
                    if (files.length) stageAttachments(files);
                    event.target.value = '';
                  }}
                />
                {stickerPickerOpen && (
                  <div className="mb-2 rounded-lg border bg-muted/30 p-2">
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-xs font-semibold text-muted-foreground">{t('inbox.stickerLibrary')}</span>
                      <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => setStickerPickerOpen(false)}>
                        <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-8 gap-1">
                      {STICKER_EMOJIS.map((emoji) => (
                        <button
                          key={emoji}
                          type="button"
                          disabled={sending}
                          onClick={() => void sendStickerEmoji(emoji)}
                          className="rounded-md p-1 text-2xl transition-colors hover:bg-accent"
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {pendingAttachments.length > 0 && (
                  <div className="mb-2 space-y-2 rounded-lg border bg-muted/30 p-2">
                    <div className="flex flex-wrap gap-2">
                      {pendingAttachments.map((attachment) => (
                        <div key={attachment.id} className="relative">
                          {attachment.previewUrl ? (
                            attachment.file.type.startsWith('video/') ? (
                              <video src={attachment.previewUrl} className="h-16 w-16 rounded-md object-cover" muted />
                            ) : (
                              <img src={attachment.previewUrl} alt="" className="h-16 w-16 rounded-md object-cover" />
                            )
                          ) : (
                            <div className="flex h-16 w-16 items-center justify-center rounded-md bg-muted px-1 text-center text-[10px] text-muted-foreground">
                              {attachment.file.name.slice(0, 12)}
                            </div>
                          )}
                          <button
                            type="button"
                            onClick={() => removePendingAttachment(attachment.id)}
                            className="absolute -right-1.5 -top-1.5 rounded-full bg-background p-0.5 shadow"
                            title={t('inbox.removeAttachment')}
                          >
                            <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                          </button>
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">{pendingAttachments.length} {t('inbox.attachmentsCount')}</span>
                      <Input
                        value={mediaCaption}
                        onChange={(event) => setMediaCaption(event.target.value)}
                        placeholder={t('inbox.mediaCaption')}
                        className="flex-1 text-sm"
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') { event.preventDefault(); void sendPendingAttachments(); }
                        }}
                      />
                      <Button type="button" variant="ghost" size="icon" onClick={clearPendingAttachments} title={t('inbox.removeAttachment')}>
                        <Trash2 className="h-4 w-4 text-muted-foreground" />
                      </Button>
                      <Button type="button" size="icon" disabled={sending} onClick={() => void sendPendingAttachments()} title={t('inbox.sendMedia')}>
                        <Send className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
                {recording ? (
                  <div className="flex items-center gap-3 rounded-full border bg-muted/40 px-4 py-2">
                    <span className="flex items-center gap-2 text-sm text-destructive">
                      <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-destructive" />
                      {t('inbox.recording')}
                    </span>
                    <span className="flex-1" />
                    <Button type="button" variant="ghost" size="icon" onClick={() => stopRecording(true)} title={t('inbox.cancelRecording')}>
                      <Trash2 className="h-4 w-4 text-muted-foreground" />
                    </Button>
                    <Button type="button" size="icon" onClick={() => stopRecording(false)} title={t('inbox.stopAndSend')}>
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <form
                    onSubmit={(event: FormEvent<HTMLFormElement>) => {
                      event.preventDefault();
                      if (pendingAttachments.length) void sendPendingAttachments();
                      else void sendText();
                    }}
                    className="flex items-end gap-1.5"
                  >
                    <Button type="button" variant="ghost" size="icon" disabled={sending} onClick={() => setStickerPickerOpen((open) => !open)} title={t('inbox.sendSticker')}>
                      <Smile className="h-5 w-5 text-muted-foreground" />
                    </Button>
                    <Button type="button" variant="ghost" size="icon" disabled={sending} onClick={() => fileInputRef.current?.click()} title={t('inbox.attachFile')}>
                      <Paperclip className="h-5 w-5 text-muted-foreground" />
                    </Button>
                    <Textarea
                      value={text}
                      onChange={(event) => setText(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' && !event.shiftKey) {
                          event.preventDefault();
                          if (pendingAttachments.length) void sendPendingAttachments();
                          else void sendText();
                        }
                      }}
                      placeholder={t(channel.replyPlaceholderKey)}
                      rows={1}
                      className="max-h-32 min-h-[2.5rem] flex-1 resize-none py-2"
                    />
                    {text.trim() || pendingAttachments.length ? (
                      <Button type="submit" size="icon" disabled={sending} title={t('inbox.sendMedia')}>
                        <Send className="h-4 w-4" />
                      </Button>
                    ) : (
                      <Button type="button" size="icon" disabled={sending} onClick={() => void startRecording()} title={t('inbox.recordVoice')}>
                        <Mic className="h-4 w-4" />
                      </Button>
                    )}
                  </form>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className={cn('border-0 shadow-card xl:max-h-[calc(100vh-11rem)]', mobilePanel !== 'tools' && 'hidden xl:block')}>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">{t('inbox.tools')}</CardTitle>
            <Button variant="ghost" size="icon" className="xl:hidden" onClick={() => setMobilePanel('thread')}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {selectedId && (
              <div className="grid gap-2">
                <Button variant="outline" size="sm" onClick={() => patch('/conversations/:id/read')}>
                  {t('inbox.markRead')}
                </Button>
                <Button variant="outline" size="sm" onClick={() => patch('/conversations/:id/pin', { value: !(selected as Detail)?.isPinned })}>
                  <Pin className="h-3.5 w-3.5" /> {t('inbox.togglePin')}
                </Button>
                <Button variant="outline" size="sm" onClick={() => patch('/conversations/:id/archive', { value: !(selected as Detail)?.isArchived })}>
                  <Archive className="h-3.5 w-3.5" /> {t('inbox.toggleArchive')}
                </Button>
                <Button variant="outline" size="sm" onClick={() => patch('/conversations/:id/status', { status: selected?.status === 'CLOSED' ? 'OPEN' : 'CLOSED' })}>
                  {selected?.status === 'CLOSED' ? t('inbox.reopen') : t('inbox.close')}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (!selectedId) return;
                    markTikTokQualifiedLead(selectedId)
                      .then(() => window.alert(t('inbox.markQualifiedLeadSuccess')))
                      .catch((err) => window.alert(parseApiError(err)));
                  }}
                  title={t('inbox.markQualifiedLeadHint')}
                >
                  {t('inbox.markQualifiedLead')}
                </Button>
                <Separator />
                <p className="text-xs font-semibold uppercase text-muted-foreground">{t('inbox.aiControl')}</p>
                <Badge variant="outline" className="w-fit gap-1"><Bot className="h-3 w-3" /> {(detail as Detail)?.aiMode ?? 'AI_ACTIVE'}</Badge>
                <Button variant="outline" size="sm" onClick={() => submit('/ai/conversations/:id/transfer', { reason: 'CUSTOMER_REQUEST' }).catch(console.error)}>
                  <UserRound className="h-3.5 w-3.5" /> {t('inbox.transferHuman')}
                </Button>
                <Button variant="outline" size="sm" onClick={() => submit('/ai/conversations/:id/pause').catch(console.error)}>{t('inbox.pauseAi')}</Button>
                <Button variant="outline" size="sm" onClick={() => submit('/ai/conversations/:id/reactivate').catch(console.error)}>{t('inbox.reactivateAi')}</Button>
                <Separator />
                <form onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); submit('/conversations/:id/notes', { body: form.get('body') }).catch(console.error); event.currentTarget.reset(); }} className="space-y-2">
                  <Textarea name="body" placeholder={t('inbox.privateNote')} rows={2} />
                  <Button variant="secondary" size="sm" className="w-full">{t('inbox.addNote')}</Button>
                </form>
                <form onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); submit('/conversations/:id/comments', { body: form.get('body') }).catch(console.error); event.currentTarget.reset(); }} className="space-y-2">
                  <Textarea name="body" placeholder={t('inbox.internalComment')} rows={2} />
                  <Button variant="secondary" size="sm" className="w-full">{t('inbox.addComment')}</Button>
                </form>
              </div>
            )}
            {detail && (
              <ScrollArea className="max-h-64">
                <div className="space-y-3">
                  <div>
                    <h4 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">{t('inbox.notes')}</h4>
                    {(detail.notes?.length ?? 0) === 0 ? <p className="text-sm text-muted-foreground">{t('inbox.noNotes')}</p> : detail.notes?.map((note) => (
                      <p key={note.id} className="mb-2 rounded-lg bg-muted p-2.5 text-sm">{note.body}</p>
                    ))}
                  </div>
                  <div>
                    <h4 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">{t('inbox.comments')}</h4>
                    {(detail.comments?.length ?? 0) === 0 ? <p className="text-sm text-muted-foreground">{t('inbox.noComments')}</p> : detail.comments?.map((comment) => (
                      <p key={comment.id} className="mb-2 rounded-lg bg-muted p-2.5 text-sm">{comment.body}</p>
                    ))}
                  </div>
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
