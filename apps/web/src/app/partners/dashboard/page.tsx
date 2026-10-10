'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Copy, LogOut } from 'lucide-react';
import { ChatLooraBrand } from '@/components/brand/chatloora-brand';
import { useTranslation } from '@/components/providers/locale-provider';
import { LanguageToggle } from '@/components/shared/language-toggle';
import { PageHeader } from '@/components/shared/page-header';
import { AlertBanner } from '@/components/shared/alert-banner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  changePartnerPassword,
  clearPartnerToken,
  confirmPartnerPayout,
  createPartnerPayout,
  fetchPartnerMe,
  fetchPartnerPayoutImageUrl,
  formatIqd,
  getPartnerToken,
  resendPartnerPayoutCode,
  type PartnerDashboard,
} from '@/lib/partner-api';
import { parseApiError } from '@/lib/utils';

function PartnerReceipt({ id }: { id: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let objectUrl: string | null = null;
    fetchPartnerPayoutImageUrl(id, 'receipt')
      .then((next) => {
        objectUrl = next;
        setUrl(next);
      })
      .catch(() => setUrl(null));
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [id]);
  if (!url) return null;
  return <img src={url} alt="" className="max-h-28 rounded-md border object-contain" />;
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <Card className="border-0 shadow-card">
      <CardContent className="pt-6">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="mt-1 text-2xl font-semibold">{value}</p>
      </CardContent>
    </Card>
  );
}

