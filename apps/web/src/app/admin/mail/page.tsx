'use client';

import { useEffect, useState } from 'react';
import { Copy, Eye, KeyRound, Loader2, Mail, Plus, RefreshCw, Trash2, Wand2 } from 'lucide-react';
import { MailboxPreviewModal } from '@/components/mail/mailbox-preview-modal';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  createAdminMailbox,
  createAdminMailboxAuto,
  deleteAdminMailbox,
  fetchAdminMailboxes,
  openAdminMailboxSession,
  revealAdminMailboxPassword,
  updateAdminMailbox,
  type AdminMailbox,
  type AdminMailboxCredentials,
} from '@/lib/admin-api';

export default function AdminMailPage() {
  const [rows, setRows] = useState<AdminMailbox[]>([]);
  const [q, setQ] = useState('');
  const [localPart, setLocalPart] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [credentials, setCredentials] = useState<AdminMailboxCredentials | null>(null);
  const [preview, setPreview] = useState<{ email: string; token: string } | null>(null);

  async function load(search = q) {
    try {
      const data = await fetchAdminMailboxes(search);
      setRows(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر التحميل');
    }
  }

  useEffect(() => {
    void load('');
  }, []);

  function showCreds(creds: AdminMailboxCredentials, message: string) {
    setCredentials(creds);
    setNotice(message);
  }

  async function createManual() {
    setBusy(true);
    setError(null);
    try {
      const result = await createAdminMailbox({
        localPart: localPart.trim() || undefined,
        password: password.trim() || undefined,
        displayName: displayName.trim() || undefined,
        notes: notes.trim() || undefined,
        autoGenerate: !localPart.trim() && !password.trim(),
      });
      showCreds(result.credentials, `تم إنشاء ${result.credentials.email}`);
      setLocalPart('');
      setPassword('');
      setDisplayName('');
      setNotes('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر الإنشاء');
    } finally {
      setBusy(false);
    }
  }

  async function createAuto() {
    if (!displayName.trim()) {
      setError('أدخل اسم المستخدم أولاً ثم اضغط إنشاء تلقائي');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await createAdminMailboxAuto({
        displayName: displayName.trim(),
        notes: notes.trim() || undefined,
      });
      const trialHint = result.subscriber
        ? ` · مشترك جات لورا + تجربة ${result.subscriber.trialDays} أيام بكل المميزات`
        : '';
      showCreds(result.credentials, `تم إنشاء ${result.credentials.email}${trialHint}`);
      setDisplayName('');
      setNotes('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر الإنشاء التلقائي');
    } finally {
      setBusy(false);
    }
  }

  async function rotate(id: string) {
    setBusy(true);
    setError(null);
    try {
      const result = await updateAdminMailbox(id, { rotatePassword: true });
      if (result.credentials) {
        showCreds(result.credentials, `تم توليد كلمة مرور جديدة لـ ${result.credentials.email}`);
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر التحديث');
    } finally {
      setBusy(false);
    }
  }

  async function reveal(id: string) {
    setBusy(true);
    setError(null);
    try {
      const creds = await revealAdminMailboxPassword(id);
      showCreds(creds, `كلمة مرور ${creds.email}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر العرض');
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(row: AdminMailbox) {
    setBusy(true);
    setError(null);
    try {
      await updateAdminMailbox(row.id, { isActive: !row.isActive });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر التحديث');
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string, email: string) {
    if (!window.confirm(`حذف الصندوق ${email}؟`)) return;
    setBusy(true);
    setError(null);
    try {
      await deleteAdminMailbox(id);
      setNotice(`تم حذف ${email}`);
      if (credentials?.email === email) setCredentials(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر الحذف');
    } finally {
      setBusy(false);
    }
  }

  async function copyText(text: string) {
    await navigator.clipboard.writeText(text);
    setNotice('تم النسخ');
  }

  async function openMail(id: string, email: string) {
    setBusy(true);
    setError(null);
    try {
      const session = await openAdminMailboxSession(id);
      setPreview({ email, token: session.accessToken });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر فتح البريد');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="بريد ChatLoora"
        description="إنشاء تلقائي متسلسل: customer1@ ثم customer2@… + مشترك جات لورا وتجربة 3 أيام بكل المميزات بدون OTP"
      />
      <section className="rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-950">
        <p className="font-medium">إعداد الاستقبال (مرة واحدة في Resend + DNS)</p>
        <ol className="mt-2 list-decimal space-y-1 pr-5">
          <li>في Resend → Domains → chatloora.com → فعّل Receiving وأضف سجل MX الذي يظهر.</li>
          <li>
            أنشئ Webhook على{' '}
            <code className="rounded bg-white px-1">https://www.chatloora.com/api/v1/webhooks/resend/inbound</code>{' '}
            لحدث <code className="rounded bg-white px-1">email.received</code> وضع Signing Secret في{' '}
            <code className="rounded bg-white px-1">RESEND_WEBHOOK_SECRET</code>.
          </li>
        </ol>
      </section>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {notice && <p className="text-sm text-emerald-700">{notice}</p>}

      {credentials && (
        <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
          <div className="mb-3 flex items-center gap-2 font-semibold text-emerald-900">
            <KeyRound className="h-4 w-4" />
            بيانات الدخول — سلّمها للزبون
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <p className="mb-1 text-xs text-muted-foreground">البريد</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 rounded-md bg-white px-3 py-2 text-sm">{credentials.email}</code>
                <Button type="button" size="sm" variant="outline" onClick={() => void copyText(credentials.email)}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div>
              <p className="mb-1 text-xs text-muted-foreground">كلمة المرور</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 break-all rounded-md bg-white px-3 py-2 text-sm">{credentials.password}</code>
                <Button type="button" size="sm" variant="outline" onClick={() => void copyText(credentials.password)}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
          <p className="mt-3 text-sm text-emerald-800">
            نفس البيانات لتسجيل الدخول في جات لورا (بدون رمز تأكيد). ويب ميل:{' '}
            <a className="underline" href="/mail" target="_blank" rel="noreferrer">
              /mail
            </a>
          </p>
        </section>
      )}

      <section className="space-y-4 rounded-2xl border border-primary/20 bg-primary/5 p-5">
        <h2 className="flex items-center gap-2 font-semibold">
          <Wand2 className="h-4 w-4" /> إنشاء مشترك تلقائي (ضغطة واحدة)
        </h2>
        <p className="text-sm text-muted-foreground">
          أدخل اسم المستخدم فقط — يُنشأ التالي (customer1 ثم customer2…) ويُضاف كمشترك مع تجربة 3 أيام بكل المميزات.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">اسم المستخدم / العميل</label>
            <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="اسم الزبون" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">ملاحظات (اختياري)</label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={1} placeholder="اختياري" />
          </div>
        </div>
        <Button type="button" size="lg" disabled={busy || !displayName.trim()} onClick={() => void createAuto()}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
          إنشاء بريد + مشترك تلقائي
        </Button>
      </section>

      <section className="space-y-4 rounded-2xl border p-5">
        <h2 className="flex items-center gap-2 font-semibold text-muted-foreground">
          <Plus className="h-4 w-4" /> إنشاء يدوي (اختياري)
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">الاسم المحلي (اختياري)</label>
            <div className="flex items-center gap-2">
              <Input value={localPart} onChange={(e) => setLocalPart(e.target.value)} placeholder="test" />
              <span className="shrink-0 text-sm text-muted-foreground">@chatloora.com</span>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">كلمة المرور (اختياري)</label>
            <Input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="اتركها فارغة للتوليد التلقائي"
            />
          </div>
        </div>
        <Button type="button" variant="outline" disabled={busy} onClick={() => void createManual()}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
          إنشاء يدوي
        </Button>
      </section>

      <section className="space-y-3 rounded-2xl border p-5">
        <div className="flex flex-wrap items-center gap-2">
          <Input
            className="max-w-xs"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="بحث عن بريد..."
          />
          <Button type="button" variant="outline" disabled={busy} onClick={() => void load(q)}>
            <RefreshCw className="h-4 w-4" />
            تحديث
          </Button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="px-2 py-2">البريد</th>
                <th className="px-2 py-2">الاسم</th>
                <th className="px-2 py-2">الحالة</th>
                <th className="px-2 py-2">آخر دخول</th>
                <th className="px-2 py-2">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b">
                  <td className="px-2 py-2 font-medium">{row.email}</td>
                  <td className="px-2 py-2">{row.displayName || '—'}</td>
                  <td className="px-2 py-2">
                    <button
                      type="button"
                      className={row.isActive ? 'text-emerald-700' : 'text-amber-700'}
                      onClick={() => void toggleActive(row)}
                    >
                      {row.isActive ? 'نشط' : 'موقوف'}
                    </button>
                  </td>
                  <td className="px-2 py-2 text-muted-foreground">
                    {row.lastLoginAt ? new Date(row.lastLoginAt).toLocaleString('ar') : '—'}
                  </td>
                  <td className="px-2 py-2">
                    <div className="flex flex-wrap gap-1">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        title="إظهار البريد"
                        onClick={() => void openMail(row.id, row.email)}
                      >
                        <Mail className="h-3.5 w-3.5" />
                      </Button>
                      <Button type="button" size="sm" variant="outline" disabled={busy} title="عرض كلمة المرور" onClick={() => void reveal(row.id)}>
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                      <Button type="button" size="sm" variant="outline" disabled={busy} title="تغيير كلمة المرور" onClick={() => void rotate(row.id)}>
                        <KeyRound className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        title="حذف"
                        onClick={() => void remove(row.id, row.email)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {!rows.length && (
                <tr>
                  <td colSpan={5} className="px-2 py-8 text-center text-muted-foreground">
                    لا توجد صناديق بعد — أنشئ أول بريد أعلاه
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {preview && (
        <MailboxPreviewModal
          open
          email={preview.email}
          accessToken={preview.token}
          onClose={() => setPreview(null)}
        />
      )}
    </div>
  );
}
