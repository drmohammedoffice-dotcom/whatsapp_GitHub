'use client';

import { FormEvent, useEffect, useState } from 'react';
import { Check, Copy, Loader2, LogOut } from 'lucide-react';
import { StaffIdentityBadge } from '@/components/staff/staff-identity-badge';
import { PageHeader } from '@/components/shared/page-header';
import { useTranslation } from '@/components/providers/locale-provider';
import { AlertBanner } from '@/components/shared/alert-banner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  cancelPartnerPayoutDraft,
  clearPartnerToken,
  confirmPartnerPayout,
  createPartnerPayout,
  fetchPartnerMe,
  fetchPartnerPayoutImageUrl,
  formatIqd,
  getPartnerToken,
  partnerLogin,
  resendPartnerPayoutCode,
  setPartnerToken,
  type PartnerDashboard,
} from '@/lib/partner-api';
import { parseApiError } from '@/lib/utils';

function toEnglishDigits(value: string) {
  return value
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[^\d.]/g, '');
}

function payoutStatus(status: string) {
  if (status === 'PAID') return 'تم التحويل';
  if (status === 'APPROVED') return 'موافق عليه';
  if (status === 'REJECTED' || status === 'CANCELLED') return 'مرفوض';
  if (status === 'AWAITING_EMAIL') return 'بانتظار تأكيد البريد';
  return 'قيد المراجعة';
}

