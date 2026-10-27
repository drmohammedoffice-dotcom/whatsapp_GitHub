'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Inbox,
  Loader2,
  LogOut,
  Mail,
  Pencil,
  RefreshCw,
  Send,
  Trash2,
} from 'lucide-react';
import { ChatLooraBrand } from '@/components/brand/chatloora-brand';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  clearWebmailToken,
  deleteWebmailMessage,
  fetchWebmailFolders,
  fetchWebmailMe,
  fetchWebmailMessage,
  fetchWebmailMessages,
  getWebmailToken,
  sendWebmailMessage,
  setWebmailToken,
  webmailLogin,
} from '@/lib/webmail-api';

type Folder = { path: string; name: string; specialUse: string | null; exists: number; unseen: number };
type MessageRow = {
  id: string;
  uid: string;
  subject: string;
  from: string;
  to: string;
  date: string | null;
  seen: boolean;
  flagged: boolean;
  hasAttachments: boolean;
  preview: string;
};
type MessageDetail = {
  id: string;
  uid: string;
  subject: string;
  from: string;
  to: string;
  cc: string;
  date: string | null;
  html: string | null;
  text: string | null;
  attachments: Array<{ filename: string; contentType: string; size: number }>;
};

export default function MailPage() {
  const [ready, setReady] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [me, setMe] = useState<{ email: string; displayName: string | null } | null>(null);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [folder, setFolder] = useState('INBOX');
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [total, setTotal] = useState(0);
  const [selected, setSelected] = useState<MessageDetail | null>(null);
  const [composing, setComposing] = useState(false);
  const [to, setTo] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const folderLabel = useMemo(() => {
    const hit = folders.find((f) => f.path === folder);
    return hit?.name || folder;
  }, [folders, folder]);

  async function bootstrap() {
    const token = getWebmailToken();
    if (!token) {
      setReady(true);
      setAuthed(false);
      return;
    }
    try {
      const profile = await fetchWebmailMe();
      setMe(profile);
      setAuthed(true);
      await refreshAll();
    } catch {
      clearWebmailToken();
      setAuthed(false);
    } finally {
      setReady(true);
    }
  }

  useEffect(() => {
    void bootstrap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function refreshAll(nextFolder = folder) {
    setBusy(true);
    setError(null);
    try {
      const [folderList, list] = await Promise.all([
        fetchWebmailFolders(),
        fetchWebmailMessages(nextFolder, 1),
      ]);
      setFolders(folderList);
      setMessages(list.messages);
      setTotal(list.total);
      setFolder(list.folder);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر تحميل البريد');
    } finally {
      setBusy(false);
    }
  }

  async function onLogin(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = await webmailLogin(email.trim(), password);
      setWebmailToken(result.accessToken);
      setMe(result.mailbox);
      setAuthed(true);
      setPassword('');
      await refreshAll('INBOX');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'فشل تسجيل الدخول');
    } finally {
      setBusy(false);
    }
  }

  function logout() {
    clearWebmailToken();
    setAuthed(false);
    setMe(null);
    setMessages([]);
    setSelected(null);
    setFolders([]);
  }

  async function openMessage(id: string) {
    setBusy(true);
    setError(null);
    setComposing(false);
    try {
      const detail = await fetchWebmailMessage(id, folder);
      setSelected(detail);
      setMessages((rows) => rows.map((m) => (m.id === id ? { ...m, seen: true } : m)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر فتح الرسالة');
    } finally {
      setBusy(false);
    }
  }

  async function removeMessage(id: string) {
    setBusy(true);
    setError(null);
    try {
      await deleteWebmailMessage(id, folder);
      setSelected(null);
      await refreshAll(folder);
      setNotice('تم حذف الرسالة');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر الحذف');
    } finally {
      setBusy(false);
    }
  }

  async function sendMail(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await sendWebmailMessage({ to: to.trim(), subject: subject.trim(), text: body });
      setNotice('تم إرسال الرسالة');
      setComposing(false);
      setTo('');
      setSubject('');
      setBody('');
      await refreshAll(folder);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر الإرسال');
    } finally {
      setBusy(false);
    }
  }

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f6f8fc]">
        <Loader2 className="h-6 w-6 animate-spin text-[#1a73e8]" />
      </div>
    );
  }

  if (!authed) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,#d2e3fc,transparent_55%),linear-gradient(180deg,#f8fafc,#eef2f7)] px-4">
        <div className="w-full max-w-md rounded-3xl border border-white/70 bg-white/90 p-8 shadow-xl backdrop-blur">
          <div className="mb-6 text-center">
            <ChatLooraBrand href="/" size="lg" showTagline tagline="البريد الإلكتروني" />
            <p className="mt-3 text-sm text-slate-500">ادخل إلى صندوقك على chatloora.com</p>
          </div>
          <form className="space-y-4" onSubmit={onLogin}>
            <div>
              <label className="mb-1 block text-sm text-slate-600">البريد الإلكتروني</label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@chatloora.com"
                required
                autoComplete="username"
                dir="ltr"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-slate-600">كلمة المرور</label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                required
                autoComplete="current-password"
                dir="ltr"
              />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button type="submit" className="w-full bg-[#1a73e8] hover:bg-[#1557b0]" disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
              تسجيل الدخول
            </Button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-[#f6f8fc] text-slate-800">
      <header className="flex items-center justify-between gap-3 border-b bg-white px-4 py-3">
        <div className="flex items-center gap-3">
          <ChatLooraBrand href="/mail" size="sm" />
          <span className="hidden text-sm text-slate-500 sm:inline">{me?.email}</span>
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => void refreshAll(folder)}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button type="button" size="sm" className="bg-[#1a73e8] hover:bg-[#1557b0]" onClick={() => { setComposing(true); setSelected(null); }}>
            <Pencil className="h-4 w-4" />
            رسالة جديدة
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={logout}>
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>

      {(error || notice) && (
        <div className="border-b bg-white px-4 py-2 text-sm">
          {error && <p className="text-red-600">{error}</p>}
          {notice && !error && <p className="text-emerald-700">{notice}</p>}
        </div>
      )}

      <div className="flex min-h-0 flex-1">
        <aside className="hidden w-56 shrink-0 border-r bg-white p-3 md:block">
          <Button
            type="button"
            className="mb-3 w-full justify-start gap-2 bg-[#c2e7ff] text-slate-900 hover:bg-[#a8daff]"
            onClick={() => { setComposing(true); setSelected(null); }}
          >
            <Pencil className="h-4 w-4" />
            إنشاء
          </Button>
          <nav className="space-y-1">
            {folders.map((f) => (
              <button
                key={f.path}
                type="button"
                className={`flex w-full items-center justify-between rounded-full px-3 py-2 text-sm ${
                  folder === f.path ? 'bg-[#d3e3fd] font-medium text-[#041e49]' : 'hover:bg-slate-100'
                }`}
                onClick={() => {
                  setSelected(null);
                  setComposing(false);
                  void refreshAll(f.path);
                }}
              >
                <span className="flex items-center gap-2 truncate">
                  <Inbox className="h-4 w-4 shrink-0" />
                  {f.name}
                </span>
                {f.unseen > 0 && <span className="text-xs text-slate-500">{f.unseen}</span>}
              </button>
            ))}
            {!folders.length && (
              <p className="px-2 text-xs text-slate-500">المجلدات تظهر بعد الاتصال بخادم البريد</p>
            )}
          </nav>
        </aside>

        <section className="flex min-w-0 flex-1">
          <div className={`w-full border-r bg-white md:w-[380px] lg:w-[420px] ${selected || composing ? 'hidden md:block' : ''}`}>
            <div className="border-b px-4 py-3">
              <h2 className="font-medium">{folderLabel}</h2>
              <p className="text-xs text-slate-500">{total} رسالة</p>
            </div>
            <div className="max-h-[calc(100vh-9rem)] overflow-y-auto">
              {messages.map((msg) => (
                <button
                  key={msg.id}
                  type="button"
                  className={`block w-full border-b px-4 py-3 text-right transition hover:bg-[#f2f6fc] ${
                    selected?.id === msg.id ? 'bg-[#e8f0fe]' : ''
                  } ${msg.seen ? 'opacity-80' : 'bg-[#f8fbff]'}`}
                  onClick={() => void openMessage(msg.id)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className={`truncate text-sm ${msg.seen ? 'font-normal' : 'font-semibold'}`}>
                      {msg.from || '(مرسل غير معروف)'}
                    </span>
                    <span className="shrink-0 text-[11px] text-slate-400">
                      {msg.date ? new Date(msg.date).toLocaleDateString('ar') : ''}
                    </span>
                  </div>
                  <p className={`truncate text-sm ${msg.seen ? '' : 'font-medium'}`}>{msg.subject}</p>
                  <p className="truncate text-xs text-slate-500">{msg.preview}</p>
                </button>
              ))}
              {!messages.length && !busy && (
                <p className="p-8 text-center text-sm text-slate-500">لا توجد رسائل في هذا المجلد</p>
              )}
              {busy && !messages.length && (
                <div className="flex justify-center p-8">
                  <Loader2 className="h-5 w-5 animate-spin text-[#1a73e8]" />
                </div>
              )}
            </div>
          </div>

          <div className={`min-w-0 flex-1 bg-white ${!selected && !composing ? 'hidden md:flex md:items-center md:justify-center' : ''}`}>
            {composing ? (
              <form className="flex h-full flex-col p-4 md:p-6" onSubmit={sendMail}>
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-lg font-medium">رسالة جديدة</h2>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setComposing(false)}>
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                </div>
                <div className="space-y-3">
                  <Input value={to} onChange={(e) => setTo(e.target.value)} placeholder="إلى" required dir="ltr" />
                  <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="الموضوع" required />
                  <Textarea
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    placeholder="اكتب رسالتك..."
                    className="min-h-[280px]"
                    required
                  />
                </div>
                <div className="mt-4">
                  <Button type="submit" className="bg-[#1a73e8] hover:bg-[#1557b0]" disabled={busy}>
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    إرسال
                  </Button>
                </div>
              </form>
            ) : selected ? (
              <div className="flex h-full flex-col">
                <div className="flex items-start justify-between gap-3 border-b px-4 py-4 md:px-6">
                  <div className="min-w-0">
                    <button type="button" className="mb-2 text-sm text-slate-500 md:hidden" onClick={() => setSelected(null)}>
                      ← العودة للقائمة
                    </button>
                    <h2 className="text-xl font-medium">{selected.subject}</h2>
                    <p className="mt-1 text-sm text-slate-600" dir="ltr">{selected.from}</p>
                    <p className="text-xs text-slate-400">
                      {selected.date ? new Date(selected.date).toLocaleString('ar') : ''}
                    </p>
                  </div>
                  <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => void removeMessage(selected.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex-1 overflow-y-auto px-4 py-4 md:px-6">
                  {selected.html ? (
                    <div
                      className="prose prose-sm max-w-none"
                      dangerouslySetInnerHTML={{ __html: selected.html }}
                    />
                  ) : (
                    <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">{selected.text}</pre>
                  )}
                  {selected.attachments?.length > 0 && (
                    <div className="mt-6 rounded-xl border bg-slate-50 p-3">
                      <p className="mb-2 text-sm font-medium">مرفقات</p>
                      <ul className="space-y-1 text-sm text-slate-600">
                        {selected.attachments.map((a) => (
                          <li key={`${a.filename}-${a.size}`}>{a.filename} ({Math.round(a.size / 1024)} KB)</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="hidden flex-col items-center gap-2 text-slate-400 md:flex">
                <Mail className="h-10 w-10" />
                <p>اختر رسالة أو أنشئ رسالة جديدة</p>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
