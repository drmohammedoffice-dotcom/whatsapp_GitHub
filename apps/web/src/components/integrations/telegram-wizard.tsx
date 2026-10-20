'use client';

import { CheckCircle2, ExternalLink, Send } from 'lucide-react';
import { FormEvent, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api, parseApiError } from '@/lib/utils';

type TelegramWizardProps = {
  onConnected: () => void;
  onError: (message: string) => void;
};

type Step = 'intro' | 'token' | 'verify';

export function TelegramWizard({ onConnected, onError }: TelegramWizardProps) {
  const [step, setStep] = useState<Step>('intro');
  const [botToken, setBotToken] = useState('');
  const [botName, setBotName] = useState('');
  const [validated, setValidated] = useState<{ username?: string; name: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function validateToken() {
    setBusy(true);
    try {
      const result = await api<{ username?: string; name: string }>('/telegram/validate', {
        method: 'POST',
        body: JSON.stringify({ botToken }),
      });
      setValidated(result);
      setStep('verify');
    } catch (err) {
      onError(parseApiError(err));
    } finally {
      setBusy(false);
    }
  }

  async function connect(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await api('/telegram/connect', {
        method: 'POST',
        body: JSON.stringify({ botToken, name: botName || validated?.name }),
      });
      onConnected();
    } catch (err) {
      onError(parseApiError(err));
    } finally {
      setBusy(false);
    }
  }

  if (step === 'intro') {
    return (
      <div className="space-y-4">
        <ol className="list-decimal space-y-2 ps-5 text-sm text-muted-foreground">
          <li>Open Telegram and search for <strong>@BotFather</strong></li>
          <li>Send <code className="rounded bg-muted px-1">/newbot</code> and follow the prompts</li>
          <li>Copy the bot token BotFather gives you</li>
          <li>Paste it in the next step — we configure webhooks automatically</li>
        </ol>
        <Button type="button" className="w-full gap-2" onClick={() => setStep('token')}>
          <Send className="h-4 w-4" />
          Continue
        </Button>
        <Button type="button" variant="outline" className="w-full gap-2" asChild>
          <a href="https://t.me/BotFather" target="_blank" rel="noreferrer">
            <ExternalLink className="h-4 w-4" />
            Open BotFather
          </a>
        </Button>
      </div>
    );
  }

  if (step === 'token') {
    return (
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          validateToken().catch(console.error);
        }}
      >
        <Input
          value={botToken}
          onChange={(e) => setBotToken(e.target.value)}
          placeholder="123456789:ABCdefGHIjklMNOpqrsTUVwxyz"
          required
          type="password"
          autoComplete="off"
        />
        <Input
          value={botName}
          onChange={(e) => setBotName(e.target.value)}
          placeholder="Display name (optional)"
        />
        <Button type="submit" className="w-full" disabled={busy || botToken.length < 20}>
          {busy ? 'Validating…' : 'Validate bot token'}
        </Button>
        <Button type="button" variant="ghost" className="w-full" onClick={() => setStep('intro')}>
          Back
        </Button>
      </form>
    );
  }

  return (
    <form className="space-y-4" onSubmit={connect}>
      <div className="flex items-center gap-3 rounded-lg border bg-muted/30 p-4">
        <CheckCircle2 className="h-8 w-8 text-emerald-500" />
        <div>
          <p className="font-medium">{validated?.name}</p>
          {validated?.username && (
            <p className="text-sm text-muted-foreground">@{validated.username}</p>
          )}
        </div>
      </div>
      <p className="text-sm text-muted-foreground">
        Click connect to register the webhook and start receiving messages.
      </p>
      <Button type="submit" className="w-full" disabled={busy}>
        {busy ? 'Connecting…' : 'Connect Telegram'}
      </Button>
      <Button type="button" variant="ghost" className="w-full" onClick={() => setStep('token')}>
        Back
      </Button>
    </form>
  );
}
