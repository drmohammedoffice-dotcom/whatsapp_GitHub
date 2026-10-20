'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { KeyRound, Loader2, Pencil, Plus, Shield } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { useTranslation } from '@/components/providers/locale-provider';
import { AlertBanner } from '@/components/shared/alert-banner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  STAFF_ROLE_LABELS,
  createAdminStaff,
  deactivateAdminStaff,
  fetchAdminMe,
  fetchAdminStaff,
  fetchAdminStaffActivity,
  updateAdminStaff,
  type AdminStaffActivityRow,
  type AdminStaffRow,
  type StaffRole,
} from '@/lib/admin-api';

function generatePassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  return Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

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

const ROLE_OPTIONS: StaffRole[] = ['ACCOUNTANT', 'MAILBOX_CREATOR', 'STAFF'];

type StaffFormState = {
  id?: string;
  name: string;
  email: string;
  password: string;
  residence: string;
  roles: StaffRole[];
  isActive: boolean;
};

const emptyForm = (): StaffFormState => ({
  name: '',
  email: '',
  password: '',
  residence: '',
  roles: ['ACCOUNTANT'],
  isActive: true,
});

function resolveRowRoles(row: AdminStaffRow): StaffRole[] {
  const fromList = (row.roles ?? []).filter((r): r is StaffRole =>
    ROLE_OPTIONS.includes(r as StaffRole),
  );
  if (fromList.length) return fromList;
  if (ROLE_OPTIONS.includes(row.role as StaffRole)) return [row.role as StaffRole];
  return ['ACCOUNTANT'];
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
  const [form, setForm] = useState<StaffFormState>(emptyForm());
  const [passwordTarget, setPasswordTarget] = useState<AdminStaffRow | null>(null);
  const [passwordValue, setPasswordValue] = useState('');
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [passwordNotice, setPasswordNotice] = useState<string | null>(null);

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

  function openCreate() {
    setForm(emptyForm());
    setFormOpen(true);
  }

  function openEdit(row: AdminStaffRow) {
    setForm({
      id: row.id,
      name: row.user.name,
      email: row.user.email,
      password: '',
      residence: row.residence || '',
      roles: resolveRowRoles(row),
      isActive: row.isActive,
    });
    setFormOpen(true);
  }

  function toggleRole(role: StaffRole) {
    setForm((f) => {
      const has = f.roles.includes(role);
      if (has) {
        const next = f.roles.filter((r) => r !== role);
        return { ...f, roles: next.length ? next : f.roles };
      }
      return { ...f, roles: [...f.roles, role] };
    });
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!form.roles.length) {
      setError('اختر وظيفة واحدةً واحدةً على الأقل');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (form.id) {
        await updateAdminStaff(form.id, {
          name: form.name,
          email: form.email,
          residence: form.residence || undefined,
          roles: form.roles,
          isActive: form.isActive,
          ...(form.password.trim() ? { password: form.password.trim() } : {}),
        });
      } else {
        await createAdminStaff({
          email: form.email,
          name: form.name,
          password: form.password,
          residence: form.residence || undefined,
          roles: form.roles,
        });
      }
      setFormOpen(false);
      setForm(emptyForm());
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
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

  function openPasswordDialog(row: AdminStaffRow) {
    setPasswordTarget(row);
    setPasswordValue(generatePassword());
    setPasswordNotice(null);
    setError(null);
  }

  async function saveStaffPassword() {
    if (!passwordTarget) return;
    const next = passwordValue.trim();
    if (next.length < 8) {
      setError('كلمة المرور يجب أن تكون 8 أحرف على الأقل');
      return;
    }
    setPasswordBusy(true);
    setError(null);
    try {
      await updateAdminStaff(passwordTarget.id, { password: next });
      setPasswordNotice(`تم تحديث كلمة مرور ${passwordTarget.user.name}: ${next}`);
      setPasswordTarget(null);
      setPasswordValue('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر تحديث كلمة المرور');
    } finally {
      setPasswordBusy(false);
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
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            {t('admin.staff.add')}
          </Button>
        }
      />

      <p className="text-sm text-muted-foreground">{t('admin.staff.portalHint')}</p>

      {error && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
      {passwordNotice && (
        <AlertBanner variant="info" message={passwordNotice} onDismiss={() => setPasswordNotice(null)} />
      )}

      {formOpen && (
        <Card className="border-0 shadow-card">
          <CardHeader>
            <CardTitle className="text-base">{form.id ? 'تعديل الموظف' : t('admin.staff.add')}</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="grid gap-4 sm:grid-cols-2" onSubmit={(e) => void onSubmit(e)}>
              <div className="space-y-2">
                <Label htmlFor="name">{t('admin.staff.name')}</Label>
                <Input
                  id="name"
                  required
                  minLength={2}
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">{t('admin.staff.email')}</Label>
                <Input
                  id="email"
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">
                  {t('admin.staff.password')}
                  {form.id ? ' (اتركه فارغاً للإبقاء)' : ''}
                </Label>
                <Input
                  id="password"
                  type="text"
                  required={!form.id}
                  minLength={form.id ? undefined : 8}
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="residence">{t('admin.staff.residence')}</Label>
                <Input
                  id="residence"
                  value={form.residence}
                  onChange={(e) => setForm((f) => ({ ...f, residence: e.target.value }))}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>الوظائف (يمكن اختيار أكثر من واحدة)</Label>
                <div className="flex flex-col gap-2 rounded-md border border-input bg-background p-3">
                  {ROLE_OPTIONS.map((role) => (
                    <label key={role} className="flex cursor-pointer items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={form.roles.includes(role)}
                        onChange={() => toggleRole(role)}
                      />
                      <span>{STAFF_ROLE_LABELS[role]}</span>
                    </label>
                  ))}
                </div>
              </div>
              {form.id && (
                <div className="flex items-center gap-2 sm:col-span-2">
                  <input
                    id="isActive"
                    type="checkbox"
                    checked={form.isActive}
                    onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
                  />
                  <Label htmlFor="isActive">الحساب نشط</Label>
                </div>
              )}
              <div className="flex gap-2 sm:col-span-2">
                <Button type="submit" disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : t('admin.staff.save')}
                </Button>
                <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>
                  إلغاء
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
                  <TableHead>الوظائف</TableHead>
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
                    <TableCell className="text-xs">
                      <div className="flex flex-wrap gap-1">
                        {resolveRowRoles(row).map((r) => (
                          <Badge key={r} variant="secondary">
                            {STAFF_ROLE_LABELS[r]}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>{row.residence || '—'}</TableCell>
                    <TableCell>{formatWhen(row.createdAt)}</TableCell>
                    <TableCell className="space-x-2 text-end rtl:space-x-reverse">
                      <Badge variant={row.isActive ? 'default' : 'secondary'}>
                        {row.isActive ? t('admin.staff.active') : t('admin.staff.inactive')}
                      </Badge>
                      <Button size="sm" variant="outline" onClick={() => openPasswordDialog(row)}>
                        <KeyRound className="h-3.5 w-3.5" />
                        كلمة المرور
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => openEdit(row)}>
                        <Pencil className="h-3.5 w-3.5" />
                        تعديل
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => void toggleActive(row)}>
                        {row.isActive ? t('admin.staff.deactivate') : t('admin.staff.activate')}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {!staff.length && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
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

      <Dialog
        open={Boolean(passwordTarget)}
        onOpenChange={(open) => {
          if (!open) {
            setPasswordTarget(null);
            setPasswordValue('');
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>تغيير كلمة مرور الموظف</DialogTitle>
            <DialogDescription>
              {passwordTarget
                ? `تعيين كلمة مرور جديدة لـ ${passwordTarget.user.name} (${passwordTarget.user.email}) — تُستخدم لدخول /staff/login`
                : ''}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="staff-new-password">كلمة المرور الجديدة</Label>
            <Input
              id="staff-new-password"
              dir="ltr"
              className="font-mono"
              value={passwordValue}
              onChange={(e) => setPasswordValue(e.target.value)}
              minLength={8}
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setPasswordValue(generatePassword())}>
              توليد كلمة مرور
            </Button>
            <Button type="button" disabled={passwordBusy || passwordValue.trim().length < 8} onClick={() => void saveStaffPassword()}>
              {passwordBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              حفظ كلمة المرور
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
