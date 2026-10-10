'use client';

import { MessageCircle } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { API_URL, authedFetch, parseApiError } from '@/lib/utils';

export type MetaOAuthStartResponse = {
  authUrl: string;
  state?: string;
};

const LOG_PREFIX = '[Meta OAuth]';

export async function startMetaOAuth(target?: 'messenger' | 'instagram'): Promise<string> {
  console.info(`${LOG_PREFIX} API called — POST /api/auth/meta/login`);

  const endpoint = `${API_URL}/api/auth/meta/login`;
  console.info(`${LOG_PREFIX} fetch`, { endpoint, method: 'POST' });

  let response: Response;
  try {
    response = await authedFetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(target ? { target } : {}),
    });
  } catch (err) {
    console.error(`${LOG_PREFIX} network/auth error`, err);
    throw err instanceof Error ? err : new TypeError(`Network error calling ${endpoint}`);
  }

  const raw = await response.text();
  console.info(`${LOG_PREFIX} API response`, {
    status: response.status,
    ok: response.ok,
    body: raw.slice(0, 500),
  });

  let body: (MetaOAuthStartResponse & { message?: string | string[] }) | null = null;
  try {
    body = raw ? (JSON.parse(raw) as MetaOAuthStartResponse & { message?: string | string[] }) : null;
  } catch {
    console.error(`${LOG_PREFIX} invalid JSON response`, raw);
    throw new Error(`Invalid API response (${response.status}): ${raw.slice(0, 200)}`);
  }

  if (!response.ok) {
    const message = Array.isArray(body?.message)
      ? body!.message.join(' · ')
      : body?.message ?? raw ?? `HTTP ${response.status}`;
    console.error(`${LOG_PREFIX} API error`, { status: response.status, message });
    throw new Error(message);
  }

  if (!body?.authUrl) {
    console.error(`${LOG_PREFIX} missing authUrl in success response`, body);
    throw new Error(
      'Server did not return authUrl. Verify META_APP_ID and META_APP_SECRET are configured on the API.',
    );
  }

  console.info(`${LOG_PREFIX} Redirect started`, { authUrl: body.authUrl });
  return body.authUrl;
}

type MetaOAuthConnectProps = {
  label?: string;
  busyLabel?: string;
  target?: 'messenger' | 'instagram';
  onError?: (message: string) => void;
  className?: string;
  variant?: 'default' | 'outline' | 'secondary' | 'ghost' | 'destructive' | 'link';
  size?: 'default' | 'sm' | 'lg' | 'icon';
};

export function MetaOAuthConnect({
  label = 'Connect Facebook',
  busyLabel = 'Redirecting…',
  target,
  onError,
  className,
  variant = 'default',
  size = 'default',
}: MetaOAuthConnectProps) {
  const [busy, setBusy] = useState(false);

  async function start() {
    console.info(`${LOG_PREFIX} Button clicked`);
    setBusy(true);
    try {
      window.location.assign(await startMetaOAuth(target));
    } catch (err) {
      const message = parseApiError(err);
      console.error(`${LOG_PREFIX} connect failed`, message);
      onError?.(message);
      setBusy(false);
    }
  }

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      className={className ?? 'w-full gap-2'}
      disabled={busy}
      onClick={() => {
        void start();
      }}
    >
      <MessageCircle className="h-4 w-4" />
      {busy ? busyLabel : label}
    </Button>
  );
}
