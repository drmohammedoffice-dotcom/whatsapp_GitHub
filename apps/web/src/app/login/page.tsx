'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
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
import { api, checkApiHealth, ensureValidSession, getRememberedEmail, parseApiError, setRememberedEmail, setSession } from '@/lib/utils';

export default function LoginPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [apiOnline, setApiOnline] = useState<boolean | null>(null);
  const [remember, setRemember] = useState(true);
  const [savedEmail, setSavedEmail] = useState('');
  const [otpOpen, setOtpOpen] = useState(false);
  const [challenge, setChallenge] = useState<OtpChallenge | null>(null);
  const [pendingEmail, setPendingEmail] = useState('');

  useEffect(() => {
    let cancelled = false;
    const check = () => {
      checkApiHealth().then((ok) => {
        if (!cancelled) setApiOnline(ok);
      });
    };
    check();
    const timer = window.setInterval(check, 15_000);
    setSavedEmail(getRememberedEmail() ?? '');
    ensureValidSession().then(async (valid) => {
      if (!valid) return;
      setAuthCookie();
      try {
        const status = await fetchSubscriptionStatus();
        setSubscriptionCookie(status.isActive);
        router.replace(getPostAuthRedirect(status.isActive));
      } catch {
        router.replace('/tiktok/ads/create');
      }
    });
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [router]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    const form = new FormData(event.currentTarget);
    const email = String(form.get('email') ?? '').trim();
    setPendingEmail(email);
    try {
      const result = await api<AuthResponse>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password: form.get('password') }),
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
    if (remember) setRememberedEmail(pendingEmail);
    else setRememberedEmail(null);
    try {
      const status = await fetchSubscriptionStatus();
      setSubscriptionCookie(status.isActive);
      router.replace(getPostAuthRedirect(status.isActive));
    } catch {
      setSubscriptionCookie(true);
      router.replace('/tiktok/ads/create');
    }
  }

  const verifyPath = challenge?.reason === 'email_not_verified' ? 'register/verify' : 'login/verify';

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
              <PasswordInput id="password" name="password" placeholder="••••••••" required autoComplete="current-password" />
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

            <Button className="w-full" disabled={loading}>
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

      <OtpVerificationModal
        open={otpOpen}
        challenge={challenge}
        verifyPath={verifyPath}
        onVerified={handleVerified}
        onClose={() => setOtpOpen(false)}
      />
    </AuthLayout>
  );
}
