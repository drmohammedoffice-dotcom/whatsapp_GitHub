'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { FormEvent, useEffect, useState } from 'react';
import { OtpVerificationModal } from '@/components/auth/otp-verification-modal';
import { PasswordInput } from '@/components/auth/password-input';
import { AuthLayout } from '@/components/layout/auth-layout';
import { useTranslation } from '@/components/providers/locale-provider';
import { AlertBanner } from '@/components/shared/alert-banner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AuthResponse, isOtpChallenge, OtpChallenge } from '@/lib/auth';
import { fetchSubscriptionStatus } from '@/lib/billing';
import { setAuthCookie, setSubscriptionCookie } from '@/lib/subscription-cookie';
import { getPostAuthRedirect } from '@/lib/subscription-routes';
import { api, checkApiHealth, parseApiError, setSession } from '@/lib/utils';

export default function RegisterPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [apiOnline, setApiOnline] = useState<boolean | null>(null);
  const [otpOpen, setOtpOpen] = useState(false);
  const [challenge, setChallenge] = useState<OtpChallenge | null>(null);

  useEffect(() => {
    let cancelled = false;
    const check = () => {
      checkApiHealth().then((ok) => {
        if (!cancelled) setApiOnline(ok);
      });
    };
    check();
    const timer = window.setInterval(check, 15_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const form = new FormData(event.currentTarget);
    const email = String(form.get('email') ?? '').trim();
    const name = String(form.get('name') ?? '').trim();
    const teamName = String(form.get('teamName') ?? '').trim();
    const pwd = String(form.get('password') ?? '');
    const confirm = String(form.get('confirmPassword') ?? '');

    if (!name || !teamName || !email) {
      setError(t('auth.fillAllFields'));
      return;
    }
    if (pwd.length < 12) {
      setError(t('auth.passwordMin'));
      return;
    }
    if (pwd !== confirm) {
      setError(t('auth.passwordMismatch'));
      return;
    }

    setLoading(true);
    try {
      const result = await api<AuthResponse>('/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          email,
          name,
          teamName,
          password: pwd,
          phone: String(form.get('phone') ?? '').trim() || undefined,
        }),
      });
      if (isOtpChallenge(result)) {
        setChallenge(result);
        setOtpOpen(true);
      } else {
        await handleVerified(result);
      }
    } catch (err) {
      setError(parseApiError(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleVerified(tokens: { accessToken?: string; refreshToken?: string; teamId?: string }) {
    if (!tokens.accessToken || !tokens.refreshToken || !tokens.teamId) return;
    setSession({ accessToken: tokens.accessToken, refreshToken: tokens.refreshToken, teamId: tokens.teamId }, { clearImpersonation: true });
    setAuthCookie();
    setOtpOpen(false);
    try {
      const status = await fetchSubscriptionStatus();
      setSubscriptionCookie(status.isActive);
      router.replace(getPostAuthRedirect(status.isActive));
    } catch {
      setSubscriptionCookie(true);
      router.replace('/tiktok/ads/create');
    }
  }

  const passwordOk = password.length >= 12;
  const confirmOk = confirmPassword.length > 0 && password === confirmPassword;

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
              <PasswordInput
                id="password"
                name="password"
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
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">{t('auth.confirmPassword')}</Label>
              <PasswordInput
                id="confirmPassword"
                name="confirmPassword"
                placeholder={t('auth.confirmPasswordHint')}
                minLength={12}
                required
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
              {confirmPassword.length > 0 && (
                <p className={`text-xs ${confirmOk ? 'text-emerald-600' : 'text-destructive'}`}>
                  {confirmOk ? t('auth.passwordMatch') : t('auth.passwordMismatch')}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">{t('auth.phoneOptional')}</Label>
              <Input id="phone" name="phone" type="tel" autoComplete="tel" placeholder="9647…" className="dir-ltr text-start" />
              <p className="text-xs text-muted-foreground">{t('auth.phoneHint')}</p>
            </div>

            {error && <AlertBanner message={error} onDismiss={() => setError(null)} />}

            <Button className="w-full" disabled={loading}>
              {loading ? t('auth.sendingOtp') : t('auth.registerBtn')}
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

      <OtpVerificationModal
        open={otpOpen}
        challenge={challenge}
        verifyPath="register/verify"
        onVerified={handleVerified}
        onClose={() => setOtpOpen(false)}
      />
    </AuthLayout>
  );
}
