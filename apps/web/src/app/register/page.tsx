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
import { api, checkApiHealth, parseApiError, setSession } from '@/lib/utils';

export default function RegisterPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [password, setPassword] = useState('');
  const [apiOnline, setApiOnline] = useState<boolean | null>(null);

  useEffect(() => {
    checkApiHealth().then(setApiOnline);
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const form = new FormData(event.currentTarget);
    const email = String(form.get('email') ?? '').trim();
    const name = String(form.get('name') ?? '').trim();
    const teamName = String(form.get('teamName') ?? '').trim();
    const pwd = String(form.get('password') ?? '');

    if (!name || !teamName || !email) {
      setError(t('auth.fillAllFields'));
      return;
    }
    if (pwd.length < 12) {
      setError(t('auth.passwordMin'));
      return;
    }

    setLoading(true);
    try {
      const tokens = await api<{ accessToken: string; refreshToken: string; teamId: string }>('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ email, name, teamName, password: pwd }),
      });
      setSession(tokens);
      router.replace('/inbox/whatsapp');
    } catch (err) {
      setError(parseApiError(err));
    } finally {
      setLoading(false);
    }
  }

  const passwordOk = password.length >= 12;

  return (
    <AuthLayout title={t('auth.registerTitle')} subtitle={t('auth.registerSubtitle')}>
      <Card className="border-0 shadow-card">
        <CardContent className="pt-6">
          {apiOnline === false && (
            <AlertBanner className="mb-4" message={t('auth.apiOffline')} />
          )}

          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">{t('auth.name')}</Label>
              <Input id="name" name="name" required autoComplete="name" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="teamName">{t('auth.teamName')}</Label>
              <Input id="teamName" name="teamName" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">{t('auth.email')}</Label>
              <Input id="email" name="email" type="email" placeholder="you@company.com" required autoComplete="email" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">{t('auth.password')}</Label>
              <Input
                id="password"
                name="password"
                type="password"
                placeholder={t('auth.passwordHint')}
                minLength={12}
                required
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <p className={`text-xs ${passwordOk ? 'text-emerald-600' : 'text-muted-foreground'}`}>
                {password.length}/12 {t('auth.passwordChars')} {passwordOk ? '✓' : t('auth.passwordCharsRequired')}
              </p>
            </div>

            {error && <AlertBanner message={error} onDismiss={() => setError(null)} />}

            <Button className="w-full" disabled={loading || apiOnline === false}>
              {loading ? t('auth.registering') : t('auth.registerBtn')}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            {t('auth.hasAccount')}{' '}
            <Link className="font-medium text-primary hover:underline" href="/login">
              {t('auth.signInLink')}
            </Link>
          </p>
        </CardContent>
      </Card>
    </AuthLayout>
  );
}
