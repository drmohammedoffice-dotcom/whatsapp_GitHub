'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChatLooraLogoFull, ChatLooraWordmark } from '@/components/brand/chatloora-brand';
import { useTranslation } from '@/components/providers/locale-provider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { adminLogin, isEmployeeAccount, staffHasRole, setStaffToken } from '@/lib/admin-api';

export default function StaffLoginPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const { accessToken, admin } = await adminLogin(email, password, 'staff');
      if (!isEmployeeAccount(admin)) {
        throw new Error('هذا الحساب ليس حساب موظف — استخدم /admin/login');
      }
      setStaffToken(accessToken);
      const onlyMail =
        staffHasRole(admin, 'MAILBOX_CREATOR') &&
        !staffHasRole(admin, ['ACCOUNTANT', 'STAFF']);
      router.replace(onlyMail ? '/staff/mail' : '/staff');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md border-0 shadow-card">
        <CardHeader className="space-y-3 text-center">
          <div className="mx-auto py-2">
            <ChatLooraLogoFull size="md" priority className="!h-16 w-auto" />
          </div>
          <h1 className="text-xl font-semibold">
            <ChatLooraWordmark size="lg" />{' '}
            <span className="text-muted-foreground">{t('staff.loginTitle')}</span>
          </h1>
          <p className="text-sm text-muted-foreground">{t('staff.loginSubtitle')}</p>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={(e) => void onSubmit(e)}>
            <div className="space-y-2">
              <Label htmlFor="email">{t('admin.staff.email')}</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">{t('admin.staff.password')}</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? '...' : t('staff.loginTitle')}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
