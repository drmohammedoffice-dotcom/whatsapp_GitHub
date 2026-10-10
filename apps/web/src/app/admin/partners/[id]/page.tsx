'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { useTranslation } from '@/components/providers/locale-provider';
import { AlertBanner } from '@/components/shared/alert-banner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  deleteAdminPartner,
  fetchAdminPartner,
  fetchAdminPayoutImageUrl,
  payAdminPayout,
  resetAdminPartnerPassword,
  setAdminPartnerPassword,
  updateAdminPartnerEmail,
  setAdminPayoutStatus,
  type AdminPartnerDetail,
} from '@/lib/admin-api';
import { formatIqd } from '@/lib/partner-api';

function statusBadge(status: string) {
  if (status === 'APPROVED' || status === 'PAID') return 'success' as const;
  if (status === 'PENDING' || status === 'SUBMITTED' || status === 'AWAITING_EMAIL') return 'warning' as const;
  if (status === 'REJECTED' || status === 'SUSPENDED') return 'destructive' as const;
  return 'secondary' as const;
}

function generatePassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  return Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

function AuthImage({
  payoutId,
  kind,
  label,
}: {
  payoutId: string;
  kind: 'account' | 'receipt';
  label: string;
}) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let objectUrl: string | null = null;
    fetchAdminPayoutImageUrl(payoutId, kind)
      .then((next) => {
        objectUrl = next;
        setUrl(next);
      })
      .catch(() => setUrl(null));
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [payoutId, kind]);
  if (!url) return <p className="text-xs text-muted-foreground">{label}</p>;
  return <img src={url} alt={label} className="mt-2 max-h-48 rounded-md border object-contain" />;
}

