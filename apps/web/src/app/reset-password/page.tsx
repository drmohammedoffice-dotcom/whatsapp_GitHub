'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { FormEvent, Suspense, useEffect, useState } from 'react';
import { OtpVerificationModal } from '@/components/auth/otp-verification-modal';
import { AuthLayout } from '@/components/layout/auth-layout';
import { useTranslation } from '@/components/providers/locale-provider';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { OtpChallenge } from '@/lib/auth';
import { isOtpChallenge } from '@/lib/auth';
import { api, parseApiError } from '@/lib/utils';

function ResetPasswordForm() {
  const { t } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [challenge, setChallenge] = useState<OtpChallenge | null>(null);
  const [resetToken, setResetToken] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const token = searchParams.get('token')?.trim();
    if (token) {
      setResetToken(token);
      setMessage(null);
      setError(null);
      setDone(false);
    }
  }, [searchParams]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage(null);
    setError(null);
    const form = new FormData(event.currentTarget);
    try {
      const response = await api<OtpChallenge | { accepted?: boolean; channel?: string }>(
        '/auth/reset-password',
        {
          method: 'POST',
          body: JSON.stringify({ email: form.get('email') }),
        },
      );
      if (isOtpChallenge(response as OtpChallenge)) {
        setChallenge(response as OtpChallenge);
      } else {
        setMessage(t('auth.resetEmailSent'));
      }
    } catch (err) {
      setError(parseApiError(err));
    } finally {
      setLoading(false);
    }
  }

  async function savePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!resetToken) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    const form = new FormData(event.currentTarget);
    const password = String(form.get('password') ?? '');
    const confirm = String(form.get('confirmPassword') ?? '');
    if (password.length < 12) {
      setError(t('auth.passwordMin'));
      setSaving(false);
      return;
    }
    if (password !== confirm) {
      setError(t('auth.passwordMismatch'));
      setSaving(false);
      return;
    }
    try {
      await api('/auth/reset-password/confirm', {
        method: 'POST',
        body: JSON.stringify({ token: resetToken, password }),
      });
      setDone(true);
      setResetToken(null);
      setMessage(t('auth.resetSuccess'));
      window.setTimeout(() => router.push('/login'), 1800);
    } catch (err) {
      setError(parseApiError(err) || t('auth.resetInvalidToken'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <AuthLayout title={t('auth.resetTitle')} subtitle={t('auth.resetSubtitle')}>
      <Card className="border-0 shadow-card">
        <CardContent className="pt-6">
          {done ? (
            <div className="space-y-4 text-center">
              <p className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">{message}</p>
              <Link className="text-sm font-medium text-primary hover:underline" href="/login">
                {t('auth.backToSignIn')}
              </Link>
            </div>
          ) : resetToken ? (
            <form onSubmit={savePassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">{t('auth.password')}</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  minLength={12}
                  autoComplete="new-password"
                  placeholder={t('auth.passwordHint')}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">{t('auth.confirmPassword')}</Label>
                <Input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  minLength={12}
                  autoComplete="new-password"
                  placeholder={t('auth.confirmPasswordHint')}
                  required
                />
              </div>
              <Button className="w-full" disabled={saving}>
                {saving ? t('auth.sending') : t('auth.resetNewPasswordBtn')}
              </Button>
            </form>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">{t('auth.email')}</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="you@company.com"
                  autoComplete="email"
                  required
                />
              </div>
              <Button className="w-full" disabled={loading}>
                {loading ? t('auth.sending') : t('auth.sendResetBtn')}
              </Button>
            </form>
          )}
          {error && (
            <p className="mt-4 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
          )}
          {message && !done && (
            <p className="mt-4 rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">{message}</p>
          )}
          {!done && (
            <p className="mt-6 text-center text-sm text-muted-foreground">
              <Link className="font-medium text-primary hover:underline" href="/login">
                {t('auth.backToSignIn')}
              </Link>
            </p>
          )}
        </CardContent>
      </Card>
      <OtpVerificationModal
        open={Boolean(challenge)}
        challenge={challenge}
        verifyPath="reset-password/verify"
        onVerified={(payload) => {
          if (payload.resetToken) setResetToken(payload.resetToken);
          setChallenge(null);
        }}
        onEmailFallbackSent={() => {
          setChallenge(null);
          setMessage(t('auth.resetEmailSent'));
        }}
        onClose={() => setChallenge(null)}
      />
    </AuthLayout>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordForm />
    </Suspense>
  );
}
