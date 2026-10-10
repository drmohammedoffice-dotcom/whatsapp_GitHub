'use client';

import { useEffect, useState } from 'react';
import { Loader2, Sparkles } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  askNoticeExpert,
  fetchAdminNotifications,
  fetchNoticeProgram,
  saveNoticeProgram,
  sendNoticeProgram,
  type SubscriberNoticeTemplate,
} from '@/lib/admin-api';

const LABELS: Record<string, string> = {
  EXPIRING: 'قرب انتهاء الاشتراك',
  EXPIRING_SOON: 'تذكير أخير قبل الانتهاء',
  RENEWAL_INVOICE: 'فاتورة تجديد الاشتراك',
  EXPIRED: 'انتهاء الاشتراك',
  ACTIVATED: 'تفعيل الاشتراك',
  PAYMENT: 'استلام الدفعة',
  MARKETING: 'رسالة تسويقية',
};

export default function AdminNotificationsPage() {
  const [templates, setTemplates] = useState<SubscriberNoticeTemplate[]>([]);
  const [logs, setLogs] = useState<Array<{ id: string; title: string; channel: string; sentAt: string | null; user?: { email: string } }>>([]);
  const [kind, setKind] = useState('MARKETING');
  const [audience, setAudience] = useState('active');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [brief, setBrief] = useState('اكتب رسالة تذكّر المشترك بتجديد الباقة قبل انتهائها');
  const [advice, setAdvice] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function load() {
    fetchNoticeProgram().then((data) => {
      setTemplates(data.templates);
      const marketing = data.templates.find((item) => item.kind === 'MARKETING');
      if (marketing) {
        setTitle(marketing.title);
        setBody(marketing.body);
      }
    }).catch((err: Error) => setError(err.message));
    fetchAdminNotifications().then(setLogs).catch(() => undefined);
  }

  useEffect(() => { load(); }, []);

  function update(kindName: string, patch: Partial<SubscriberNoticeTemplate>) {
    setTemplates((current) => current.map((item) => (item.kind === kindName ? { ...item, ...patch } : item)));
  }

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const saved = await saveNoticeProgram(templates);
      setTemplates(saved.templates);
      setNotice('تم حفظ إعدادات الإشعارات');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر الحفظ');
    } finally {
      setBusy(false);
    }
  }

  async function send() {
    setBusy(true);
    setError(null);
    try {
      const result = await sendNoticeProgram({ kind, audience, title, body });
      setNotice(`تم إرسال الإشعار إلى ${result.sent} مشترك`);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر الإرسال');
    } finally {
      setBusy(false);
    }
  }

  async function askExpert() {
    setBusy(true);
    setError(null);
    try {
      const draft = await askNoticeExpert(brief, kind);
      setTitle(draft.title);
      setBody(draft.body);
      setAdvice(draft.advice);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر سؤال الخبير');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="إشعارات المشتركين" description="رسائل تسويقية وتنبيهات الاشتراك وفاتورة التجديد، مع خبير يكتب النص" />
      {error && <p className="text-sm text-destructive">{error}</p>}
      {notice && <p className="text-sm text-emerald-700">{notice}</p>}

      <section className="rounded-2xl border bg-violet-50 p-5">
        <div className="mb-3 flex items-center gap-2 font-semibold"><Sparkles className="h-4 w-4" /> الخبير التسويقي</div>
        <Textarea value={brief} onChange={(event) => setBrief(event.target.value)} placeholder="صف الرسالة التي تريدها" />
        <Button type="button" className="mt-3" disabled={busy} onClick={() => void askExpert()}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'اقترح الرسالة'}
        </Button>
        {advice && <p className="mt-3 text-sm text-muted-foreground">{advice}</p>}
      </section>

      <section className="space-y-3 rounded-2xl border p-5">
        <h2 className="font-semibold">إرسال الآن</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <select className="h-10 rounded-md border bg-background px-3 text-sm" value={kind} onChange={(event) => setKind(event.target.value)}>
            {Object.entries(LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <select className="h-10 rounded-md border bg-background px-3 text-sm" value={audience} onChange={(event) => setAudience(event.target.value)}>
            <option value="active">المشتركون الفعّالون</option>
            <option value="expiring">من اقترب انتهاء اشتراكهم</option>
            <option value="expired">من انتهى اشتراكهم</option>
            <option value="all">كل الحسابات</option>
          </select>
        </div>
        <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="عنوان الإشعار" />
        <Textarea value={body} onChange={(event) => setBody(event.target.value)} placeholder="نص الإشعار. يمكن استخدام {name} {plan} {days} {amount}" />
        <Button type="button" disabled={busy} onClick={() => void send()}>إرسال الإشعار</Button>
      </section>

      <section className="space-y-4 rounded-2xl border p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">القوالب التلقائية</h2>
          <Button type="button" variant="outline" disabled={busy} onClick={() => void save()}>حفظ القوالب</Button>
        </div>
        <p className="text-sm text-muted-foreground">الإشعارات المفعّلة تُرسل تلقائياً داخل الحساب وعلى البريد عند اقتراب الانتهاء أو التجديد أو انتهاء الاشتراك.</p>
        {templates.map((item) => (
          <div key={item.kind} className="space-y-2 rounded-xl border p-4">
            <div className="flex items-center justify-between">
              <p className="font-medium">{LABELS[item.kind] ?? item.kind}</p>
              <Switch checked={item.enabled} onCheckedChange={(checked) => update(item.kind, { enabled: checked })} />
            </div>
            {['EXPIRING', 'EXPIRING_SOON', 'RENEWAL_INVOICE'].includes(item.kind) && (
              <Input dir="ltr" type="number" value={item.daysBefore} onChange={(event) => update(item.kind, { daysBefore: Number(event.target.value) })} />
            )}
            <Input value={item.title} onChange={(event) => update(item.kind, { title: event.target.value })} />
            <Textarea value={item.body} onChange={(event) => update(item.kind, { body: event.target.value })} />
          </div>
        ))}
      </section>

      <section className="rounded-2xl border p-5">
        <h2 className="mb-3 font-semibold">سجل الإرسال</h2>
        <div className="space-y-2">
          {logs.length === 0 ? <p className="text-sm text-muted-foreground">لا توجد إشعارات مرسلة بعد.</p> : logs.map((row) => (
            <div key={row.id} className="flex flex-wrap justify-between gap-2 border-b py-2 text-sm">
              <span>{row.title}</span>
              <span className="text-muted-foreground">{row.user?.email ?? 'عام'} · {row.sentAt ? new Date(row.sentAt).toLocaleString('ar-IQ') : '—'}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
