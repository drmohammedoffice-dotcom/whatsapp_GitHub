'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from '@/components/providers/locale-provider';
import { AlertBanner } from '@/components/shared/alert-banner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { api, parseApiError } from '@/lib/utils';

import type { OtpChallenge } from '@/lib/auth';

type OtpVerificationModalProps = {
  open: boolean;
  challenge: OtpChallenge | null;
  verifyPath: 'register/verify' | 'login/verify' | 'reset-password/verify';
  onVerified: (payload: { accessToken?: string; refreshToken?: string; teamId?: string; resetToken?: string }) => void;
  /** Called when WhatsApp reset falls back to email magic-link (no OTP challenge returned). */
  onEmailFallbackSent?: () => void;
  onClose: () => void;
};

const OTP_LENGTH = 6;
const RESEND_COOLDOWN_SEC = 60;

export function OtpVerificationModal({
  open,
  challenge,
  verifyPath,
  onVerified,
  onEmailFallbackSent,
  onClose,
}: OtpVerificationModalProps) {
  const { t } = useTranslation();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_SEC);
  const [activeChallenge, setActiveChallenge] = useState<OtpChallenge | null>(challenge);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const reset = useCallback(() => {
    setCode('');
    setError(null);
    setCooldown(RESEND_COOLDOWN_SEC);
  }, []);

  useEffect(() => {
    setActiveChallenge(challenge);
  }, [challenge]);

  useEffect(() => {
    if (!open) return;
    reset();
    const timer = window.setTimeout(() => inputRef.current?.focus(), 100);
    return () => window.clearTimeout(timer);
  }, [open, challenge?.verificationId, reset]);

  useEffect(() => {
    if (!open || cooldown <= 0) return;
    const timer = window.setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [open, cooldown]);

  function applyCode(raw: string) {
    const next = raw.replace(/\D/g, '').slice(0, OTP_LENGTH);
    setCode(next);
    setError(null);
    if (next.length === OTP_LENGTH) void submitCode(next);
  }

  async function submitCode(value: string) {
    if (!activeChallenge || value.length !== OTP_LENGTH) return;
    setVerifying(true);
    setError(null);
    try {
      const tokens = await api<{ accessToken?: string; refreshToken?: string; teamId?: string; resetToken?: string }>(`/auth/${verifyPath}`, {
        method: 'POST',
        body: JSON.stringify({ verificationId: activeChallenge.verificationId, code: value }),
      });
      onVerified(tokens);
    } catch (err) {
      setError(parseApiError(err));
      setCode('');
      inputRef.current?.focus();
    } finally {
      setVerifying(false);
    }
  }

  async function handleResend() {
    if (!activeChallenge || cooldown > 0) return;
    setResending(true);
    setError(null);
    try {
      const next = await api<OtpChallenge>('/auth/otp/resend', {
        method: 'POST',
        body: JSON.stringify({ verificationId: activeChallenge.verificationId }),
      });
      if (next?.verificationId) setActiveChallenge(next);
      setCooldown(RESEND_COOLDOWN_SEC);
      setCode('');
      inputRef.current?.focus();
    } catch (err) {
      setError(parseApiError(err));
    } finally {
      setResending(false);
    }
  }

  const isSignup = verifyPath === 'register/verify';
  const isReset = verifyPath === 'reset-password/verify';

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader className="text-center sm:text-center">
          <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
            <svg className="h-7 w-7 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
            </svg>
          </div>
          <DialogTitle>{isSignup ? t('auth.otpSignupTitle') : isReset ? t('auth.resetTitle') : t('auth.otpLoginTitle')}</DialogTitle>
          <DialogDescription>
            {activeChallenge?.channel === 'whatsapp'
              ? t('auth.otpWhatsAppSentTo').replace('{phone}', activeChallenge.maskedPhone ?? '')
              : t('auth.otpSentTo').replace('{email}', activeChallenge?.maskedEmail ?? '')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-2">
          <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-center text-xs leading-relaxed text-amber-950 dark:text-amber-100">
            {t('auth.otpSpamHint')}
          </p>

          <Input
            ref={inputRef}
            dir="ltr"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={OTP_LENGTH}
            value={code}
            disabled={verifying}
            placeholder="000000"
            aria-label="Verification code"
            onChange={(e) => applyCode(e.target.value)}
            onPaste={(e) => {
              e.preventDefault();
              applyCode(e.clipboardData.getData('text'));
            }}
            className="h-12 text-center font-mono text-xl tracking-[0.35em]"
          />

          {error && <AlertBanner message={error} onDismiss={() => setError(null)} />}

          <Button
            className="w-full"
            disabled={verifying || code.length !== OTP_LENGTH}
            onClick={() => void submitCode(code)}
          >
            {verifying ? t('auth.otpVerifying') : t('auth.otpVerifyBtn')}
          </Button>

          <div className="text-center text-sm text-muted-foreground">
            {cooldown > 0 ? (
              <span>{t('auth.otpResendIn').replace('{seconds}', String(cooldown))}</span>
            ) : (
              <button
                type="button"
                onClick={() => void handleResend()}
                disabled={resending}
                className="font-medium text-primary hover:underline disabled:opacity-50"
              >
                {resending ? t('auth.otpResending') : t('auth.otpResend')}
              </button>
            )}
            {activeChallenge?.channel === 'whatsapp' && activeChallenge.emailFallbackAvailable ? (
              <div className="mt-2">
                <button
                  type="button"
                  className="font-medium text-primary hover:underline"
                  onClick={() =>
                    void (async () => {
                      setResending(true);
                      try {
                        const next = await api<
                          OtpChallenge | { accepted?: boolean; channel?: string; resetToken?: string }
                        >('/auth/otp/email-fallback', {
                          method: 'POST',
                          body: JSON.stringify({ verificationId: activeChallenge.verificationId }),
                        });
                        // Password-reset email fallback sends a magic link (no OTP challenge).
                        if (
                          verifyPath === 'reset-password/verify' &&
                          next &&
                          typeof next === 'object' &&
                          'accepted' in next &&
                          !('verificationId' in next)
                        ) {
                          onEmailFallbackSent?.();
                          onClose();
                          return;
                        }
                        setActiveChallenge({ ...(next as OtpChallenge), channel: 'email' });
                        setCooldown(RESEND_COOLDOWN_SEC);
                      } catch (err) {
                        setError(parseApiError(err));
                      } finally {
                        setResending(false);
                      }
                    })()
                  }
                >
                  {t('auth.otpEmailFallback')}
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
