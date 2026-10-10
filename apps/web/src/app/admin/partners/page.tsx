'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { useTranslation } from '@/components/providers/locale-provider';
import { AlertBanner } from '@/components/shared/alert-banner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  approveAdminPartner,
  fetchAdminPartnerCommissions,
  fetchAdminPartnerDirectory,
  fetchAdminPartnerRules,
  fetchAdminPartnerWallet,
  fetchAdminPayouts,
  fetchAdminSalesPartners,
  deleteAdminPartner,
  rejectAdminPartner,
  saveAdminPartnerRule,
  setAdminPartnerPassword,
  updateAdminPartnerEmail,
  setAdminCommissionStatus,
  type AdminCommissionRow,
  type AdminCommissionRule,
  type AdminPayoutRow,
  type AdminSalesPartnerRow,
  type AdminWallet,
} from '@/lib/admin-api';
import { formatIqd } from '@/lib/partner-api';
import { PayoutReview } from './payout-review';

function statusBadge(status: string) {
  if (status === 'APPROVED' || status === 'PAID') return 'success' as const;
  if (status === 'PENDING') return 'warning' as const;
  if (status === 'REJECTED' || status === 'SUSPENDED') return 'destructive' as const;
  return 'secondary' as const;
}

export default function AdminPartnersPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const [tab, setTab] = useState('requests');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [partners, setPartners] = useState<AdminSalesPartnerRow[]>([]);
  const [directory, setDirectory] = useState<AdminSalesPartnerRow[]>([]);
  const [search, setSearch] = useState('');
  const [rules, setRules] = useState<AdminCommissionRule[]>([]);
  const [wallet, setWallet] = useState<AdminWallet | null>(null);
  const [commissions, setCommissions] = useState<AdminCommissionRow[]>([]);
  const [payouts, setPayouts] = useState<AdminPayoutRow[]>([]);
  const [openPayoutId, setOpenPayoutId] = useState('');
  const [manage, setManage] = useState<AdminSalesPartnerRow | null>(null);
  const [manageEmail, setManageEmail] = useState('');
  const [managePassword, setManagePassword] = useState('');
  const [manageBusy, setManageBusy] = useState(false);
  const searchRef = useRef(search);
  searchRef.current = search;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [all, dir, nextRules, nextWallet, nextCommissions, nextPayouts] = await Promise.all([
        fetchAdminSalesPartners(),
        fetchAdminPartnerDirectory(searchRef.current),
        fetchAdminPartnerRules(),
        fetchAdminPartnerWallet(),
        fetchAdminPartnerCommissions(),
        fetchAdminPayouts(),
      ]);
      setPartners(all);
      setDirectory(dir);
      setRules(nextRules);
      setWallet(nextWallet);
      setCommissions(nextCommissions);
      setPayouts(nextPayouts);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      fetchAdminPartnerDirectory(search)
        .then(setDirectory)
        .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'));
    }, 280);
    return () => window.clearTimeout(timer);
  }, [search]);

  const requests = partners.filter((p) => p.status === 'PENDING');

  async function onApprove(id: string) {
    const result = await approveAdminPartner(id);
    const bits = [result.referralLink];
    if (result.temporaryPassword) bits.unshift(`${t('partners.tempPassword')}: ${result.temporaryPassword}`);
    setNotice(bits.join(' — '));
    await load();
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        {t('common.loading')}
      </div>
    );
  }

  return (
    <div>
      <PageHeader title={t('partners.adminTitle')} description={t('partners.adminDesc')} />
      {error && <p className="mt-4 text-sm text-destructive">{error}</p>}
      {notice && (
        <div className="mt-4">
          <AlertBanner variant="info" message={notice} onDismiss={() => setNotice(null)} />
        </div>
      )}

      <Tabs value={tab} onValueChange={setTab} className="mt-6">
        <TabsList>
          <TabsTrigger value="requests">{t('partners.tabRequests')}</TabsTrigger>
          <TabsTrigger value="partners">{t('partners.tabPartners')}</TabsTrigger>
          <TabsTrigger value="payouts">{t('partners.tabPayouts')}</TabsTrigger>
          <TabsTrigger value="wallet">{t('partners.tabWallet')}</TabsTrigger>
          <TabsTrigger value="rules">{t('partners.tabRules')}</TabsTrigger>
        </TabsList>

        <TabsContent value="requests" className="mt-4 rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('partners.name')}</TableHead>
                <TableHead>{t('partners.email')}</TableHead>
                <TableHead>{t('partners.phone')}</TableHead>
                <TableHead>{t('partners.country')}</TableHead>
                <TableHead>{t('partners.reason')}</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                    {t('partners.emptyRequests')}
                  </TableCell>
                </TableRow>
              ) : (
                requests.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">{row.name}</TableCell>
                    <TableCell>{row.email}</TableCell>
                    <TableCell>{row.phone}</TableCell>
                    <TableCell>{row.country}</TableCell>
                    <TableCell className="max-w-xs truncate text-sm text-muted-foreground">{row.reason}</TableCell>
                    <TableCell className="space-x-2 text-end">
                      <Button size="sm" onClick={() => void onApprove(row.id)}>
                        {t('partners.approve')}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => void rejectAdminPartner(row.id).then(() => load())}>
                        {t('partners.reject')}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TabsContent>

        <TabsContent value="partners" className="mt-4 space-y-3">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('partners.searchPartner')}
          />
          <div className="rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('partners.colIndex')}</TableHead>
                  <TableHead>{t('partners.name')}</TableHead>
                  <TableHead>{t('partners.referralCode')}</TableHead>
                  <TableHead>{t('partners.customers')}</TableHead>
                  <TableHead>{t('partners.activeSubs')}</TableHead>
                  <TableHead>{t('partners.expiredSubs')}</TableHead>
                  <TableHead>{t('partners.profits')}</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {directory.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="py-10 text-center text-muted-foreground">
                      {t('partners.emptyPartners')}
                    </TableCell>
                  </TableRow>
                ) : (
                  directory.map((row) => (
                    <TableRow
                      key={row.id}
                      className="cursor-pointer"
                      onClick={() => router.push(`/admin/partners/${row.id}`)}
                    >
                      <TableCell>{row.index}</TableCell>
                      <TableCell>
                        <div className="font-medium">{row.name}</div>
                        <div className="text-xs text-muted-foreground">{row.email}</div>
                      </TableCell>
                      <TableCell className="font-mono">{row.referralCode ?? '—'}</TableCell>
                      <TableCell>{row.customers ?? 0}</TableCell>
                      <TableCell>{row.activeSubscriptions ?? 0}</TableCell>
                      <TableCell>{row.expiredSubscriptions ?? 0}</TableCell>
                      <TableCell>{formatIqd(row.profitCents ?? 0)}</TableCell>
                      <TableCell>
                        <Badge variant={statusBadge(row.status)}>{row.status}</Badge>
                      </TableCell>
                      <TableCell className="text-end">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(event) => {
                            event.stopPropagation();
                            setManage(row);
                            setManageEmail(row.email);
                            setManagePassword('');
                          }}
                        >
                          إدارة
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          {manage && (
            <Card>
              <CardContent className="space-y-4 p-5">
                <div>
                  <p className="font-medium">{manage.name}</p>
                  <p className="text-sm text-muted-foreground">تغيير البريد أو رمز الدخول أو حذف الشريك</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
                  <div className="space-y-2">
                    <p className="text-sm">البريد الإلكتروني</p>
                    <Input dir="ltr" type="email" value={manageEmail} onChange={(event) => setManageEmail(event.target.value)} />
                  </div>
                  <Button
                    type="button"
                    disabled={manageBusy}
                    onClick={() => {
                      setManageBusy(true);
                      setError(null);
                      void updateAdminPartnerEmail(manage.id, manageEmail)
                        .then(() => {
                          setNotice('تم تغيير البريد');
                          return load();
                        })
                        .catch((err) => setError(err instanceof Error ? err.message : 'تعذر تغيير البريد'))
                        .finally(() => setManageBusy(false));
                    }}
                  >
                    حفظ البريد
                  </Button>
                </div>
                <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
                  <div className="space-y-2">
                    <p className="text-sm">رمز الدخول</p>
                    <Input dir="ltr" value={managePassword} onChange={(event) => setManagePassword(event.target.value)} />
                  </div>
                  <Button
                    type="button"
                    disabled={manageBusy}
                    onClick={() => {
                      setManageBusy(true);
                      setError(null);
                      void setAdminPartnerPassword(manage.id, managePassword)
                        .then(() => {
                          setNotice('تم تغيير رمز الدخول');
                          setManagePassword('');
                        })
                        .catch((err) => setError(err instanceof Error ? err.message : 'تعذر تغيير رمز الدخول'))
                        .finally(() => setManageBusy(false));
                    }}
                  >
                    حفظ الرمز
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="destructive"
                    disabled={manageBusy}
                    onClick={() => {
                      if (!window.confirm(`حذف الشريك ${manage.name}؟ لا يمكن التراجع عن الحذف.`)) return;
                      setManageBusy(true);
                      setError(null);
                      void deleteAdminPartner(manage.id)
                        .then(() => {
                          setManage(null);
                          setNotice('تم حذف الشريك');
                          return load();
                        })
                        .catch((err) => setError(err instanceof Error ? err.message : 'تعذر حذف الشريك'))
                        .finally(() => setManageBusy(false));
                    }}
                  >
                    حذف الشريك
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setManage(null)}>إغلاق</Button>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="payouts" className="mt-4 rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('partners.name')}</TableHead>
                <TableHead>{t('partners.withdrawAmount')}</TableHead>
                <TableHead>{t('partners.superQi')}</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {payouts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                    {t('partners.emptyPayouts')}
                  </TableCell>
                </TableRow>
              ) : (
                payouts.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      <Link className="font-medium text-primary hover:underline" href={`/admin/partners/${row.partner?.id}`}>
                        {row.partner?.name}
                      </Link>
                      <div className="text-xs text-muted-foreground">{row.partner?.email}</div>
                    </TableCell>
                    <TableCell>{formatIqd(row.amountCents)}</TableCell>
                    <TableCell className="font-mono text-sm">{row.accountNumber}</TableCell>
                    <TableCell>
                      <Badge variant={statusBadge(row.status)}>{row.status}</Badge>
                    </TableCell>
                    <TableCell>
                      <Button size="sm" variant="outline" onClick={() => setOpenPayoutId(row.id)}>تفاصيل الطلب</Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          {openPayoutId && (
            <PayoutReview id={openPayoutId} onClose={() => setOpenPayoutId('')} onSaved={() => void load()} />
          )}
        </TabsContent>

        <TabsContent value="wallet" className="mt-4 space-y-4">
          {wallet && (
            <div className="grid gap-4 sm:grid-cols-3">
              <Card className="border-0 shadow-card">
                <CardContent className="pt-6">
                  <p className="text-xs text-muted-foreground">{t('partners.walletPending')}</p>
                  <p className="mt-1 text-2xl font-semibold">{formatIqd(wallet.pendingCents)}</p>
                  <p className="text-xs text-muted-foreground">{wallet.pendingCount}</p>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-card">
                <CardContent className="pt-6">
                  <p className="text-xs text-muted-foreground">{t('partners.walletReady')}</p>
                  <p className="mt-1 text-2xl font-semibold">{formatIqd(wallet.approvedCents)}</p>
                  <p className="text-xs text-muted-foreground">{wallet.approvedCount}</p>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-card">
                <CardContent className="pt-6">
                  <p className="text-xs text-muted-foreground">{t('partners.walletPaid')}</p>
                  <p className="mt-1 text-2xl font-semibold">{formatIqd(wallet.paidCents)}</p>
                  <p className="text-xs text-muted-foreground">{wallet.paidCount}</p>
                </CardContent>
              </Card>
            </div>
          )}
          <div className="rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('partners.name')}</TableHead>
                  <TableHead>{t('common.workspace')}</TableHead>
                  <TableHead>{t('partners.commissions')}</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {commissions.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      {row.partner.name}
                      <div className="text-xs text-muted-foreground">{row.partner.email}</div>
                    </TableCell>
                    <TableCell>{row.referral.team.name}</TableCell>
                    <TableCell>
                      {formatIqd(row.amountCents)}{' '}
                      <span className="text-xs text-muted-foreground">({row.kind})</span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusBadge(row.status)}>{row.status}</Badge>
                    </TableCell>
                    <TableCell className="space-x-2 text-end">
                      {row.status === 'PENDING' && (
                        <Button size="sm" onClick={() => void setAdminCommissionStatus(row.id, 'APPROVED').then(() => load())}>
                          {t('partners.markApproved')}
                        </Button>
                      )}
                      {row.status === 'APPROVED' && (
                        <Button size="sm" onClick={() => void setAdminCommissionStatus(row.id, 'PAID').then(() => load())}>
                          {t('partners.markPaid')}
                        </Button>
                      )}
                      {row.status !== 'PAID' && row.status !== 'REJECTED' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => void setAdminCommissionStatus(row.id, 'REJECTED').then(() => load())}
                        >
                          {t('partners.markRejected')}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="rules" className="mt-4 space-y-3">
          {rules.map((rule) => (
            <Card key={rule.id} className="border-0 shadow-card">
              <CardContent className="flex flex-wrap items-end gap-3 pt-6">
                <div className="min-w-[140px] font-medium">{rule.plan.name}</div>
                <select
                  className="h-10 rounded-md border bg-background px-3 text-sm"
                  defaultValue={rule.mode}
                  onChange={(e) => {
                    rule.mode = e.target.value as 'PERCENT' | 'FIXED';
                    setRules([...rules]);
                  }}
                >
                  <option value="PERCENT">{t('partners.percent')}</option>
                  <option value="FIXED">{t('partners.fixed')}</option>
                </select>
                {rule.mode === 'PERCENT' ? (
                  <Input
                    type="number"
                    className="w-28"
                    defaultValue={Number(rule.percent)}
                    onChange={(e) => {
                      rule.percent = Number(e.target.value);
                    }}
                  />
                ) : (
                  <Input
                    type="number"
                    className="w-36"
                    defaultValue={rule.fixedCents}
                    onChange={(e) => {
                      rule.fixedCents = Number(e.target.value);
                    }}
                  />
                )}
                <Button
                  size="sm"
                  onClick={() =>
                    void saveAdminPartnerRule({
                      planId: rule.planId,
                      mode: rule.mode,
                      percent: Number(rule.percent),
                      fixedCents: rule.fixedCents,
                    }).then(() => load())
                  }
                >
                  {t('partners.saveRule')}
                </Button>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}
