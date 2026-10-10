'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, Copy, Eye, EyeOff, Handshake, Loader2, MessageCircle } from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { AlertBanner } from '@/components/shared/alert-banner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import {
  confirmSuccessPartner,
  confirmSuccessPayout,
  fetchSuccessPartner,
  requestSuccessPayout,
  resendSuccessCode,
  sendSuccessTicket,
  startSuccessPartner,
  successAvatarUrl,
  successReceiptUrl,
  uploadSuccessAvatar,
  type SuccessDashboard,
  type SuccessState,
} from '@/lib/success-partner';

function money(value: number) {
  return `${Number(value || 0).toLocaleString('ar-IQ')} د.ع`;
}

function payoutStatus(status: string) {
  if (status === 'PAID') return 'تم التحويل';
  if (status === 'APPROVED') return 'موافق عليه';
  if (status === 'REJECTED' || status === 'CANCELLED') return 'مرفوض';
  if (status === 'AWAITING_EMAIL') return 'بانتظار تأكيد البريد';
  return 'قيد المراجعة';
}

export default function SuccessPartnerPage() {
  return (
    <AppShell>
      <SuccessPartnerInner />
    </AppShell>
  );
}

function SuccessPartnerInner() {
  const [state, setState] = useState<SuccessState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [otpEmail, setOtpEmail] = useState<string | null>(null);

  function load() {
    setLoading(true);
    fetchSuccessPartner()
      .then((data) => {
        setError(null);
        setOtpEmail(null);
        setState(data.stage === 'verify' ? { stage: 'landing' } : data);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {error && <AlertBanner>{error}</AlertBanner>}
      {loading || !state ? (
        <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : state.stage === 'dashboard' ? (
        <Dashboard data={state} onChange={setState} onError={setError} />
      ) : (
        <Landing
          suggested={'suggested' in state ? state.suggested : undefined}
          onVerify={setOtpEmail}
          onError={setError}
        />
      )}
      <PartnerCodeDialog
        email={otpEmail}
        onClose={() => setOtpEmail(null)}
        onDone={(next) => {
          setOtpEmail(null);
          setState(next);
        }}
      />
    </div>
  );
}

function PasswordField({
  value,
  shown,
  onToggle,
  onChange,
}: {
  value: string;
  shown: boolean;
  onToggle: () => void;
  onChange: (value: string) => void;
}) {
  return (
    <div className="relative">
      <Input
        dir="ltr"
        type={shown ? 'text' : 'password'}
        autoComplete="new-password"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="pr-10"
      />
      <button
        type="button"
        className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground"
        onClick={onToggle}
        aria-label={shown ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
      >
        {shown ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

function ContactButton({ defaultEmail }: { defaultEmail: string }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'menu' | 'ticket' | 'sent'>('menu');
  const [email, setEmail] = useState(defaultEmail);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setMode('menu');
    setEmail(defaultEmail);
    setSubject('');
    setMessage('');
    setError(null);
  }, [open, defaultEmail]);

  async function send() {
    setBusy(true);
    setError(null);
    try {
      await sendSuccessTicket({ email, subject, message });
      setMode('sent');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر إرسال التذكرة');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button type="button" variant="secondary" onClick={() => setOpen(true)}>
        <MessageCircle className="me-2 h-4 w-4" />
        أرسل لنا رسالة
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>أرسل لنا رسالة</DialogTitle>
            <DialogDescription>
              {mode === 'ticket' ? 'اكتب تفاصيل التذكرة وسنراجعها.' : 'اختر طريقة التواصل.'}
            </DialogDescription>
          </DialogHeader>
          {mode === 'menu' && (
            <div className="grid gap-2">
              <Button type="button" onClick={() => setMode('ticket')}>إرسال تذكرة</Button>
              <Button type="button" variant="outline" asChild>
                <a href="https://wa.me/9647864314333" target="_blank" rel="noreferrer">تواصل معنا عبر الواتساب</a>
              </Button>
            </div>
          )}
          {mode === 'ticket' && (
            <div className="space-y-3">
              {error && <p className="text-sm text-destructive">{error}</p>}
              <div className="space-y-2">
                <Label>البريد الإلكتروني</Label>
                <Input dir="ltr" type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>عنوان التذكرة</Label>
                <Input value={subject} onChange={(event) => setSubject(event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>المشكلة أو الاستفسار</Label>
                <Textarea value={message} onChange={(event) => setMessage(event.target.value)} rows={4} />
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => setMode('menu')}>رجوع</Button>
                <Button type="button" disabled={busy} onClick={() => void send()}>
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'إرسال التذكرة'}
                </Button>
              </div>
            </div>
          )}
          {mode === 'sent' && (
            <div className="space-y-3">
              <p className="text-sm">تم إرسال التذكرة. سنراجعها ونتواصل معك.</p>
              <Button type="button" onClick={() => setOpen(false)}>إغلاق</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function Landing({
  suggested,
  onVerify,
  onError,
}: {
  suggested?: { name: string; email: string; phone: string };
  onVerify: (email: string) => void;
  onError: (message: string) => void;
}) {
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const accountEmail = suggested?.email ?? '';
  const [form, setForm] = useState({
    name: suggested?.name ?? '',
    age: '',
    city: '',
    phone: suggested?.phone ?? '',
    password: '',
    passwordConfirm: '',
  });

  async function submit() {
    if (!accountEmail) {
      onError('حسابك لا يملك بريداً إلكترونياً');
      return;
    }
    if (form.password.length < 8) {
      onError('كلمة المرور يجب أن تكون 8 أحرف على الأقل');
      return;
    }
    if (form.password !== form.passwordConfirm) {
      onError('كلمتا المرور غير متطابقتين');
      return;
    }
    setBusy(true);
    onError('');
    try {
      const result = await startSuccessPartner({
        ...form,
        email: accountEmail,
        age: Number(form.age),
      });
      onVerify(result.email);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'تعذر إرسال رمز التأكيد');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden border-0 bg-gradient-to-l from-violet-700 to-fuchsia-600 text-white shadow-card">
        <CardContent className="space-y-4 p-8">
          <div className="flex items-center gap-3">
            <Handshake className="h-8 w-8" />
            <h1 className="text-2xl font-bold">كن شريكنا بالنجاح</h1>
          </div>
          <ContactButton defaultEmail={accountEmail} />
          <p className="max-w-2xl text-sm leading-7 text-white/90">
            شارك رابطك أو كود الإحالة. كل شخص يسجّل من الرابط أو يكتب الكود عند إنشاء الحساب يُحسب من زبائنك.
            وعند كل اشتراك أو تجديد اشتراك تُضاف لك نسبة ثابتة في إحصائياتك.
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl bg-white/15 p-4"><p className="text-xs text-white/80">الباقة الأولى</p><p className="mt-1 text-xl font-bold">5,000 د.ع</p></div>
            <div className="rounded-2xl bg-white/15 p-4"><p className="text-xs text-white/80">الباقة الثانية</p><p className="mt-1 text-xl font-bold">10,000 د.ع</p></div>
            <div className="rounded-2xl bg-white/15 p-4"><p className="text-xs text-white/80">الباقة الثالثة</p><p className="mt-1 text-xl font-bold">15,000 د.ع</p></div>
          </div>
        </CardContent>
      </Card>
      {!agreed ? (
        <Card>
          <CardContent className="space-y-4 p-6 text-sm leading-7">
            <h2 className="text-lg font-semibold">كيف يعمل البرنامج</h2>
            <ul className="list-disc space-y-2 pe-5 text-muted-foreground">
              <li>نطلب اسمك وعمرك وسكنك ورقم هاتفك وكلمة مرور. البريد هو بريد حسابك ولا يمكن تغييره، ويصلك رمز التأكيد عليه.</li>
              <li>بعد التأكيد تحصل على كود إحالة ورابط إحالة خاصين بك.</li>
              <li>التسجيل عبر الرابط أو كتابة الكود عند إنشاء الحساب يربط الزبون بك.</li>
              <li>كل اشتراك جديد أو تجديد يضيف 5 آلاف أو 10 آلاف أو 15 ألف دينار حسب الباقة.</li>
              <li>عندما يصل رصيدك إلى 10,000 دينار يمكنك طلب السحب. تُخصم 500 دينار رسوم تحويل، ويصلك الباقي عبر زين كاش أو ماستركارد.</li>
            </ul>
            <Button type="button" onClick={() => setAgreed(true)}>أوافق وأبدأ</Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="grid gap-4 p-6 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2"><Label>الاسم الكامل</Label><Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></div>
            <div className="space-y-2"><Label>العمر</Label><Input dir="ltr" type="number" value={form.age} onChange={(event) => setForm({ ...form, age: event.target.value })} /></div>
            <div className="space-y-2"><Label>السكن</Label><Input value={form.city} onChange={(event) => setForm({ ...form, city: event.target.value })} /></div>
            <div className="space-y-2"><Label>رقم الهاتف</Label><Input dir="ltr" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></div>
            <div className="space-y-2">
              <Label>البريد الإلكتروني</Label>
              <Input dir="ltr" type="email" value={accountEmail} readOnly disabled />
              <p className="text-xs text-muted-foreground">بريد حسابك، ولا يمكن تعديله.</p>
            </div>
            <div className="space-y-2">
              <Label>كلمة المرور</Label>
              <PasswordField value={form.password} shown={showPassword} onToggle={() => setShowPassword((value) => !value)} onChange={(password) => setForm({ ...form, password })} />
            </div>
            <div className="space-y-2">
              <Label>إعادة كلمة المرور</Label>
              <PasswordField value={form.passwordConfirm} shown={showConfirm} onToggle={() => setShowConfirm((value) => !value)} onChange={(passwordConfirm) => setForm({ ...form, passwordConfirm })} />
            </div>
            <div className="sm:col-span-2"><Button type="button" disabled={busy} onClick={() => void submit()}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'البدء'}</Button></div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function PartnerCodeDialog({
  email,
  onClose,
  onDone,
}: {
  email: string | null;
  onClose: () => void;
  onDone: (state: SuccessState) => void;
}) {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(60);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!email) return;
    setCode('');
    setError(null);
    setCooldown(60);
    const timer = window.setTimeout(() => inputRef.current?.focus(), 80);
    return () => window.clearTimeout(timer);
  }, [email]);

  useEffect(() => {
    if (!email || cooldown <= 0) return;
    const timer = window.setInterval(() => setCooldown((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [email, cooldown]);

  async function submit(value: string) {
    if (value.length !== 6) return;
    setBusy(true);
    setError(null);
    try {
      onDone(await confirmSuccessPartner(value));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'رمز غير صحيح');
      setCode('');
      inputRef.current?.focus();
    } finally {
      setBusy(false);
    }
  }

  function applyCode(raw: string) {
    const next = raw.replace(/\D/g, '').slice(0, 6);
    setCode(next);
    if (next.length === 6) void submit(next);
  }

  return (
    <Dialog open={Boolean(email)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="text-center sm:text-center">
          <DialogTitle>تحقق من بريدك الإلكتروني</DialogTitle>
          <DialogDescription>أرسلنا رمزاً مكوناً من 6 أرقام إلى {email}</DialogDescription>
        </DialogHeader>
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-center text-xs text-amber-950">لم تصلك الرسالة؟ تحقق من صندوق الرسائل غير المرغوب بها.</p>
        {error && <p className="text-center text-sm text-destructive">{error}</p>}
        <div dir="ltr" className="relative mx-auto w-fit">
          <div className="pointer-events-none flex justify-center gap-2">
            {Array.from({ length: 6 }, (_, index) => (
              <span
                key={index}
                className={cn('flex h-12 w-10 items-center justify-center rounded-xl border-2 text-xl font-bold', code[index] && 'border-primary/50')}
              >
                {code[index] ?? ''}
              </span>
            ))}
          </div>
          <input
            ref={(node) => { inputRef.current = node; }}
            dir="ltr"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            disabled={busy}
            value={code}
            aria-label="رمز التأكيد"
            onChange={(event) => applyCode(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== 'Backspace') return;
              event.preventDefault();
              setCode((current) => current.slice(0, -1));
            }}
            onFocus={(event) => {
              const end = event.currentTarget.value.length;
              event.currentTarget.setSelectionRange(end, end);
            }}
            onPaste={(event) => {
              event.preventDefault();
              applyCode(event.clipboardData.getData('text'));
            }}
            className="absolute inset-0 cursor-text opacity-0"
          />
        </div>
        <Button
          type="button"
          variant="outline"
          disabled={busy || cooldown > 0}
          onClick={() => void resendSuccessCode().then(() => setCooldown(60)).catch((err: Error) => setError(err.message))}
        >
          {cooldown > 0 ? `إعادة الإرسال خلال ${cooldown} ثانية` : 'إعادة إرسال الرمز'}
        </Button>
      </DialogContent>
    </Dialog>
  );
}

function Dashboard({
  data,
  onChange,
  onError,
}: {
  data: SuccessDashboard;
  onChange: (state: SuccessState) => void;
  onError: (message: string) => void;
}) {
  const [avatar, setAvatar] = useState('');
  const [copied, setCopied] = useState('');
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [amount, setAmount] = useState('10000');
  const [method, setMethod] = useState<'ZAIN_CASH' | 'MASTERCARD'>('ZAIN_CASH');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountName, setAccountName] = useState('');
  const [busy, setBusy] = useState(false);
  const [payoutId, setPayoutId] = useState('');
  const [code, setCode] = useState('');
  const requested = Math.round(Number(amount) || 0);
  const net = requested >= 10000 ? requested - 500 : 0;

  useEffect(() => {
    if (!data.partner.hasAvatar) return;
    let url = '';
    successAvatarUrl().then((next) => {
      url = next;
      setAvatar(next);
    });
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [data.partner.hasAvatar]);

  async function copy(value: string, key: string) {
    await navigator.clipboard.writeText(value);
    setCopied(key);
  }

  async function onAvatar(file?: File) {
    if (!file) return;
    setBusy(true);
    try {
      await uploadSuccessAvatar(file);
      const url = await successAvatarUrl();
      setAvatar(url);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'تعذر رفع الصورة');
    } finally {
      setBusy(false);
    }
  }

  async function submitPayout() {
    setBusy(true);
    onError('');
    try {
      const result = await requestSuccessPayout({ amountCents: requested, method, accountNumber, accountName });
      setPayoutId(result.id);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'تعذر إنشاء طلب السحب');
    } finally {
      setBusy(false);
    }
  }

  async function confirmCode() {
    setBusy(true);
    try {
      const next = await confirmSuccessPayout(payoutId, code);
      onChange(next);
      setWithdrawOpen(false);
      setPayoutId('');
      setCode('');
    } catch (err) {
      onError(err instanceof Error ? err.message : 'رمز غير صحيح');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="flex flex-wrap items-center gap-4 p-6">
          <label className="relative h-20 w-20 cursor-pointer overflow-hidden rounded-full bg-muted">
            {avatar ? <img src={avatar} alt="" className="h-full w-full object-cover" /> : <span className="flex h-full items-center justify-center text-xs">صورة</span>}
            <input type="file" accept="image/*" className="hidden" onChange={(event) => void onAvatar(event.target.files?.[0])} />
          </label>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-semibold">{data.partner.name}</h1>
            <p className="text-sm text-muted-foreground">{data.partner.city} · {data.partner.age ?? '—'} سنة · {data.partner.phone}</p>
            <p className="text-sm text-muted-foreground">{data.partner.email}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <ContactButton defaultEmail={data.partner.email} />
            <Button type="button" onClick={() => setWithdrawOpen(true)}>طلب سحب المبلغ</Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardContent className="space-y-3 p-5">
            <p className="text-sm text-muted-foreground">كود الإحالة</p>
            <div className="flex items-center gap-2">
              <p className="font-mono text-lg font-bold" dir="ltr">{data.partner.referralCode}</p>
              <Button type="button" size="sm" variant="outline" onClick={() => void copy(data.partner.referralCode || '', 'code')}>{copied === 'code' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}</Button>
            </div>
            <p className="text-sm text-muted-foreground">رابط الإحالة</p>
            <div className="flex items-center gap-2">
              <p className="truncate text-sm" dir="ltr">{data.partner.referralLink}</p>
              <Button type="button" size="sm" variant="outline" onClick={() => void copy(data.partner.referralLink || '', 'link')}>{copied === 'link' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}</Button>
            </div>
          </CardContent>
        </Card>
        <div className="grid grid-cols-2 gap-3">
          <Stat label="المشتركون" value={String(data.stats.customers)} />
          <Stat label="المفعلون" value={String(data.stats.activeSubscriptions)} />
          <Stat label="المنتهي اشتراكهم" value={String(data.stats.expiredSubscriptions)} />
          <Stat label="المتاح للسحب" value={money(data.stats.availablePayoutCents)} />
          <Stat label="المدفوع" value={money(data.stats.paidCents)} />
          <Stat label="قيد المراجعة" value={money(data.stats.pendingCents)} />
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="border-b px-5 py-3 font-medium">المشتركون من خلالك</div>
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead className="text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 text-right">البريد</th>
                  <th className="px-4 py-2 text-right">الباقة</th>
                  <th className="px-4 py-2 text-right">الحالة</th>
                  <th className="px-4 py-2 text-right">الأيام المتبقية</th>
                </tr>
              </thead>
              <tbody>
                {data.referrals.length === 0 ? (
                  <tr><td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">لا يوجد مشتركون بعد.</td></tr>
                ) : data.referrals.map((row) => (
                  <tr key={row.id} className="border-t">
                    <td className="px-4 py-2" dir="ltr">{row.email || row.teamName}</td>
                    <td className="px-4 py-2">{row.planName || '—'}</td>
                    <td className="px-4 py-2">{row.subscriptionStatus === 'ACTIVE' ? 'مفعّل' : row.subscriptionStatus === 'EXPIRED' ? 'منتهٍ' : 'بدون اشتراك'}</td>
                    <td className="px-4 py-2">{row.daysLeft ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="border-b px-5 py-3 font-medium">سجل طلبات السحب</div>
          <div className="divide-y">
            {data.payouts.filter((row) => row.status !== 'AWAITING_EMAIL').length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-muted-foreground">لا توجد طلبات سحب.</p>
            ) : data.payouts.filter((row) => row.status !== 'AWAITING_EMAIL').map((row) => (
              <div key={row.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm">
                <div>
                  <p className="font-medium">{money(row.amountCents)} · يصلك {money(row.netCents)}</p>
                  <p className="text-muted-foreground">{row.method === 'MASTERCARD' ? 'ماستركارد' : 'زين كاش'} · {row.accountNumber}</p>
                  {row.adminNote && <p className="text-muted-foreground">ملاحظة: {row.adminNote}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <span>{payoutStatus(row.status)}</span>
                  {row.hasReceiptImage && (
                    <Button type="button" size="sm" variant="outline" onClick={() => void successReceiptUrl(row.id).then((url) => window.open(url, '_blank'))}>صورة التحويل</Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {withdrawOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setWithdrawOpen(false)}>
          <div className="w-full max-w-md space-y-4 rounded-2xl bg-background p-5" onClick={(event) => event.stopPropagation()}>
            {payoutId ? (
              <>
                <h2 className="text-lg font-semibold">تأكيد الرمز</h2>
                <p className="text-sm text-muted-foreground">أدخل رمز التأكيد الذي وصل إلى بريدك.</p>
                <Input dir="ltr" value={code} onChange={(event) => setCode(event.target.value)} />
                <Button type="button" disabled={busy} onClick={() => void confirmCode()}>تأكيد السحب</Button>
              </>
            ) : (
              <>
                <h2 className="text-lg font-semibold">طلب سحب</h2>
                <p className="text-sm text-muted-foreground">المتاح {money(data.stats.availablePayoutCents)}. الأدنى 10,000 د.ع، وتُخصم 500 د.ع رسوم تحويل.</p>
                <Label>المبلغ</Label>
                <Input dir="ltr" type="number" min={10000} value={amount} onChange={(event) => setAmount(event.target.value)} />
                {requested >= 10000 && <p className="text-sm">سيصلك {money(net)} بعد خصم 500 د.ع</p>}
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" className={`rounded-xl border p-3 text-sm ${method === 'ZAIN_CASH' ? 'border-violet-600 bg-violet-50' : ''}`} onClick={() => setMethod('ZAIN_CASH')}>
                    <ZainMark />
                    زين كاش
                  </button>
                  <button type="button" className={`rounded-xl border p-3 text-sm ${method === 'MASTERCARD' ? 'border-violet-600 bg-violet-50' : ''}`} onClick={() => setMethod('MASTERCARD')}>
                    <CardMark />
                    ماستركارد
                  </button>
                </div>
                {method === 'ZAIN_CASH' ? (
                  <div className="space-y-2"><Label>رقم هاتف زين كاش</Label><Input dir="ltr" value={accountNumber} onChange={(event) => setAccountNumber(event.target.value)} /></div>
                ) : (
                  <>
                    <div className="space-y-2"><Label>اسم صاحب البطاقة</Label><Input value={accountName} onChange={(event) => setAccountName(event.target.value)} /></div>
                    <div className="space-y-2"><Label>رقم البطاقة أو المحفظة</Label><Input dir="ltr" value={accountNumber} onChange={(event) => setAccountNumber(event.target.value)} /></div>
                  </>
                )}
                <Button type="button" disabled={busy} onClick={() => void submitPayout()}>تأكيد السحب</Button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="mt-1 font-semibold">{value}</p>
      </CardContent>
    </Card>
  );
}

function ZainMark() {
  return <span className="mb-1 block text-lg font-black text-violet-700">Zain Cash</span>;
}

function CardMark() {
  return (
    <span className="mb-1 flex justify-center">
      <span className="h-6 w-6 rounded-full bg-red-500" />
      <span className="-ms-2 h-6 w-6 rounded-full bg-amber-400" />
    </span>
  );
}