export default function StaffPartnerEarningsPage() {
  const { t } = useTranslation();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [bootstrapping, setBootstrapping] = useState(true);
  const [data, setData] = useState<PartnerDashboard | null>(null);

  function loadDashboard() {
    return fetchPartnerMe().then((next) => {
      setData(next);
      setError(null);
      return next;
    });
  }

  useEffect(() => {
    if (!getPartnerToken()) {
      setBootstrapping(false);
      return;
    }
    loadDashboard()
      .catch((err) => {
        clearPartnerToken();
        setData(null);
        setError(parseApiError(err));
      })
      .finally(() => setBootstrapping(false));
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const form = new FormData(event.currentTarget);
    setLoading(true);
    try {
      const result = await partnerLogin(String(form.get('email') ?? ''), String(form.get('password') ?? ''));
      setPartnerToken(result.accessToken);
      await loadDashboard();
    } catch (err) {
      setError(parseApiError(err));
    } finally {
      setLoading(false);
    }
  }

  function logout() {
    clearPartnerToken();
    setData(null);
  }

  if (bootstrapping) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (data) {
    return (
      <div className="space-y-6">
        <PageHeader
          title={t('staff.partnerEarningsTitle')}
          description={t('staff.partnerEarningsDesc')}
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <StaffIdentityBadge />
              <Button type="button" variant="outline" size="sm" onClick={logout}>
                <LogOut className="me-2 h-4 w-4" />
                {t('common.signOut')}
              </Button>
            </div>
          }
        />
        {error && <AlertBanner message={error} onDismiss={() => setError(null)} />}
        <PartnerEarningsDashboard data={data} onChange={setData} onError={setError} />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={t('staff.partnerEarningsTitle')}
        description={t('staff.partnerEarningsDesc')}
        actions={<StaffIdentityBadge />}
      />

      <Card className="mt-6 max-w-md border-0 shadow-card">
        <CardContent className="space-y-4 pt-6">
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="partner-email">{t('partners.email')}</Label>
              <Input id="partner-email" name="email" type="email" autoComplete="username" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="partner-password">{t('staff.partnerEarningsCode')}</Label>
              <Input
                id="partner-password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                minLength={8}
              />
            </div>
            {error && <AlertBanner message={error} onDismiss={() => setError(null)} />}
            <Button className="w-full" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {loading ? t('auth.loggingIn') : t('staff.partnerEarningsLogin')}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function PartnerEarningsDashboard({
  data,
  onChange,
  onError,
}: {
  data: PartnerDashboard;
  onChange: (next: PartnerDashboard) => void;
  onError: (message: string | null) => void;
}) {
  const [copied, setCopied] = useState('');
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [amount, setAmount] = useState('10000');
  const [method, setMethod] = useState<'ZAIN_CASH' | 'MASTERCARD'>('ZAIN_CASH');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountName, setAccountName] = useState('');
  const [busy, setBusy] = useState(false);
  const [payoutId, setPayoutId] = useState('');
  const [code, setCode] = useState('');
  const [resendIn, setResendIn] = useState(0);
  const requested = Math.round(Number(amount) || 0);
  const net = requested >= 10000 ? requested - 500 : 0;

  useEffect(() => {
    const pending = (data.payouts ?? []).find((p) => p.status === 'AWAITING_EMAIL');
    if (pending && !payoutId) {
      setPayoutId(pending.id);
      setWithdrawOpen(true);
    }
  }, [data.payouts, payoutId]);

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = window.setTimeout(() => setResendIn((n) => Math.max(0, n - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [resendIn]);

  async function copy(value: string, key: string) {
    await navigator.clipboard.writeText(value);
    setCopied(key);
    window.setTimeout(() => setCopied(''), 1600);
  }

  async function reload() {
    const next = await fetchPartnerMe();
    onChange(next);
    return next;
  }

  async function closeWithdraw() {
    const draftId = payoutId;
    setWithdrawOpen(false);
    setPayoutId('');
    setCode('');
    setResendIn(0);
    if (draftId) {
      try {
        await cancelPartnerPayoutDraft(draftId);
        await reload();
      } catch {
        /* ignore */
      }
    }
  }

  async function submitPayout() {
    setBusy(true);
    onError(null);
    try {
      const result = await createPartnerPayout({
        amountCents: requested,
        method,
        accountNumber,
        accountName,
      });
      setPayoutId(result.id);
      setResendIn(15);
    } catch (err) {
      onError(parseApiError(err));
    } finally {
      setBusy(false);
    }
  }

  async function confirmCode() {
    setBusy(true);
    onError(null);
    try {
      await confirmPartnerPayout(payoutId, code);
      await reload();
      setWithdrawOpen(false);
      setPayoutId('');
      setCode('');
      setResendIn(0);
      setAccountNumber('');
      setAccountName('');
    } catch (err) {
      onError(parseApiError(err));
    } finally {
      setBusy(false);
    }
  }

  async function resendCode() {
    if (!payoutId || resendIn > 0) return;
    setBusy(true);
    onError(null);
    try {
      await resendPartnerPayoutCode(payoutId);
      setResendIn(15);
    } catch (err) {
      onError(parseApiError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="flex flex-wrap items-center gap-4 p-6">
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-semibold">{data.partner.name}</h1>
            <p className="text-sm text-muted-foreground">{data.partner.email}</p>
          </div>
          <Button
            type="button"
            onClick={() => {
              const available = Math.floor(data.stats.availablePayoutCents || 0);
              setAmount(String(available >= 10000 ? available : 10000));
              setWithdrawOpen(true);
            }}
          >
            طلب سحب المبلغ
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardContent className="space-y-3 p-5">
            <p className="text-sm text-muted-foreground">كود الإحالة</p>
            <div className="flex items-center gap-2">
              <p className="font-mono text-lg font-bold" dir="ltr">
                {data.partner.referralCode}
              </p>
              <Button type="button" size="sm" variant="outline" onClick={() => void copy(data.partner.referralCode || '', 'code')}>
                {copied === 'code' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">رابط الإحالة</p>
            <div className="flex items-center gap-2">
              <p className="truncate text-sm" dir="ltr">
                {data.partner.referralLink}
              </p>
              <Button type="button" size="sm" variant="outline" onClick={() => void copy(data.partner.referralLink || '', 'link')}>
                {copied === 'link' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </CardContent>
        </Card>
        <div className="grid grid-cols-2 gap-3">
          <Stat label="المشتركون" value={String(data.stats.customers)} />
          <Stat label="المفعلون" value={String(data.stats.activeSubscriptions)} />
          <Stat label="المنتهي اشتراكهم" value={String(data.stats.expiredSubscriptions)} />
          <Stat label="المتاح للسحب" value={formatIqd(data.stats.availablePayoutCents)} />
          <Stat label="المدفوع" value={formatIqd(data.stats.paidCents)} />
          <Stat label="قيد المراجعة" value={formatIqd(data.stats.pendingCents)} />
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
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                      لا يوجد مشتركون بعد.
                    </td>
                  </tr>
                ) : (
                  data.referrals.map((row) => (
                    <tr key={row.id} className="border-t">
                      <td className="px-4 py-2" dir="ltr">
                        {row.email || row.teamName}
                      </td>
                      <td className="px-4 py-2">{row.planName || '—'}</td>
                      <td className="px-4 py-2">
                        {row.subscriptionStatus === 'ACTIVE'
                          ? 'مفعّل'
                          : row.subscriptionStatus === 'EXPIRED'
                            ? 'منتهٍ'
                            : 'بدون اشتراك'}
                      </td>
                      <td className="px-4 py-2">{row.daysLeft ?? '—'}</td>
                    </tr>
                  ))
                )}
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
            ) : (
              data.payouts
                .filter((row) => row.status !== 'AWAITING_EMAIL')
                .map((row) => (
                  <div key={row.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm">
                    <div>
                      <p className="font-medium" dir="ltr">
                        {formatIqd(row.amountCents)}
                        {row.netCents != null ? ` · net ${formatIqd(row.netCents)}` : ''}
                      </p>
                      <p className="text-muted-foreground">
                        {row.method === 'MASTERCARD' ? 'ماستركارد' : row.method === 'ZAIN_CASH' ? 'زين كاش' : 'SuperQi'} ·{' '}
                        <span dir="ltr">{row.accountNumber}</span>
                      </p>
                      <p className="text-xs text-muted-foreground" dir="ltr">
                        {new Date(row.paidAt || row.createdAt).toLocaleString('en-GB', { hour12: false })}
                      </p>
                      {row.adminNote && <p className="text-muted-foreground">ملاحظة: {row.adminNote}</p>}
                    </div>
                    <div className="flex items-center gap-2">
                      <span>{payoutStatus(row.status)}</span>
                      {row.hasReceiptImage && (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            void fetchPartnerPayoutImageUrl(row.id, 'receipt').then((url) => window.open(url, '_blank'))
                          }
                        >
                          صورة التحويل
                        </Button>
                      )}
                    </div>
                  </div>
                ))
            )}
          </div>
        </CardContent>
      </Card>

      {withdrawOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => void closeWithdraw()}>
          <div className="w-full max-w-md space-y-4 rounded-2xl bg-background p-5" onClick={(event) => event.stopPropagation()}>
            {payoutId ? (
              <>
                <h2 className="text-lg font-semibold">تأكيد الرمز</h2>
                <p className="text-sm text-muted-foreground">أدخل رمز التأكيد الذي وصل إلى بريدك.</p>
                <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/40 dark:text-amber-100">
                  إذا لم يصلك الرمز، تفقد صندوق الرسائل غير المرغوب بها (Spam / Junk) ثم أعد الإرسال.
                </p>
                <Input dir="ltr" value={code} onChange={(event) => setCode(event.target.value)} placeholder="رمز التأكيد" />
                <div className="flex flex-wrap gap-2">
                  <Button type="button" disabled={busy} onClick={() => void confirmCode()}>
                    تأكيد السحب
                  </Button>
                  <Button type="button" variant="outline" disabled={busy || resendIn > 0} onClick={() => void resendCode()}>
                    {resendIn > 0 ? `إعادة الإرسال بعد ${resendIn}ث` : 'إعادة إرسال الرمز'}
                  </Button>
                  <Button type="button" variant="ghost" disabled={busy} onClick={() => void closeWithdraw()}>
                    إلغاء
                  </Button>
                </div>
              </>
            ) : (
              <>
                <h2 className="text-lg font-semibold">طلب سحب</h2>
                <p className="text-sm text-muted-foreground">
                  المتاح <span dir="ltr" className="font-mono">{formatIqd(data.stats.availablePayoutCents)}</span>. الأدنى{' '}
                  <span dir="ltr" className="font-mono">
                    10,000 IQD
                  </span>
                  ، وتُخصم{' '}
                  <span dir="ltr" className="font-mono">
                    500 IQD
                  </span>{' '}
                  رسوم تحويل.
                </p>
                <div className="flex items-end gap-2">
                  <div className="min-w-0 flex-1 space-y-2">
                    <Label>المبلغ</Label>
                    <Input
                      dir="ltr"
                      inputMode="numeric"
                      lang="en"
                      className="font-mono"
                      value={amount}
                      onChange={(event) => setAmount(toEnglishDigits(event.target.value))}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={data.stats.availablePayoutCents < 10000}
                    onClick={() => setAmount(String(Math.floor(data.stats.availablePayoutCents)))}
                  >
                    تحديد المبلغ كامل
                  </Button>
                </div>
                {requested >= 10000 && (
                  <p className="text-sm">
                    سيصلك <span dir="ltr" className="font-mono">{formatIqd(net)}</span> بعد خصم{' '}
                    <span dir="ltr" className="font-mono">
                      500 IQD
                    </span>
                  </p>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    className={`rounded-xl border p-3 text-sm ${method === 'ZAIN_CASH' ? 'border-violet-600 bg-violet-50' : ''}`}
                    onClick={() => setMethod('ZAIN_CASH')}
                  >
                    <span className="mb-1 block text-lg font-black text-violet-700">Zain Cash</span>
                    زين كاش
                  </button>
                  <button
                    type="button"
                    className={`rounded-xl border p-3 text-sm ${method === 'MASTERCARD' ? 'border-violet-600 bg-violet-50' : ''}`}
                    onClick={() => setMethod('MASTERCARD')}
                  >
                    <span className="mb-1 flex justify-center">
                      <span className="h-6 w-6 rounded-full bg-red-500" />
                      <span className="-ms-2 h-6 w-6 rounded-full bg-amber-400" />
                    </span>
                    ماستركارد
                  </button>
                </div>
                {method === 'ZAIN_CASH' ? (
                  <div className="space-y-2">
                    <Label>رقم هاتف زين كاش</Label>
                    <Input dir="ltr" value={accountNumber} onChange={(event) => setAccountNumber(event.target.value)} />
                  </div>
                ) : (
                  <>
                    <div className="space-y-2">
                      <Label>اسم صاحب البطاقة</Label>
                      <Input value={accountName} onChange={(event) => setAccountName(event.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>رقم البطاقة أو المحفظة</Label>
                      <Input dir="ltr" value={accountNumber} onChange={(event) => setAccountNumber(event.target.value)} />
                    </div>
                  </>
                )}
                <Button type="button" disabled={busy} onClick={() => void submitPayout()}>
                  تأكيد السحب
                </Button>
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