export default function PartnerDashboardPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const [data, setData] = useState<PartnerDashboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [withdrawAll, setWithdrawAll] = useState(false);
  const [amount, setAmount] = useState('');
  const [account, setAccount] = useState('');
  const [cardFile, setCardFile] = useState<File | undefined>();
  const [draftId, setDraftId] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function reload() {
    return fetchPartnerMe().then((next) => {
      setData(next);
      return next;
    });
  }

  useEffect(() => {
    if (!getPartnerToken()) {
      router.replace('/partners/login');
      return;
    }
    reload()
      .then((next) => {
        setAmount(String(next.stats.availablePayoutCents || ''));
        const pending = (next.payouts ?? []).find((p) => p.status === 'AWAITING_EMAIL');
        if (pending) setDraftId(pending.id);
      })
      .catch((err) => {
        setError(parseApiError(err));
        if (String(err).toLowerCase().includes('unauthorized') || String(err).includes('401')) {
          clearPartnerToken();
          router.replace('/partners/login');
        }
      });
  }, [router]);

  async function copy(text: string, key: string) {
    await navigator.clipboard.writeText(text);
    setCopied(key);
    window.setTimeout(() => setCopied(null), 1600);
  }

  async function onPassword(form: HTMLFormElement) {
    const fd = new FormData(form);
    await changePartnerPassword(String(fd.get('currentPassword') ?? ''), String(fd.get('newPassword') ?? ''));
    form.reset();
  }

  if (!data) {
    return <p className="p-8 text-muted-foreground">{error ?? t('common.loading')}</p>;
  }

  const { partner, stats } = data;

  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center justify-between border-b bg-card px-4 py-3">
        <ChatLooraBrand href="/partners/dashboard" size="sm" showTagline tagline={t('partners.dashboardTitle')} />
        <div className="flex items-center gap-2">
          <LanguageToggle />
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              clearPartnerToken();
              router.replace('/partners/login');
            }}
          >
            <LogOut className="me-2 h-4 w-4" />
            {t('common.signOut')}
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 p-4 lg:p-6">
        <PageHeader title={`${t('partners.dashboardTitle')} — ${partner.name}`} description={partner.email} />

        <Card className="border-0 shadow-card">
          <CardContent className="space-y-3 pt-6">
            <div>
              <p className="text-xs text-muted-foreground">{t('partners.referralCode')}</p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <code className="rounded-md bg-muted px-3 py-2 text-lg font-semibold">{partner.referralCode}</code>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void copy(partner.referralCode ?? '', 'code')}
                >
                  <Copy className="me-2 h-4 w-4" />
                  {copied === 'code' ? t('partners.copied') : t('partners.copyCode')}
                </Button>
              </div>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t('partners.referralLink')}</p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <Input readOnly value={partner.referralLink ?? ''} className="font-mono text-sm" />
                <Button size="sm" onClick={() => void copy(partner.referralLink ?? '', 'link')}>
                  <Copy className="me-2 h-4 w-4" />
                  {copied === 'link' ? t('partners.copied') : t('partners.copyLink')}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Stat label={t('partners.customers')} value={stats.customers} />
          <Stat label={t('partners.activeSubs')} value={stats.activeSubscriptions} />
          <Stat label={t('partners.expiredSubs')} value={stats.expiredSubscriptions} />
          <Stat label={t('partners.sales')} value={formatIqd(stats.salesCents)} />
          <Stat label={t('partners.pending')} value={formatIqd(stats.pendingCents)} />
          <Stat label={t('partners.ready')} value={formatIqd(stats.readyCents)} />
          <Stat label={t('partners.availableWithdraw')} value={formatIqd(stats.availablePayoutCents)} />
          <Stat label={t('partners.paid')} value={formatIqd(stats.paidCents)} />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card className="border-0 shadow-card">
            <CardContent className="pt-6">
              <p className="font-medium">{t('partners.daily')}</p>
              <p className="mt-2 text-sm text-muted-foreground">
                {t('partners.customers')}: {stats.daily.customers} · {formatIqd(stats.daily.salesCents)} · {formatIqd(stats.daily.commissionsCents)}
              </p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-card">
            <CardContent className="pt-6">
              <p className="font-medium">{t('partners.monthly')}</p>
              <p className="mt-2 text-sm text-muted-foreground">
                {t('partners.customers')}: {stats.monthly.customers} · {formatIqd(stats.monthly.salesCents)} · {formatIqd(stats.monthly.commissionsCents)}
              </p>
            </CardContent>
          </Card>
        </div>

        <Card className="border-0 shadow-card">
          <CardContent className="space-y-3 pt-6">
            <p className="font-medium">{t('partners.withdrawTitle')}</p>
            <p className="text-sm text-muted-foreground">
              {t('partners.availableWithdraw')}: {formatIqd(stats.availablePayoutCents)}
            </p>
            {stats.availablePayoutCents <= 0 && (
              <AlertBanner variant="warning" message={t('partners.withdrawNeedBalance')} />
            )}
            {error && <AlertBanner message={error} onDismiss={() => setError(null)} />}
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={withdrawAll}
                onChange={(e) => {
                  setWithdrawAll(e.target.checked);
                  if (e.target.checked) setAmount(String(stats.availablePayoutCents));
                }}
              />
              {t('partners.withdrawAll')}
            </label>
            <Input
              type="number"
              min={1}
              disabled={withdrawAll}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={t('partners.withdrawAmount')}
            />
            <Input
              value={account}
              onChange={(e) => setAccount(e.target.value)}
              placeholder={t('partners.superQi')}
            />
            <div>
              <p className="mb-1 text-xs text-muted-foreground">{t('partners.cardImage')}</p>
              <Input type="file" accept="image/*" onChange={(e) => setCardFile(e.target.files?.[0])} />
            </div>
            {!draftId ? (
              <Button
                disabled={busy || stats.availablePayoutCents <= 0}
                onClick={() => {
                  if (stats.availablePayoutCents <= 0) {
                    setError(t('partners.withdrawNeedBalance'));
                    return;
                  }
                  if (!account.trim() || account.trim().length < 6) {
                    setError(t('partners.superQiRequired'));
                    return;
                  }
                  if (!cardFile) {
                    setError(t('partners.attachCardRequired'));
                    return;
                  }
                  setBusy(true);
                  setError(null);
                  void createPartnerPayout({
                    amountCents: Number(amount || 0),
                    accountNumber: account,
                    withdrawAll,
                    file: cardFile,
                  })
                    .then((r) => {
                      setDraftId(r.id);
                      setNotice(`${t('partners.payoutSent')} — ${t('partners.checkSpam')}`);
                    })
                    .catch((err) => setError(parseApiError(err)))
                    .finally(() => setBusy(false));
                }}
              >
                {t('partners.sendCode')}
              </Button>
            ) : (
              <div className="flex flex-wrap gap-2">
                <Input
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder={t('partners.confirmCode')}
                  className="max-w-xs"
                />
                <Button
                  disabled={busy}
                  onClick={() => {
                    setBusy(true);
                    void confirmPartnerPayout(draftId, code)
                      .then(() => {
                        setNotice(t('partners.payoutSubmitted'));
                        setDraftId(null);
                        setCode('');
                        setAccount('');
                        setCardFile(undefined);
                        return reload();
                      })
                      .catch((err) => setError(parseApiError(err)))
                      .finally(() => setBusy(false));
                  }}
                >
                  {t('partners.submitPayout')}
                </Button>
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() => {
                    setBusy(true);
                    void resendPartnerPayoutCode(draftId)
                      .then(() => setNotice(t('partners.payoutSent')))
                      .catch((err) => setError(parseApiError(err)))
                      .finally(() => setBusy(false));
                  }}
                >
                  {t('partners.resendCode')}
                </Button>
              </div>
            )}
            {notice && <AlertBanner variant="info" message={notice} onDismiss={() => setNotice(null)} />}
          </CardContent>
        </Card>

        <div className="rounded-lg border bg-card">
          <div className="border-b px-4 py-3 font-medium">{t('partners.tabPayouts')}</div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('partners.withdrawAmount')}</TableHead>
                <TableHead>{t('partners.superQi')}</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>{t('partners.receiptImage')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data.payouts ?? []).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                    {t('partners.emptyPayouts')}
                  </TableCell>
                </TableRow>
              ) : (
                data.payouts.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>{formatIqd(row.amountCents)}</TableCell>
                    <TableCell className="font-mono text-sm">{row.accountNumber}</TableCell>
                    <TableCell>
                      <Badge variant={row.status === 'PAID' ? 'success' : row.status === 'SUBMITTED' ? 'warning' : 'secondary'}>
                        {row.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {row.hasReceiptImage ? <PartnerReceipt id={row.id} /> : '—'}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <div className="rounded-lg border bg-card">
          <div className="border-b px-4 py-3 font-medium">{t('partners.commissions')}</div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('partners.commissions')}</TableHead>
                <TableHead>{t('partners.sales')}</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.commissions.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>
                    {formatIqd(row.amountCents)}{' '}
                    <span className="text-xs text-muted-foreground">
                      ({row.kind === 'RENEWAL' ? t('partners.renewal') : t('partners.first')})
                    </span>
                  </TableCell>
                  <TableCell>{formatIqd(row.saleCents)}</TableCell>
                  <TableCell>
                    <Badge variant={row.status === 'PAID' ? 'success' : row.status === 'APPROVED' ? 'default' : 'secondary'}>
                      {row.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{new Date(row.createdAt).toLocaleString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="rounded-lg border bg-card">
          <div className="border-b px-4 py-3 font-medium">{t('partners.referrals')}</div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('common.workspace')}</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.referrals.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>{row.teamName}</TableCell>
                  <TableCell>{row.source}</TableCell>
                  <TableCell>{row.subscriptionStatus ?? '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <Card className="border-0 shadow-card">
          <CardContent className="pt-6">
            <p className="mb-3 font-medium">{t('partners.changePassword')}</p>
            <form
              className="flex flex-wrap gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                void onPassword(e.currentTarget).catch((err) => setError(parseApiError(err)));
              }}
            >
              <Input name="currentPassword" type="password" placeholder={t('auth.password')} required />
              <Input name="newPassword" type="password" minLength={8} placeholder={t('auth.passwordHint')} required />
              <Button type="submit">{t('common.save')}</Button>
            </form>
            {error && <div className="mt-3"><AlertBanner message={error} onDismiss={() => setError(null)} /></div>}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