export default function AdminPartnerDetailPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const [data, setData] = useState<AdminPartnerDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [receiptFiles, setReceiptFiles] = useState<Record<string, File | undefined>>({});

  const load = useCallback(async () => {
    if (!params.id) return;
    setLoading(true);
    setError(null);
    try {
      const next = await fetchAdminPartner(params.id);
      setData(next);
      setPassword(next.partner.currentPassword ?? '');
      setEmail(next.partner.email);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        {t('common.loading')}
      </div>
    );
  }

  if (!data) {
    return <p className="text-sm text-destructive">{error ?? t('partners.emptyPartners')}</p>;
  }

  const { partner, stats } = data;

  return (
    <div>
      <div className="mb-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/admin/partners">{t('partners.backToPartners')}</Link>
        </Button>
      </div>
      <PageHeader title={partner.name} description={`${partner.email} · ${partner.phone ?? ''} · ${partner.referralCode ?? ''}`} />
      {error && <p className="mt-4 text-sm text-destructive">{error}</p>}
      {notice && (
        <div className="mt-4">
          <AlertBanner variant="info" message={notice} onDismiss={() => setNotice(null)} />
        </div>
      )}

      <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="border-0 shadow-card">
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">{t('partners.customers')}</p>
            <p className="mt-1 text-2xl font-semibold">{stats.customers}</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-card">
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">{t('partners.activeSubs')}</p>
            <p className="mt-1 text-2xl font-semibold">{stats.activeSubscriptions}</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-card">
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">{t('partners.expiredSubs')}</p>
            <p className="mt-1 text-2xl font-semibold">{stats.expiredSubscriptions}</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-card">
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">{t('partners.profits')}</p>
            <p className="mt-1 text-2xl font-semibold">
              {formatIqd(stats.pendingCents + stats.readyCents + stats.paidCents)}
            </p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-card">
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">{t('partners.pending')}</p>
            <p className="mt-1 text-2xl font-semibold">{formatIqd(stats.pendingCents)}</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-card">
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">{t('partners.ready')}</p>
            <p className="mt-1 text-2xl font-semibold">{formatIqd(stats.readyCents)}</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-card">
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">{t('partners.availableWithdraw')}</p>
            <p className="mt-1 text-2xl font-semibold">{formatIqd(stats.availablePayoutCents)}</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-card">
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">{t('partners.paid')}</p>
            <p className="mt-1 text-2xl font-semibold">{formatIqd(stats.paidCents)}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4 border-0 shadow-card">
        <CardContent className="space-y-3 pt-6">
          <p className="font-medium">البريد الإلكتروني</p>
          <div className="flex flex-wrap gap-2">
            <Input dir="ltr" type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="max-w-sm" />
            <Button
              type="button"
              onClick={() =>
                void updateAdminPartnerEmail(partner.id, email)
                  .then(() => {
                    setNotice('تم تغيير البريد');
                    return load();
                  })
                  .catch((err) => setError(err instanceof Error ? err.message : 'تعذر تغيير البريد'))
              }
            >
              حفظ البريد
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                if (!window.confirm(`حذف الشريك ${partner.name}؟ لا يمكن التراجع عن الحذف.`)) return;
                void deleteAdminPartner(partner.id)
                  .then(() => router.push('/admin/partners'))
                  .catch((err) => setError(err instanceof Error ? err.message : 'تعذر حذف الشريك'));
              }}
            >
              حذف الشريك
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="mt-4 border-0 shadow-card">
        <CardContent className="space-y-3 pt-6">
          <p className="font-medium">{t('partners.currentPassword')}</p>
          <p className="text-sm text-muted-foreground">
            {partner.currentPassword ? partner.currentPassword : t('partners.passwordHidden')}
          </p>
          <div className="flex flex-wrap gap-2">
            <Input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="max-w-xs font-mono"
              minLength={8}
            />
            <Button type="button" variant="outline" onClick={() => setPassword(generatePassword())}>
              {t('partners.generatePassword')}
            </Button>
            <Button
              type="button"
              onClick={() =>
                void setAdminPartnerPassword(partner.id, password)
                  .then(() => {
                    setNotice(t('partners.setPassword'));
                    return load();
                  })
                  .catch((err) => setError(err instanceof Error ? err.message : 'Failed'))
              }
            >
              {t('partners.setPassword')}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                void resetAdminPartnerPassword(partner.id).then((r) => {
                  setNotice(`${t('partners.tempPassword')}: ${r.temporaryPassword}`);
                  setPassword(r.temporaryPassword);
                  return load();
                })
              }
            >
              {t('partners.resetPassword')}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="mt-4 rounded-lg border bg-card">
        <div className="border-b px-4 py-3 font-medium">{t('partners.tabPayouts')}</div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('partners.withdrawAmount')}</TableHead>
              <TableHead>{t('partners.superQi')}</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>{t('partners.cardImage')}</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.payouts.filter((p) => p.status !== 'AWAITING_EMAIL').length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                  {t('partners.emptyPayouts')}
                </TableCell>
              </TableRow>
            ) : (
              data.payouts
                .filter((row) => row.status !== 'AWAITING_EMAIL')
                .map((row) => (
                  <TableRow key={row.id} className="align-top">
                    <TableCell>{formatIqd(row.amountCents)}</TableCell>
                    <TableCell className="font-mono text-sm">{row.accountNumber}</TableCell>
                    <TableCell>
                      <Badge variant={statusBadge(row.status)}>{row.status}</Badge>
                    </TableCell>
                    <TableCell className="min-w-[180px]">
                      {row.hasAccountImage && <AuthImage payoutId={row.id} kind="account" label={t('partners.cardImage')} />}
                      {row.hasReceiptImage && <AuthImage payoutId={row.id} kind="receipt" label={t('partners.receiptImage')} />}
                    </TableCell>
                    <TableCell className="space-y-2">
                      {(row.status === 'SUBMITTED' || row.status === 'APPROVED') && (
                        <>
                          {row.status === 'SUBMITTED' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => void setAdminPayoutStatus(row.id, 'APPROVED').then(() => load())}
                            >
                              {t('partners.approve')}
                            </Button>
                          )}
                          <Input
                            type="file"
                            accept="image/*"
                            onChange={(e) => setReceiptFiles((prev) => ({ ...prev, [row.id]: e.target.files?.[0] }))}
                          />
                          <Button
                            size="sm"
                            onClick={() =>
                              void payAdminPayout(row.id, receiptFiles[row.id])
                                .then(() => {
                                  setNotice(t('partners.payWithReceipt'));
                                  return load();
                                })
                                .catch((err) => setError(err instanceof Error ? err.message : 'Failed'))
                            }
                          >
                            {t('partners.payWithReceipt')}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => void setAdminPayoutStatus(row.id, 'REJECTED').then(() => load())}
                          >
                            {t('partners.reject')}
                          </Button>
                        </>
                      )}
                    </TableCell>
                  </TableRow>
                ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="mt-4 rounded-lg border bg-card">
        <div className="border-b px-4 py-3 font-medium">{t('partners.referrals')}</div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('common.workspace')}</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.referrals.map((row) => (
              <TableRow key={row.id}>
                <TableCell>{row.teamName}</TableCell>
                <TableCell>{row.subscriptionStatus ?? '—'}</TableCell>
                <TableCell>{new Date(row.createdAt).toLocaleString()}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
