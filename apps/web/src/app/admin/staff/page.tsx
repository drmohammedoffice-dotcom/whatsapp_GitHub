'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Loader2, Plus, Shield } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { useTranslation } from '@/components/providers/locale-provider';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  createAdminStaff,
  deactivateAdminStaff,
  fetchAdminMe,
  fetchAdminStaff,
  fetchAdminStaffActivity,
  updateAdminStaff,
  type AdminStaffActivityRow,
  type AdminStaffRow,
} from '@/lib/admin-api';

function formatWhen(value: string) {
  try {
    return new Intl.DateTimeFormat('ar-IQ', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(value));
  } catch {
    return value;
  }
}

export default function AdminStaffPage() {
  const { t } = useTranslation();
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [staff, setStaff] = useState<AdminStaffRow[]>([]);
  const [activity, setActivity] = useState<AdminStaffActivityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const me = await fetchAdminMe();
      if (me.role !== 'SUPER_ADMIN') {
        setAllowed(false);
        return;
      }
      setAllowed(true);
      const [rows, logs] = await Promise.all([fetchAdminStaff(), fetchAdminStaffActivity({ take: 150 })]);
      setStaff(rows);
      setActivity(logs);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load staff');
      setAllowed(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function onCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const form = new FormData(e.currentTarget);
    try {
      await createAdminStaff({
        email: String(form.get('email') ?? ''),
        name: String(form.get('name') ?? ''),
        password: String(form.get('password') ?? ''),
        residence: String(form.get('residence') ?? '') || undefined,
      });
      e.currentTarget.reset();
      setFormOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Create failed');
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(row: AdminStaffRow) {
    setError(null);
    try {
      if (row.isActive) await deactivateAdminStaff(row.id);
      else await updateAdminStaff(row.id, { isActive: true });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed');
    }
  }

  if (allowed === false) {
    return (
      <div className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">
        هذه الصفحة متاحة لمدير النظام فقط.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('admin.staff.title')}
        description={t('admin.staff.subtitle')}
        actions={
          <Button onClick={() => setFormOpen((v) => !v)}>
            <Plus className="mr-2 h-4 w-4" />
            {t('admin.staff.add')}
          </Button>
        }
      />

      <p className="text-sm text-muted-foreground">{t('admin.staff.portalHint')}</p>

      {error && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}

      {formOpen && (
        <Card className="border-0 shadow-card">
          <CardHeader>
            <CardTitle className="text-base">{t('admin.staff.add')}</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="grid gap-4 sm:grid-cols-2" onSubmit={(e) => void onCreate(e)}>
              <div className="space-y-2">
                <Label htmlFor="name">{t('admin.staff.name')}</Label>
                <Input id="name" name="name" required minLength={2} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">{t('admin.staff.email')}</Label>
                <Input id="email" name="email" type="email" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">{t('admin.staff.password')}</Label>
                <Input id="password" name="password" type="text" required minLength={8} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="residence">{t('admin.staff.residence')}</Label>
                <Input id="residence" name="residence" />
              </div>
              <div className="sm:col-span-2">
                <Button type="submit" disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : t('admin.staff.save')}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card className="border-0 shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Shield className="h-4 w-4" />
            {t('admin.nav.staff')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading...
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('admin.staff.name')}</TableHead>
                  <TableHead>{t('admin.staff.email')}</TableHead>
                  <TableHead>{t('admin.staff.residence')}</TableHead>
                  <TableHead>{t('admin.staff.created')}</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {staff.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">{row.user.name}</TableCell>
                    <TableCell>{row.user.email}</TableCell>
                    <TableCell>{row.residence || '—'}</TableCell>
                    <TableCell>{formatWhen(row.createdAt)}</TableCell>
                    <TableCell className="space-x-2 text-end rtl:space-x-reverse">
                      <Badge variant={row.isActive ? 'default' : 'secondary'}>
                        {row.isActive ? t('admin.staff.active') : t('admin.staff.inactive')}
                      </Badge>
                      <Button size="sm" variant="outline" onClick={() => void toggleActive(row)}>
                        {row.isActive ? t('admin.staff.deactivate') : t('admin.staff.activate')}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {!staff.length && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      —
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card className="border-0 shadow-card">
        <CardHeader>
          <CardTitle className="text-base">{t('admin.staff.activity')}</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('admin.staff.when')}</TableHead>
                <TableHead>{t('admin.staff.employee')}</TableHead>
                <TableHead>{t('admin.staff.action')}</TableHead>
                <TableHead>Resource</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {activity.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="whitespace-nowrap">{formatWhen(row.createdAt)}</TableCell>
                  <TableCell>
                    <div className="font-medium">{row.adminUser?.user?.name ?? '—'}</div>
                    <div className="text-xs text-muted-foreground">{row.adminUser?.user?.email ?? ''}</div>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{row.action}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {row.resource}
                    {row.resourceId ? ` · ${row.resourceId}` : ''}
                  </TableCell>
                </TableRow>
              ))}
              {!activity.length && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    {t('admin.staff.activityEmpty')}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
