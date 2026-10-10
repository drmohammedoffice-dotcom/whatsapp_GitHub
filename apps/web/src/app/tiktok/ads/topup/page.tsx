'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { AlertBanner } from '@/components/shared/alert-banner';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  fetchTikTokBusinessAdvertisers,
  fetchTikTokTopupInvoices,
  fetchTikTokTopupQuote,
  startTikTokTopup,
} from '@/lib/tiktok-business';
import { parseApiError } from '@/lib/utils';

const CURRENCY_LABELS: Record<string, string> = {
  IQD: 'دينار عراقي',
  USD: 'دولار أمريكي',
  SAR: 'ريال سعودي',
  AED: 'درهم إماراتي',
  EUR: 'يورو',
  KWD: 'دينار كويتي',
  QAR: 'ريال قطري',
  BHD: 'دينار بحريني',
  OMR: 'ريال عماني',
  EGP: 'جنيه مصري',
  JOD: 'دينار أردني',
};

function currencyLabel(code: string | null) {
  if (!code) return 'عملة الحساب';
  return CURRENCY_LABELS[code] ?? code;
}

function money(value: number, currency: string | null) {
  const digits = currency === 'IQD' ? 0 : 2;
  return `${Number(value || 0).toLocaleString('ar-IQ', { maximumFractionDigits: digits })} ${currency || ''}`.trim();
}

