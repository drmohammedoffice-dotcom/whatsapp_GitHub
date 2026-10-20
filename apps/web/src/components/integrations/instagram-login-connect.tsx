'use client';

import { Camera, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { api, parseApiError } from '@/lib/utils';

type ConnectResult = {
  channelId: string;
  instagramId: string;
  username: string | null;
  subscriptions: unknown;
  appWebhook: { ok?: boolean; reason?: unknown };
};

export function InstagramLoginConnect({
  onSuccess,
  onError,
}: {
  onSuccess?: (result: ConnectResult) => void;
  onError?: (message: string) => void;
}) {
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);

  async function connect() {
    const accessToken = token.trim();
    if (!accessToken.startsWith('IG')) {
      onError?.('الصق رمز الوصول الكامل من Meta (يبدأ بـ IGAA…)');
      return;
    }
    setBusy(true);
    try {
      const result = await api<ConnectResult>('/meta/instagram-login/connect', {
        method: 'POST',
        body: JSON.stringify({ accessToken }),
      });
      onSuccess?.(result);
      setToken('');
    } catch (err) {
      onError?.(parseApiError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3 rounded-xl border border-dashed bg-muted/20 p-4">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Camera className="h-4 w-4" />
        ربط Instagram API (توكن من لوحة Meta)
      </div>
      <p className="text-xs text-muted-foreground">
        من تطبيق chatloora-IG: انسخ رمز الوصول لحسابك ثم الصقه هنا. سيتم اشتراك Webhook للتعليقات والرسائل تلقائياً.
      </p>
      <Textarea
        value={token}
        onChange={(e) => setToken(e.target.value)}
        placeholder="IGAAxYAdBCPc5BZAGI…"
        rows={3}
        className="font-mono text-xs"
      />
      <Button type="button" className="gap-2" disabled={busy || !token.trim()} onClick={() => void connect()}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
        {busy ? 'جاري الربط…' : 'ربط + اشتراك Webhook'}
      </Button>
    </div>
  );
}
