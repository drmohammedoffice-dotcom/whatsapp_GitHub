'use client';

import { useCallback, useEffect, useState } from 'react';
import { ExternalLink, Loader2, Pencil, Plus } from 'lucide-react';
import Link from 'next/link';
import { PlanManageDialog, formatPlanPrice, planYearlyCents } from '@/components/admin/plan-manage-dialog';
import { PageHeader } from '@/components/shared/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useTranslation } from '@/components/providers/locale-provider';
import { fetchAdminPlans, type AdminPlanRow } from '@/lib/admin-api';

export default function AdminOffersPage() {
  const { t } = useTranslation();
  const [plans, setPlans] = useState<AdminPlanRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<AdminPlanRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setPlans(await fetchAdminPlans());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load plans');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <>
      <PageHeader
        title={t('admin.offers.pageTitle')}
        description={t('admin.offers.pageDesc')}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link href="/" target="_blank" rel="noreferrer">
                <ExternalLink className="me-2 h-4 w-4" />
                {t('admin.offers.previewLanding')}
              </Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href="/pricing" target="_blank" rel="noreferrer">
                <ExternalLink className="me-2 h-4 w-4" />
                {t('admin.offers.previewPricing')}
              </Link>
            </Button>
            <Button
              onClick={() => {
                setEditing(null);
                setDialogOpen(true);
              }}
            >
              <Plus className="me-2 h-4 w-4" />
              {t('admin.offers.add')}
            </Button>
          </div>
        }
      />

      {error && <p className="mt-4 text-sm text-destructive">{error}</p>}

      {loading ? (
        <div className="mt-8 flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t('common.loading')}
        </div>
      ) : (
        <div className="mt-6 rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('admin.plans.name')}</TableHead>
                <TableHead>{t('admin.plans.slug')}</TableHead>
                <TableHead>{t('admin.plans.monthlyPrice')}</TableHead>
                <TableHead>{t('admin.plans.yearlyPrice')}</TableHead>
                <TableHead>{t('admin.plans.trialDays')}</TableHead>
                <TableHead>{t('admin.plans.sortOrder')}</TableHead>
                <TableHead>{t('admin.offers.status')}</TableHead>
                <TableHead className="text-end">{t('admin.offers.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {plans.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-10 text-center text-muted-foreground">
                    {t('admin.offers.empty')}
                  </TableCell>
                </TableRow>
              ) : (
                plans.map((plan) => (
                  <TableRow key={plan.id}>
                    <TableCell>
                      <div className="font-medium">{plan.name}</div>
                      {plan.description ? (
                        <div className="max-w-xs truncate text-xs text-muted-foreground">{plan.description}</div>
                      ) : null}
                    </TableCell>
                    <TableCell className="font-mono text-sm">{plan.slug}</TableCell>
                    <TableCell>{formatPlanPrice(plan.priceCents, plan.currency)}</TableCell>
                    <TableCell>{formatPlanPrice(planYearlyCents(plan), plan.currency)}</TableCell>
                    <TableCell>
                      {plan.trialDays ?? 14} {t('admin.plans.days')}
                    </TableCell>
                    <TableCell>{plan.sortOrder ?? 0}</TableCell>
                    <TableCell>
                      <Badge variant={plan.isActive ? 'success' : 'secondary'}>
                        {plan.isActive ? t('admin.offers.active') : t('admin.offers.inactive')}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-end">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setEditing(plan);
                          setDialogOpen(true);
                        }}
                      >
                        <Pencil className="me-2 h-4 w-4" />
                        {t('admin.offers.editBtn')}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      <PlanManageDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        plan={editing}
        onSaved={() => void load()}
      />
    </>
  );
}
