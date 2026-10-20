'use client';

import { useEffect, useState } from 'react';
import { Loader2, Mail, RefreshCw, Send, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { API_URL } from '@/lib/utils';

type Props = {
  open: boolean;
  email: string;
  accessToken: string;
  onClose: () => void;
};

type MessageRow = {
  id: string;
  subject: string;
  from: string;
  date: string | null;
  seen: boolean;
  preview: string;
};

async function mailApi<T>(token: string, path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}/api/v1/webmail${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(init?.headers ?? {}),
    },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error((body as { message?: string }).message ?? `Request failed (${response.status})`);
  }
  return response.json() as Promise<T>;
}

export function MailboxPreviewModal({ open, email, accessToken, onClose }: Props) {
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [selected, setSelected] = useState<{
    id: string;
    subject: string;
    from: string;
    html: string | null;
    text: string | null;
  } | null>(null);
  const [composing, setComposing] = useState(false);
  const [to, setTo] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setBusy(true);
    setError(null);
    try {
      const data = await mailApi<{ messages: MessageRow[] }>(accessToken, '/messages?folder=INBOX&page=1');
      setMessages(data.messages);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر تحميل البريد');
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!open) return;
    setSelected(null);
    setComposing(false);
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, accessToken]);

  if (!open) return null;

  async function openMessage(id: string) {
    setBusy(true);
    setError(null);
    setComposing(false);
    try {
      const detail = await mailApi<{
        id: string;
        subject: string;
        from: string;
        html: string | null;
        text: string | null;
      }>(accessToken, `/messages/${encodeURIComponent(id)}?folder=INBOX`);
      setSelected(detail);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر فتح الرسالة');
    } finally {
      setBusy(false);
    }
  }

  async function send() {
    setBusy(true);
    setError(null);
    try {
      await mailApi(accessToken, '/send', {
        method: 'POST',
        body: JSON.stringify({ to: to.trim(), subject: subject.trim(), text: body }),
      });
      setComposing(false);
      setTo('');
      setSubject('');
      setBody('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر الإرسال');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-3" onClick={onClose}>
      <div
        className="flex h-[min(88vh,820px)] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        dir="rtl"
      >
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-[#1a73e8]" />
            <div>
              <p className="font-semibold">معاينة البريد</p>
              <p className="text-xs text-muted-foreground" dir="ltr">
                {email}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void load()}>
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button type="button" size="sm" className="bg-[#1a73e8] hover:bg-[#1557b0]" onClick={() => { setComposing(true); setSelected(null); }}>
              <Send className="h-4 w-4" />
              رسالة
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {error && <p className="border-b bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p>}

        <div className="flex min-h-0 flex-1">
          <div className="w-full max-w-sm overflow-y-auto border-l">
            {busy && !messages.length ? (
              <div className="flex justify-center p-8">
                <Loader2 className="h-5 w-5 animate-spin text-[#1a73e8]" />
              </div>
            ) : messages.length ? (
              messages.map((msg) => (
                <button
                  key={msg.id}
                  type="button"
                  className={`block w-full border-b px-3 py-2.5 text-right hover:bg-slate-50 ${selected?.id === msg.id ? 'bg-blue-50' : ''}`}
                  onClick={() => void openMessage(msg.id)}
                >
                  <p className={`truncate text-sm ${msg.seen ? '' : 'font-semibold'}`}>{msg.from || '—'}</p>
                  <p className="truncate text-sm">{msg.subject}</p>
                  <p className="truncate text-xs text-muted-foreground">{msg.preview}</p>
                </button>
              ))
            ) : (
              <p className="p-6 text-center text-sm text-muted-foreground">لا رسائل في الوارد</p>
            )}
          </div>

          <div className="min-w-0 flex-1 overflow-y-auto p-4">
            {composing ? (
              <div className="space-y-3">
                <Input value={to} onChange={(e) => setTo(e.target.value)} placeholder="إلى" dir="ltr" />
                <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="الموضوع" />
                <Textarea value={body} onChange={(e) => setBody(e.target.value)} className="min-h-[220px]" placeholder="نص الرسالة" />
                <Button type="button" disabled={busy || !to.trim() || !subject.trim() || !body.trim()} onClick={() => void send()}>
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  إرسال
                </Button>
              </div>
            ) : selected ? (
              <div>
                <h3 className="text-lg font-semibold">{selected.subject}</h3>
                <p className="mt-1 text-sm text-muted-foreground" dir="ltr">
                  {selected.from}
                </p>
                <div className="mt-4 text-sm leading-relaxed">
                  {selected.html ? (
                    <div dangerouslySetInnerHTML={{ __html: selected.html }} />
                  ) : (
                    <pre className="whitespace-pre-wrap font-sans">{selected.text}</pre>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                اختر رسالة أو أنشئ رسالة جديدة
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
