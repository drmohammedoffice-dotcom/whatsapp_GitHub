'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useState } from 'react';
import { AuthLayout } from '@/components/layout/auth-layout';
import { useTranslation } from '@/components/providers/locale-provider';
import { AlertBanner } from '@/components/shared/alert-banner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { api, checkApiHealth, ensureValidSession, getRememberedEmail, parseApiError, setRememberedEmail, setSession } from '@/lib/utils';

export default function LoginPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [apiOnline, setApiOnline] = useState<boolean | null>(null);

  const [remember, setRemember] = useState(true);
  const [savedEmail, setSavedEmail] = useState('');

  useEffect(() => {
    checkApiHealth().then(setApiOnline);
    setSavedEmail(getRememberedEmail() ?? '');
    ensureValidSession().then((valid) => {
      if (valid) router.replace('/inbox/whatsapp');
    });
  }, [router]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    const form = new FormData(event.currentTarget);
    try {
      const tokens = await api<{ accessToken: string; refreshToken: string; teamId: string }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: form.get('email'), password: form.get('password') }),
      });
      setSession(tokens);
      const email = String(form.get('email') ?? '').trim();
      if (remember) setRememberedEmail(email);
      else setRememberedEmail(null);
      router.replace('/inbox/whatsapp');
    } catch (err) {
      setError(parseApiError(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout title={t('auth.loginTitle')} subtitle={t('auth.loginSubtitle')}>
      <Card className="border-0 shadow-card">
        <CardContent className="pt-6">
          {apiOnline === false && (
            <AlertBanner className="mb-4" message={t('auth.apiOffline')} />
          )}

          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">{t('auth.email')}</Label>
              <Input id="email" name="email" type="email" placeholder="you@company.com" required autoComplete="email" defaultValue={savedEmail} />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">{t('auth.password')}</Label>
                <Link href="/reset-password" className="text-xs text-primary hover:underline">
                  {t('auth.forgotPassword')}
                </Link>
              </div>
              <Input id="password" name="password" type="password" placeholder="••••••••" required autoComplete="current-password" />
            </div>

            <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className="h-4 w-4 rounded border-input accent-primary"
              />
              {t('auth.rememberMe')}
            </label>

            {error && <AlertBanner message={error} onDismiss={() => setError(null)} />}

            <Button className="w-full" disabled={loading || apiOnline === false}>
              {loading ? t('auth.loggingIn') : t('auth.loginBtn')}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            {t('auth.noAccount')}{' '}
            <Link className="font-medium text-primary hover:underline" href="/register">
              {t('auth.createAccount')}
            </Link>
          </p>
        </CardContent>
      </Card>
    </AuthLayout>
  );
}
