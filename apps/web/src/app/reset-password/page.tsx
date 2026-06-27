'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { AuthLayout } from '@/components/layout/auth-layout';
import { useTranslation } from '@/components/providers/locale-provider';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { api } from '@/lib/utils';

export default function ResetPasswordPage() {
  const { t } = useTranslation();
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    const form = new FormData(event.currentTarget);
    await api('/auth/reset-password', { method: 'POST', body: JSON.stringify({ email: form.get('email') }) });
    setMessage(t('auth.resetSentMessage'));
    setLoading(false);
  }

  return (
    <AuthLayout title={t('auth.resetTitle')} subtitle={t('auth.resetSubtitle')}>
      <Card className="border-0 shadow-card">
        <CardContent className="pt-6">
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">{t('auth.email')}</Label>
              <Input id="email" name="email" type="email" placeholder="you@company.com" required />
            </div>
            <Button className="w-full" disabled={loading}>
              {loading ? t('auth.sending') : t('auth.sendResetBtn')}
            </Button>
          </form>
          {message && <p className="mt-4 rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">{message}</p>}
          <p className="mt-6 text-center text-sm text-muted-foreground">
            <Link className="font-medium text-primary hover:underline" href="/login">
              {t('auth.backToSignIn')}
            </Link>
          </p>
        </CardContent>
      </Card>
    </AuthLayout>
  );
}
