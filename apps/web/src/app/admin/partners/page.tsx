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
import { Plus } from 'lucide-react';
import {
  approveAdminPartner,
  createAdminPartnerFromStaff,
  createAdminPartnerManual,
  fetchAdminPartnerCommissions,
  fetchAdminPartnerDirectory,
  fetchAdminPartnerRules,
  fetchAdminPartnerWallet,
  fetchAdminPayouts,
  fetchAdminSalesPartners,
  fetchEligibleStaffForPartner,
  deleteAdminPartner,
  rejectAdminPartner,
  saveAdminPartnerRule,
  resetAdminPartnerPassword,
  setAdminPartnerPassword,
  updateAdminPartnerEmail,
  setAdminCommissionStatus,
  STAFF_ROLE_LABELS,
  type AdminCommissionRow,
  type AdminCommissionRule,
  type AdminPayoutRow,
  type AdminSalesPartnerRow,
  type AdminWallet,
  type EligibleStaffForPartner,
  type StaffRole,
} from '@/lib/admin-api';
import { formatIqd } from '@/lib/partner-api';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { PayoutReview } from './payout-review';

function statusBadge(status: string) {
  if (status === 'APPROVED' || status === 'PAID') return 'success' as const;
  if (status === 'PENDING') return 'warning' as const;
  if (status === 'REJECTED' || status === 'SUSPENDED') return 'destructive' as const;
  return 'secondary' as const;
}

function generatePartnerPassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  return Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
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
  const [addOpen, setAddOpen] = useState(false);
  const [addMode, setAddMode] = useState<'staff' | 'manual'>('staff');
  const [eligibleStaff, setEligibleStaff] = useState<EligibleStaffForPartner[]>([]);
  const [selectedStaffId, setSelectedStaffId] = useState('');
  const [addBusy, setAddBusy] = useState(false);
  const [eligibleLoading, setEligibleLoading] = useState(false);
  const [manualForm, setManualForm] = useState({
    name: '',
    email: '',
    phone: '',
    country: 'Iraq',
    password: '',
  });
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
  const openPayouts = payouts.filter((row) => row.status === 'SUBMITTED' || row.status === 'APPROVED');
  const historyPayouts = payouts.filter((row) => row.status === 'PAID' || row.status === 'REJECTED' || row.status === 'CANCELLED');

  function formatPayoutWhen(row: AdminPayoutRow) {
    const raw = row.paidAt || row.createdAt;
    try {
      return new Date(raw).toLocaleString('en-GB', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });
    } catch {
      return raw;
    }
  }

  async function onApprove(id: string) {
    const result = await approveAdminPartner(id);
    const bits = [result.referralLink];
    if (result.temporaryPassword) bits.unshift(`${t('partners.tempPassword')}: ${result.temporaryPassword}`);
    setNotice(bits.join(' — '));
    await load();
  }

  async function openAddPartner(mode: 'staff' | 'manual' = 'staff') {
    setAddMode(mode);
    setAddOpen(true);
    setSelectedStaffId('');
    setManualForm({ name: '', email: '', phone: '', country: 'Iraq', password: generatePartnerPassword() });
    setError(null);
    if (mode !== 'staff') return;
    setEligibleLoading(true);
    try {
      const rows = await fetchEligibleStaffForPartner();
      setEligibleStaff(rows);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load staff';
      setError(msg);
      setEligibleStaff([]);
      setNotice(`تعذر تحميل الموظفين للإضافة كشركاء: ${msg}`);
    } finally {
      setEligibleLoading(false);
    }
  }

  async function onAddFromStaff() {
    if (!selectedStaffId) return;
    setAddBusy(true);
    setError(null);
    try {
      const result = await createAdminPartnerFromStaff(selectedStaffId);
      const bits = [
        result.alreadyPartner ? t('partners.alreadyPartnerNotice') : t('partners.partnerAddedFromStaff'),
        result.referralLink,
      ];
      if (result.temporaryPassword) bits.push(`${t('partners.tempPassword')}: ${result.temporaryPassword}`);
      setNotice(bits.join(' — '));
      setAddOpen(false);
      setTab('partners');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add partner');
    } finally {
      setAddBusy(false);
    }
  }

  async function onAddManual() {
    if (!manualForm.name.trim() || !manualForm.email.trim()) {
      setError('أدخل الاسم والبريد');
      return;
    }
    setAddBusy(true);
    setError(null);
    try {
      const result = await createAdminPartnerManual({
        name: manualForm.name.trim(),
        email: manualForm.email.trim(),
        phone: manualForm.phone.trim() || undefined,
        country: manualForm.country.trim() || undefined,
        password: manualForm.password.trim() || undefined,
      });
      setNotice(
        [
          t('partners.partnerCreatedManual'),
          `${t('partners.tempPassword')}: ${result.temporaryPassword}`,
          result.referralLink,
        ].join(' — '),
      );
      setAddOpen(false);
      setTab('partners');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create partner');
    } finally {
      setAddBusy(false);
    }
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
      <PageHeader
        title={t('partners.adminTitle')}
        description={t('partners.adminDesc')}
        actions={
          <Button type="button" onClick={() => void openAddPartner('staff')}>
            <Plus className="me-1 h-4 w-4" />
            {t('partners.addNewPartners')}
          </Button>
        }
      />
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
          <TabsTrigger value="payout-history">{t('partners.tabPayoutHistory')}</TabsTrigger>
          <TabsTrigger value="wallet">{t('partners.tabWallet')}</TabsTrigger>
          <TabsTrigger value="rules">{t('partners.tabRules')}</TabsTrigger>
        </TabsList>

        <TabsContent value="requests" className="mt-4 space-y-3">
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => void openAddPartner('manual')}>
              {t('partners.createPartnerManual')}
            </Button>
            <Button type="button" onClick={() => void openAddPartner('staff')}>
              <Plus className="me-1 h-4 w-4" />
              {t('partners.addNewPartners')}
            </Button>
          </div>
          <div className="rounded-lg border bg-card">
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
          </div>
        </TabsContent>

        <TabsContent value="partners" className="mt-4 space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('partners.searchPartner')}
              className="flex-1"
            />
            <Button type="button" variant="outline" onClick={() => void openAddPartner('manual')}>
              {t('partners.createPartnerManual')}
            </Button>
            <Button type="button" onClick={() => void openAddPartner('staff')}>
              <Plus className="me-1 h-4 w-4" />
              {t('partners.addNewPartners')}
            </Button>
          </div>
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
                          رمز الدخول
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
                <div className="space-y-2">
                  <p className="text-sm">رمز الدخول (لوحة أرباح الشريك)</p>
                  <Input
                    dir="ltr"
                    className="font-mono"
                    value={managePassword}
                    onChange={(event) => setManagePassword(event.target.value)}
                    placeholder="8 أحرف على الأقل"
                    minLength={8}
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      disabled={manageBusy}
                      onClick={() => setManagePassword(generatePartnerPassword())}
                    >
                      توليد رمز
                    </Button>
                    <Button
                      type="button"
                      disabled={manageBusy || managePassword.trim().length < 8}
                      onClick={() => {
                        setManageBusy(true);
                        setError(null);
                        void setAdminPartnerPassword(manage.id, managePassword.trim())
                          .then(() => {
                            setNotice(`تم تغيير رمز الدخول: ${managePassword.trim()}`);
                          })
                          .catch((err) => setError(err instanceof Error ? err.message : 'تعذر تغيير رمز الدخول'))
                          .finally(() => setManageBusy(false));
                      }}
                    >
                      حفظ الرمز
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={manageBusy}
                      onClick={() => {
                        setManageBusy(true);
                        setError(null);
                        void resetAdminPartnerPassword(manage.id)
                          .then((r) => {
                            setManagePassword(r.temporaryPassword);
                            setNotice(`${t('partners.tempPassword')}: ${r.temporaryPassword}`);
                          })
                          .catch((err) => setError(err instanceof Error ? err.message : 'تعذر إعادة التعيين'))
                          .finally(() => setManageBusy(false));
                      }}
                    >
                      إعادة تعيين تلقائية
                    </Button>
                  </div>
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
              {openPayouts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                    {t('partners.emptyPayouts')}
                  </TableCell>
                </TableRow>
              ) : (
                openPayouts.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      <Link className="font-medium text-primary hover:underline" href={`/admin/partners/${row.partner?.id}`}>
                        {row.partner?.name}
                      </Link>
                      <div className="text-xs text-muted-foreground">{row.partner?.email}</div>
                    </TableCell>
                    <TableCell dir="ltr">{formatIqd(row.amountCents)}</TableCell>
                    <TableCell className="font-mono text-sm" dir="ltr">{row.accountNumber}</TableCell>
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

        <TabsContent value="payout-history" className="mt-4 rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('partners.name')}</TableHead>
                <TableHead>{t('partners.withdrawAmount')}</TableHead>
                <TableHead>{t('partners.superQi')}</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>{t('partners.payoutDate')}</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {historyPayouts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                    {t('partners.payoutHistoryEmpty')}
                  </TableCell>
                </TableRow>
              ) : (
                historyPayouts.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      <Link className="font-medium text-primary hover:underline" href={`/admin/partners/${row.partner?.id}`}>
                        {row.partner?.name}
                      </Link>
                      <div className="text-xs text-muted-foreground">{row.partner?.email}</div>
                    </TableCell>
                    <TableCell dir="ltr">{formatIqd(row.amountCents)}</TableCell>
                    <TableCell className="font-mono text-sm" dir="ltr">{row.accountNumber}</TableCell>
                    <TableCell>
                      <Badge variant={statusBadge(row.status)}>
                        {row.status === 'PAID' ? t('partners.payoutPaid') : row.status === 'REJECTED' ? t('partners.payoutRejected') : row.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-sm" dir="ltr">
                      {formatPayoutWhen(row)}
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

      <Dialog
        open={addOpen}
        onOpenChange={(open) => {
          setAddOpen(open);
          if (open) return;
          setSelectedStaffId('');
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('partners.addNewPartners')}</DialogTitle>
            <DialogDescription>{t('partners.addNewPartnersDesc')}</DialogDescription>
          </DialogHeader>

          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant={addMode === 'staff' ? 'default' : 'outline'}
              onClick={() => void openAddPartner('staff')}
            >
              {t('partners.importFromStaff')}
            </Button>
            <Button
              type="button"
              size="sm"
              variant={addMode === 'manual' ? 'default' : 'outline'}
              onClick={() => void openAddPartner('manual')}
            >
              {t('partners.createPartnerManual')}
            </Button>
          </div>

          {addMode === 'staff' ? (
            eligibleLoading ? (
              <div className="flex items-center gap-2 py-6 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                {t('common.loading')}
              </div>
            ) : eligibleStaff.length === 0 ? (
              <p className="py-4 text-sm text-muted-foreground">{t('partners.noEligibleStaff')}</p>
            ) : (
              <label className="block space-y-2 text-sm">
                <span className="font-medium">{t('partners.selectStaff')}</span>
                <select
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  value={selectedStaffId}
                  onChange={(e) => setSelectedStaffId(e.target.value)}
                >
                  <option value="">—</option>
                  {eligibleStaff.map((row) => {
                    const roleLabel = (row.roles ?? [row.role])
                      .map((r) => STAFF_ROLE_LABELS[r as StaffRole] ?? r)
                      .join(' · ');
                    return (
                      <option key={row.id} value={row.id}>
                        {row.name} — {row.email}
                        {roleLabel ? ` (${roleLabel})` : ''}
                      </option>
                    );
                  })}
                </select>
              </label>
            )
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="partner-name">{t('partners.name')}</Label>
                <Input
                  id="partner-name"
                  value={manualForm.name}
                  onChange={(e) => setManualForm((f) => ({ ...f, name: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="partner-email">{t('partners.email')}</Label>
                <Input
                  id="partner-email"
                  type="email"
                  dir="ltr"
                  value={manualForm.email}
                  onChange={(e) => setManualForm((f) => ({ ...f, email: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="partner-phone">{t('partners.phone')}</Label>
                <Input
                  id="partner-phone"
                  dir="ltr"
                  value={manualForm.phone}
                  onChange={(e) => setManualForm((f) => ({ ...f, phone: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="partner-country">{t('partners.country')}</Label>
                <Input
                  id="partner-country"
                  value={manualForm.country}
                  onChange={(e) => setManualForm((f) => ({ ...f, country: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="partner-password">{t('partners.accessCode')}</Label>
                <div className="flex gap-2">
                  <Input
                    id="partner-password"
                    dir="ltr"
                    className="font-mono"
                    value={manualForm.password}
                    onChange={(e) => setManualForm((f) => ({ ...f, password: e.target.value }))}
                    minLength={8}
                  />
                  <Button type="button" variant="outline" onClick={() => setManualForm((f) => ({ ...f, password: generatePartnerPassword() }))}>
                    {t('partners.generatePassword')}
                  </Button>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>
              {t('common.cancel')}
            </Button>
            {addMode === 'staff' ? (
              <Button
                type="button"
                disabled={!selectedStaffId || addBusy || eligibleStaff.length === 0}
                onClick={() => void onAddFromStaff()}
              >
                {addBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {t('partners.confirmAddPartner')}
              </Button>
            ) : (
              <Button
                type="button"
                disabled={addBusy || !manualForm.name.trim() || !manualForm.email.trim()}
                onClick={() => void onAddManual()}
              >
                {addBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {t('partners.confirmCreatePartner')}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
