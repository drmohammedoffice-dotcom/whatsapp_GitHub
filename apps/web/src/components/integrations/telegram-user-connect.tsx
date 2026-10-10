'use client';

import { CheckCircle2, Phone, Shield } from 'lucide-react';
import { FormEvent, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AlertBanner } from '@/components/shared/alert-banner';
import { useTranslation } from '@/components/providers/locale-provider';
import { isValidTelegramPhone, normalizeTelegramPhone } from '@/lib/telegram-phone';
import { api, parseApiError } from '@/lib/utils';

type TelegramProfile = {
  firstName?: string;
  lastName?: string;
  username?: string;
  phoneNumber: string;
  telegramUserId: string;
};

type TelegramUserConnectProps = {
  onConnected: () => void;
  onError: (message: string) => void;
};

type Step = 'phone' | 'code' | 'password' | 'done';

export function TelegramUserConnect({ onConnected, onError }: TelegramUserConnectProps) {
  const { t } = useTranslation();
  const [step, setStep] = useState<Step>('phone');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [authId, setAuthId] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [profile, setProfile] = useState<TelegramProfile | null>(null);
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  async function sendCode(event: FormEvent) {
    event.preventDefault();
    setLocalError(null);
    const normalized = normalizeTelegramPhone(phoneNumber);
    if (!isValidTelegramPhone(normalized)) {
      const message = t('integrationsHub.telegramPhoneInvalid');
      setLocalError(message);
      onError(message);
      return;
    }
    setPhoneNumber(normalized);
    setBusy(true);
    try {
      const result = await api<{ authId: string }>('/telegram-user/auth/send-code', {
        method: 'POST',
        body: JSON.stringify({ phoneNumber: normalized }),
      });
      setAuthId(result.authId);
      setStep('code');
    } catch (err) {
      const message = parseApiError(err);
      setLocalError(message);
      onError(message);
    } finally {
      setBusy(false);
    }
  }

  async function verifyCode(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const result = await api<{ needsPassword?: boolean; profile?: TelegramProfile }>('/telegram-user/auth/verify-code', {
        method: 'POST',
        body: JSON.stringify({ authId, code }),
      });
      if (result.needsPassword) {
        setStep('password');
        return;
      }
      if (result.profile) setProfile(result.profile);
      setStep('done');
      onConnected();
    } catch (err) {
      onError(parseApiError(err));
    } finally {
      setBusy(false);
    }
  }

  async function verifyPassword(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const result = await api<{ profile?: TelegramProfile }>('/telegram-user/auth/verify-password', {
        method: 'POST',
        body: JSON.stringify({ authId, password }),
      });
      if (result.profile) setProfile(result.profile);
      setStep('done');
      onConnected();
    } catch (err) {
      onError(parseApiError(err));
    } finally {
      setBusy(false);
    }
  }

  if (step === 'done' && profile) {
    return (
      <div className="space-y-4 rounded-xl border bg-muted/20 p-4">
        <div className="flex items-center gap-3">
          <CheckCircle2 className="h-8 w-8 text-emerald-500" />
          <div>
            <p className="font-medium">{[profile.firstName, profile.lastName].filter(Boolean).join(' ') || profile.phoneNumber}</p>
            {profile.username && <p className="text-sm text-muted-foreground">@{profile.username}</p>}
            <p className="text-xs text-muted-foreground">{profile.phoneNumber}</p>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'phone') {
    return (
      <form className="space-y-3" onSubmit={sendCode}>
        {localError && <AlertBanner message={localError} onDismiss={() => setLocalError(null)} />}
        <p className="text-sm text-muted-foreground">
          Enter your phone number with country code — we will send a Telegram verification code, just like Telegram Desktop.
        </p>
        <Input
          value={phoneNumber}
          onChange={(e) => setPhoneNumber(e.target.value)}
          placeholder="+9647XXXXXXXX"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          required
        />
        <Button type="submit" className="w-full gap-2" disabled={busy || !phoneNumber.trim()}>
          <Phone className="h-4 w-4" />
          {busy ? 'Sending code…' : 'Connect Telegram'}
        </Button>
      </form>
    );
  }

  if (step === 'code') {
    return (
      <form className="space-y-3" onSubmit={verifyCode}>
        <p className="text-sm text-muted-foreground">Enter the code Telegram sent to {phoneNumber}</p>
        <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="12345" required />
        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? 'Verifying…' : 'Verify code'}
        </Button>
        <Button type="button" variant="ghost" className="w-full" onClick={() => setStep('phone')}>
          Change phone number
        </Button>
      </form>
    );
  }

  return (
    <form className="space-y-3" onSubmit={verifyPassword}>
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Shield className="h-4 w-4" />
        Two-step verification is enabled. Enter your Telegram password.
      </p>
      <Input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Password"
        required
      />
      <Button type="submit" className="w-full" disabled={busy}>
        {busy ? 'Signing in…' : 'Complete login'}
      </Button>
    </form>
  );
}
