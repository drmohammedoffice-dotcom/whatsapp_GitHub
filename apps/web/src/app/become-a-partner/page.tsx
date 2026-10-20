'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { AuthLayout } from '@/components/layout/auth-layout';
import { useTranslation } from '@/components/providers/locale-provider';
import { AlertBanner } from '@/components/shared/alert-banner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { applyAsPartner } from '@/lib/partner-api';
import { parseApiError } from '@/lib/utils';

export default function BecomeAPartnerPage() {
  const { t } = useTranslation();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const form = new FormData(event.currentTarget);
    setLoading(true);
    try {
      await applyAsPartner({
        name: String(form.get('name') ?? '').trim(),
        email: String(form.get('email') ?? '').trim(),
        phone: String(form.get('phone') ?? '').trim(),
        country: String(form.get('country') ?? '').trim(),
        reason: String(form.get('reason') ?? '').trim(),
      });
      setSuccess(true);
    } catch (err) {
      setError(parseApiError(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout title={t('partners.applyTitle')} subtitle={t('partners.applySubtitle')}>
      <Card className="border-0 shadow-card">
        <CardContent className="pt-6">
          {success ? (
            <div className="space-y-4">
              <AlertBanner variant="success" message={t('partners.applySuccess')} />
              <Button asChild className="w-full">
                <Link href="/partners/login">{t('partners.partnerLogin')}</Link>
              </Button>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">{t('partners.name')}</Label>
                <Input id="name" name="name" required minLength={2} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">{t('partners.email')}</Label>
                <Input id="email" name="email" type="email" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">{t('partners.phone')}</Label>
                <Input id="phone" name="phone" required minLength={6} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="country">{t('partners.country')}</Label>
                <Input id="country" name="country" required minLength={2} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="reason">{t('partners.reason')}</Label>
                <Textarea id="reason" name="reason" required minLength={10} rows={4} />
              </div>
              {error && <AlertBanner message={error} onDismiss={() => setError(null)} />}
              <Button className="w-full" disabled={loading}>
                {loading ? t('partners.applying') : t('partners.applyBtn')}
              </Button>
              <p className="text-center text-sm text-muted-foreground">
                <Link className="font-medium text-primary hover:underline" href="/partners/login">
                  {t('partners.partnerLogin')}
                </Link>
              </p>
            </form>
          )}
        </CardContent>
      </Card>
    </AuthLayout>
  );
}
