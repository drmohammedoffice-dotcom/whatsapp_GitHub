'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AuthLayout } from '@/components/layout/auth-layout';
import { useTranslation } from '@/components/providers/locale-provider';
import { AlertBanner } from '@/components/shared/alert-banner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { partnerLogin, setPartnerToken } from '@/lib/partner-api';
import { parseApiError } from '@/lib/utils';

export default function PartnerLoginPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const form = new FormData(event.currentTarget);
    setLoading(true);
    try {
      const result = await partnerLogin(String(form.get('email') ?? ''), String(form.get('password') ?? ''));
      setPartnerToken(result.accessToken);
      router.replace('/partners/dashboard');
    } catch (err) {
      setError(parseApiError(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout title={t('partners.loginTitle')} subtitle={t('partners.loginSubtitle')}>
      <Card className="border-0 shadow-card">
        <CardContent className="pt-6">
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">{t('partners.email')}</Label>
              <Input id="email" name="email" type="email" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">{t('auth.password')}</Label>
              <Input id="password" name="password" type="password" required minLength={8} />
            </div>
            {error && <AlertBanner message={error} onDismiss={() => setError(null)} />}
            <Button className="w-full" disabled={loading}>
              {loading ? t('auth.loggingIn') : t('partners.loginBtn')}
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              <Link className="font-medium text-primary hover:underline" href="/become-a-partner">
                {t('partners.becomePartner')}
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </AuthLayout>
  );
}
