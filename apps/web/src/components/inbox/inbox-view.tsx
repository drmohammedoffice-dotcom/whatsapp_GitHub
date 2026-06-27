'use client';

import { SOCKET_EVENTS } from '@watsapp/shared';
import { motion } from 'framer-motion';
import { Archive, ArrowLeft, Bot, PanelRight, Paperclip, Pin, Search, Send, UserRound } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { AppShell } from '@/components/layout/app-shell';
import { useTranslation } from '@/components/providers/locale-provider';
import { AlertBanner } from '@/components/shared/alert-banner';
import { EmptyState } from '@/components/shared/empty-state';
import { MessageMedia } from '@/components/inbox/message-media';
import { PageHeader } from '@/components/shared/page-header';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import type { ChannelDefinition } from '@/lib/channels';
import { api, apiUpload, cn, parseApiError } from '@/lib/utils';
import { createSocket } from '@/lib/socket';

type Conversation = { id: string; subject?: string; status: string; unreadCount: number; isArchived: boolean; isPinned: boolean; assigneeUserId?: string; aiMode?: string; contact: { displayName: string }; messages?: Message[] };
type Message = { id: string; direction: string; type: string; status: string; text?: string; createdAt: string; mediaStorageKey?: string | null; mediaMimeType?: string | null; mediaFileName?: string | null; mediaSizeBytes?: number | null };
type Detail = Omit<Conversation, 'messages'> & { aiMode?: string; messages: Message[]; notes: Array<{ id: string; body: string; author: { name: string } }>; comments: Array<{ id: string; body: string; author: { name: string } }>; tags: Array<{ label: { name: string; color: string } }>; events: Array<{ id: string; type: string; createdAt: string }> };

type InboxViewProps = {
  channel: ChannelDefinition;
};

export function InboxView({ channel }: InboxViewProps) {
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

  const selected = useMemo(() => detail ?? items.find((item) => item.id === selectedId) ?? null, [detail, items, selectedId]);

  async function load() {
    try {
      const query = new URLSearchParams();
      query.set('provider', channel.provider);
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
  }, [view, channel.provider]);

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
                        <AvatarFallback className="bg-primary/10 text-primary text-xs">
                          {conversation.contact.displayName.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate font-medium">{conversation.contact.displayName}</span>
                          {conversation.unreadCount > 0 && (
                            <Badge className="h-5 min-w-5 justify-center px-1.5">{conversation.unreadCount}</Badge>
                          )}
                        </div>
                        <p className="mt-0.5 truncate text-sm text-muted-foreground">
                          {conversation.messages?.[0]?.text || conversation.status}
                        </p>
                      </div>
                    </motion.button>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        <Card className={cn('flex flex-col overflow-hidden border-0 shadow-card xl:max-h-[calc(100vh-11rem)]', mobilePanel !== 'thread' && 'hidden xl:flex')}>
          <CardHeader className="flex flex-row items-center justify-between border-b pb-4">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" className="xl:hidden" onClick={() => setMobilePanel('list')}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
              {selected && (
                <Avatar className="h-10 w-10">
                  <AvatarFallback className="bg-primary/10 text-primary">
                    {selected.contact.displayName.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              )}
              <div>
                <CardTitle className="text-base">{selected?.contact.displayName ?? t('inbox.selectConversation')}</CardTitle>
                {selected && <p className="text-xs text-muted-foreground">{selected.status}</p>}
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
          <CardContent className="flex flex-1 flex-col p-0">
            <ScrollArea className="flex-1 p-4">
              {detail ? (
                <div className="space-y-3">
                  {detail.messages.map((message) => (
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
                      {message.mediaStorageKey ? (
                        <div className="space-y-1.5">
                          <MessageMedia conversationId={detail.id} message={message} />
                          {message.text && <p className="whitespace-pre-wrap">{message.text}</p>}
                        </div>
                      ) : (
                        <p>{message.text || message.type}</p>
                      )}
                      <span className="mt-1 block text-[10px] opacity-70">{message.status}</span>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <EmptyState icon={ChannelIcon} title={t('inbox.noThread')} description={t('inbox.noThreadDesc')} />
              )}
            </ScrollArea>
            {selectedId && (
              <div className="border-t p-4 space-y-2">
                <form
                  onSubmit={(event: FormEvent<HTMLFormElement>) => {
                    event.preventDefault();
                    const form = new FormData(event.currentTarget);
                    submit('/conversations/:id/reply', { text: form.get('text') }).catch(console.error);
                    event.currentTarget.reset();
                  }}
                  className="flex gap-2"
                >
                  <Input name="text" placeholder={t(channel.replyPlaceholderKey)} required className="flex-1" />
                  <Button type="submit" size="icon">
                    <Send className="h-4 w-4" />
                  </Button>
                </form>
                <form
                  onSubmit={async (event: FormEvent<HTMLFormElement>) => {
                    event.preventDefault();
                    if (!selectedId) return;
                    const formEl = event.currentTarget;
                    const form = new FormData(formEl);
                    if (!form.get('file')) return;
                    try {
                      await apiUpload(`/conversations/${selectedId}/reply/media`, form);
                      formEl.reset();
                      await Promise.all([load(), loadDetail(selectedId)]);
                    } catch (err) {
                      setError(parseApiError(err));
                    }
                  }}
                  className="flex flex-wrap items-center gap-2"
                >
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-xs">
                    <Paperclip className="h-3.5 w-3.5" />
                    <span>{t('inbox.attachMedia')}</span>
                    <input name="file" type="file" accept="image/*,video/*,audio/*,.webp,.pdf,.doc,.docx" className="hidden" required />
                  </label>
                  <Input name="caption" placeholder={t('inbox.mediaCaption')} className="max-w-[180px] text-xs" />
                  <label className="flex items-center gap-1.5 text-xs">
                    <input name="voiceNote" type="checkbox" value="true" className="rounded" />
                    {t('inbox.voiceNote')}
                  </label>
                  <Button type="submit" variant="secondary" size="sm">{t('inbox.sendMedia')}</Button>
                </form>
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
                    {detail.notes.length === 0 ? <p className="text-sm text-muted-foreground">{t('inbox.noNotes')}</p> : detail.notes.map((note) => (
                      <p key={note.id} className="mb-2 rounded-lg bg-muted p-2.5 text-sm">{note.body}</p>
                    ))}
                  </div>
                  <div>
                    <h4 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">{t('inbox.comments')}</h4>
                    {detail.comments.length === 0 ? <p className="text-sm text-muted-foreground">{t('inbox.noComments')}</p> : detail.comments.map((comment) => (
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