export default function TikTokTopupPage() {
  const [advertisers, setAdvertisers] = useState<Array<{ advertiserId: string; name: string | null; currency: string | null }>>([]);
  const [query, setQuery] = useState('');
  const [advertiserId, setAdvertiserId] = useState('');
  const [amount, setAmount] = useState('');
  const [quote, setQuote] = useState<{ currency: string | null; taxRate: number; balance: number; name: string | null; minAmount: number; usdToIqd: number } | null>(null);
  const [invoices, setInvoices] = useState<Awaited<ReturnType<typeof fetchTikTokTopupInvoices>>['invoices']>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const currency = (quote?.currency || advertisers.find((row) => row.advertiserId === advertiserId)?.currency || '').toUpperCase() || null;
  const minimum = currency === 'IQD' ? 13000 : currency ? 10 : 0;
  const numericAmount = Number(amount);
  const total = numericAmount > 0 ? numericAmount : 0;

  useEffect(() => {
    fetchTikTokBusinessAdvertisers()
      .then((data) => {
        setAdvertisers(data.advertisers);
        if (data.advertisers[0]) setAdvertiserId(data.advertisers[0].advertiserId);
      })
      .catch((err) => setError(parseApiError(err)));
    fetchTikTokTopupInvoices()
      .then((data) => setInvoices(data.invoices))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!advertiserId) return;
    fetchTikTokTopupQuote(advertiserId)
      .then((data) => {
        setQuote(data);
        setAmount(String((data.currency || '').toUpperCase() === 'IQD' ? 13000 : 10));
        setAdvertisers((current) =>
          current.map((row) => (row.advertiserId === advertiserId ? { ...row, currency: data.currency, name: data.name || row.name } : row)),
        );
      })
      .catch((err) => setError(parseApiError(err)));
  }, [advertiserId]);

  const filtered = useMemo(() => {
    const text = query.trim().toLowerCase();
    return advertisers.filter((row) => !text || (row.name ?? '').toLowerCase().includes(text) || row.advertiserId.includes(text));
  }, [advertisers, query]);

  async function pay() {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const started = await startTikTokTopup({ advertiserId, amount: numericAmount });
      setQuote((current) => (current ? { ...current, balance: started.balance } : current));
      setNotice(`تمت إضافة ${money(started.amount, started.currency)} مباشرة إلى حساب تيك توك. الرصيد الحالي ${money(started.balance, started.currency)}.`);
      const data = await fetchTikTokTopupInvoices().catch(() => null);
      if (data) setInvoices(data.invoices);
    } catch (err) {
      setError(parseApiError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell>
      <PageHeader
        title="تعبئة رصيد الحسابات الإعلانية"
        description="الحد الأدنى 10$ لحسابات الدولار و13000 د.ع لحسابات الدينار. المبلغ يُضاف مباشرة إلى الحساب الإعلاني على تيك توك من رصيد مركز الأعمال."
        actions={<Link className="text-sm underline" href="/tiktok/ads/create">العودة إلى الإعلانات</Link>}
      />
      {error && <AlertBanner className="mt-4" variant="error">{error}</AlertBanner>}
      {notice && <AlertBanner className="mt-4" variant="success">{notice}</AlertBanner>}
      <div className="mt-4 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <Card className="border-0 shadow-card">
          <CardHeader>
            <CardTitle>الحساب والمبلغ</CardTitle>
            <CardDescription>
              {currency ? `العملة: ${currencyLabel(currency)} (${currency})` : 'اختر حساباً لتظهر عملته'}
              {quote ? ` · الرصيد الحالي ${money(quote.balance, currency)}` : ''}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-2">
              <Label>بحث عن الحساب الإعلاني</Label>
              <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="اسم الحساب أو رقمه" />
              <div className="max-h-48 space-y-1 overflow-auto rounded-xl border p-2">
                {filtered.map((row) => (
                  <label key={row.advertiserId} className="flex items-center justify-between gap-3 rounded-lg px-2 py-2 text-sm hover:bg-muted">
                    <span className="flex items-center gap-2">
                      <input type="radio" name="topup-advertiser" checked={advertiserId === row.advertiserId} onChange={() => setAdvertiserId(row.advertiserId)} />
                      {row.name || row.advertiserId}
                    </span>
                    <span className="text-muted-foreground">{currencyLabel(row.currency)}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="grid gap-2">
              <Label>المبلغ ({currencyLabel(currency)})</Label>
              <Input type="number" min={minimum || 1} step={currency === 'IQD' ? 1 : 0.01} value={amount} onChange={(event) => setAmount(event.target.value)} />
              <p className="text-xs text-muted-foreground">
                {currency === 'IQD' ? 'الحد الأدنى 13000 د.ع' : currency === 'USD' ? 'الحد الأدنى 10$' : 'اختر حساباً لمعرفة الحد الأدنى'}
              </p>
            </div>
            <Button type="button" onClick={() => void pay()} disabled={busy || total <= 0 || numericAmount < minimum}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'إضافة الرصيد إلى تيك توك'}
            </Button>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-card">
          <CardHeader>
            <CardTitle>ملخص الدفع</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between"><span>المبلغ</span><span>{money(numericAmount || 0, currency)}</span></div>
            <div className="flex justify-between border-t pt-3 text-base font-semibold"><span>يُضاف إلى تيك توك</span><span>{money(total, currency)}</span></div>
            <p className="rounded-xl bg-muted px-3 py-2 text-xs leading-5 text-muted-foreground">
              لا تُفتح صفحة دفع خارجية. تيك توك ينقل المبلغ من رصيد مركز الأعمال إلى هذا الحساب الإعلاني فوراً.
            </p>
          </CardContent>
        </Card>
      </div>
      <Card className="mt-4 border-0 shadow-card">
        <CardHeader>
          <CardTitle>الفواتير</CardTitle>
          <CardDescription>تاريخ كل عملية تعبئة والمبلغ والعملة.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {invoices.length === 0 && <p className="py-6 text-sm text-muted-foreground">لا توجد فواتير تعبئة بعد.</p>}
          {invoices.map((row) => (
            <div key={row.id} className="rounded-2xl border p-3 text-sm">
              <div className="flex items-start justify-between gap-3">
                <p className="font-medium">{row.advertiserName || row.advertiserId}</p>
                <p>{row.status === 'COMPLETED' ? 'أُضيفت إلى تيك توك' : row.status === 'FAILED' ? 'فشلت' : 'بانتظار الدفع'}</p>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{new Date(row.paidAt || row.createdAt).toLocaleString('ar-IQ')}</p>
              <p className="mt-2">المبلغ {money(row.amount, row.currency)} · الضريبة {money(row.tax, row.currency)} · الإجمالي {money(row.total, row.currency)}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </AppShell>
  );
}
