'use client';

import { useCallback, useEffect, useState } from 'react';
import { Copy, Eye, KeyRound, Loader2, Mail, Plus, Trash2, Wand2 } from 'lucide-react';
import { MailboxPreviewModal } from '@/components/mail/mailbox-preview-modal';
import { StaffIdentityBadge } from '@/components/staff/staff-identity-badge';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  createAdminMailbox,
  createAdminMailboxAuto,
  deleteAdminMailbox,
  fetchAdminMailboxes,
  fetchAdminMe,
  openAdminMailboxSession,
  revealAdminMailboxPassword,
  updateAdminMailbox,
  type AdminMailbox,
  type AdminMailboxCredentials,
} from '@/lib/admin-api';

export default function StaffMailPage() {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [rows, setRows] = useState<AdminMailbox[]>([]);
  const [localPart, setLocalPart] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [credentials, setCredentials] = useState<AdminMailboxCredentials | null>(null);
  const [preview, setPreview] = useState<{ email: string; token: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const me = await fetchAdminMe();
      const roles = me.roles?.length ? me.roles : me.role ? [me.role] : [];
      if (!roles.includes('MAILBOX_CREATOR') && me.role !== 'SUPER_ADMIN') {
        setAllowed(false);
        return;
      }
      setAllowed(true);
      setRows(await fetchAdminMailboxes());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر التحميل');
      setAllowed(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function createManual() {
    setBusy(true);
    setError(null);
    try {
      const result = await createAdminMailbox({
        localPart: localPart.trim() || undefined,
        password: password.trim() || undefined,
        displayName: displayName.trim() || undefined,
        autoGenerate: !localPart.trim() && !password.trim(),
      });
      setCredentials(result.credentials);
      setNotice(`تم إنشاء ${result.credentials.email}`);
      setLocalPart('');
      setPassword('');
      setDisplayName('');
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
      });
      setCredentials(result.credentials);
      const trialHint = result.subscriber
        ? ` · مشترك جات لورا + تجربة ${result.subscriber.trialDays} أيام (كل المميزات)`
        : '';
      setNotice(`تم إنشاء ${result.credentials.email}${trialHint}`);
      setDisplayName('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر الإنشاء');
    } finally {
      setBusy(false);
    }
  }

  async function reveal(id: string) {
    setBusy(true);
    setError(null);
    try {
      setCredentials(await revealAdminMailboxPassword(id));
      setNotice('كلمة المرور الحالية');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر العرض');
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
        setCredentials(result.credentials);
        setNotice('تم توليد كلمة مرور جديدة');
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر التحديث');
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string, email: string) {
    if (!window.confirm(`حذف ${email}؟`)) return;
    setBusy(true);
    setError(null);
    try {
      await deleteAdminMailbox(id);
      setNotice(`تم حذف ${email}`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر الحذف');
    } finally {
      setBusy(false);
    }
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

  if (allowed === false) {
    return <p className="text-sm text-muted-foreground">هذه الصفحة لمنشئ حسابات البريد فقط.</p>;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="إنشاء حسابات البريد"
        description="إنشاء تلقائي: customer1@chatloora.com ثم customer2… مع مشترك جات لورا وتجربة 3 أيام بكل المميزات. تظهر لك فقط الحسابات التي أنشأتها أنت — لا ترى إيميلات أو كلمات مرور موظفين آخرين."
        actions={<StaffIdentityBadge />}
      />
      {error && <p className="text-sm text-destructive">{error}</p>}
      {notice && <p className="text-sm text-emerald-700">{notice}</p>}

      {credentials && (
        <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
          <p className="mb-2 font-semibold text-emerald-900">بيانات الدخول (بريد + منصة جات لورا)</p>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="flex items-center gap-2">
              <code className="flex-1 rounded bg-white px-2 py-1.5 text-sm" dir="ltr">
                {credentials.email}
              </code>
              <Button type="button" size="sm" variant="outline" onClick={() => void navigator.clipboard.writeText(credentials.email)}>
                <Copy className="h-3.5 w-3.5" />
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <code className="flex-1 break-all rounded bg-white px-2 py-1.5 text-sm">{credentials.password}</code>
              <Button type="button" size="sm" variant="outline" onClick={() => void navigator.clipboard.writeText(credentials.password)}>
                <Copy className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
          <p className="mt-2 text-xs text-emerald-800">
            نفس البريد وكلمة المرور لتسجيل الدخول في جات لورا — البريد مفعّل مسبقاً ولا يطلب رمز التأكيد.
          </p>
        </section>
      )}

      <section className="space-y-3 rounded-2xl border border-primary/20 bg-primary/5 p-4">
        <h2 className="flex items-center gap-2 font-semibold">
          <Wand2 className="h-4 w-4" /> إنشاء مشترك تلقائي (ضغطة واحدة)
        </h2>
        <p className="text-xs text-muted-foreground">
          أدخل اسم المستخدم فقط — يُنشأ التالي في التسلسل (customer1 ثم customer2…) ويُفعَّل اشتراك تجريبي 3 أيام بكل المميزات.
        </p>
        <Input
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="اسم المستخدم / العميل"
          className="max-w-md"
        />
        <Button type="button" size="lg" disabled={busy || !displayName.trim()} onClick={() => void createAuto()}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
          إنشاء بريد + مشترك تلقائي
        </Button>
      </section>

      <section className="space-y-3 rounded-2xl border p-4">
        <h2 className="flex items-center gap-2 font-semibold text-muted-foreground">
          <Plus className="h-4 w-4" /> إنشاء يدوي (اختياري)
        </h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <Input value={localPart} onChange={(e) => setLocalPart(e.target.value)} placeholder="name (اختياري)" />
          <Input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="كلمة المرور (اختياري)" />
          <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="الاسم الظاهر" />
        </div>
        <Button type="button" variant="outline" disabled={busy} onClick={() => void createManual()}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
          إنشاء يدوي
        </Button>
      </section>

      <section className="overflow-x-auto rounded-2xl border">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b text-right text-muted-foreground">
              <th className="px-3 py-2">البريد</th>
              <th className="px-3 py-2">الاسم</th>
              <th className="px-3 py-2">الحالة</th>
              <th className="px-3 py-2">إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b">
                <td className="px-3 py-2 font-medium" dir="ltr">
                  {row.email}
                </td>
                <td className="px-3 py-2">{row.displayName || '—'}</td>
                <td className="px-3 py-2">{row.isActive ? 'نشط' : 'موقوف'}</td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-1">
                    <Button type="button" size="sm" variant="outline" disabled={busy} title="إظهار البريد" onClick={() => void openMail(row.id, row.email)}>
                      <Mail className="h-3.5 w-3.5" />
                    </Button>
                    <Button type="button" size="sm" variant="outline" disabled={busy} title="عرض كلمة المرور" onClick={() => void reveal(row.id)}>
                      <Eye className="h-3.5 w-3.5" />
                    </Button>
                    <Button type="button" size="sm" variant="outline" disabled={busy} title="تغيير كلمة المرور" onClick={() => void rotate(row.id)}>
                      <KeyRound className="h-3.5 w-3.5" />
                    </Button>
                    <Button type="button" size="sm" variant="outline" disabled={busy} title="حذف" onClick={() => void remove(row.id, row.email)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={4} className="px-3 py-8 text-center text-muted-foreground">
                  لا توجد صناديق بعد
                </td>
              </tr>
            )}
          </tbody>
        </table>
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
