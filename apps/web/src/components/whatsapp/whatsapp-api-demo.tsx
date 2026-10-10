'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, Copy, Loader2, Send } from 'lucide-react';
import { LandingFooter } from '@/components/landing/landing-sections';
import { LandingNavbar } from '@/components/landing/landing-navbar';
import { LandingShell } from '@/components/landing/landing-ui';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
const PUBLIC_CLOUD = `${API_URL}/api/v1/public/whatsapp-cloud`;

type SetupPayload = {
  configured: boolean;
  phoneNumberId: string | null;
  wabaId: string | null;
  displayPhone: string | null;
  graphVersion: string;
  endpoint: string | null;
  curl: string | null;
  tokenPreview: string | null;
};

export function WhatsAppApiDemoClient() {
  const [setup, setSetup] = useState<SetupPayload | null>(null);
  const [to, setTo] = useState('');
  const [body, setBody] = useState('Hello from ChatLoora — WhatsApp Cloud API test message.');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${PUBLIC_CLOUD}/setup`, { cache: 'no-store' })
      .then((r) => r.json() as Promise<SetupPayload>)
      .then(setSetup)
      .catch(() => setSetup({ configured: false, phoneNumberId: null, wabaId: null, displayPhone: null, graphVersion: 'v21.0', endpoint: null, curl: null, tokenPreview: null }));
  }, []);

  const liveCurl = useMemo(() => {
    if (!setup?.curl) return null;
    if (!to.trim()) return setup.curl;
    return setup.curl.replace('<RECIPIENT_WA_ID>', to.replace(/[^\d]/g, ''));
  }, [setup?.curl, to]);

  async function copyCurl() {
    if (!liveCurl) return;
    await navigator.clipboard.writeText(liveCurl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function sendMessage() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(`${PUBLIC_CLOUD}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to, body }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(typeof data?.message === 'string' ? data.message : JSON.stringify(data?.detail ?? data));
      }
      setResult(`Message sent successfully. WhatsApp message id: ${data.messageId ?? 'ok'}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Send failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <section className="rounded-2xl border border-slate-200 bg-white/90 p-6 shadow-soft sm:p-8">
        <h2 className="text-lg font-bold text-slate-900">1. Meta API Setup — cURL (step 2)</h2>
        <p className="mt-2 text-sm text-slate-600">
          This is the WhatsApp Cloud API <code className="rounded bg-slate-100 px-1">POST /messages</code> command
          from Meta&apos;s API Setup tool, embedded in ChatLoora for App Review of{' '}
          <code className="rounded bg-slate-100 px-1">whatsapp_business_messaging</code>.
        </p>
        {setup?.configured ? (
          <>
            <dl className="mt-4 grid gap-2 text-sm text-slate-700 sm:grid-cols-2">
              <div>
                <dt className="font-semibold text-slate-900">Phone number ID</dt>
                <dd className="font-mono">{setup.phoneNumberId}</dd>
              </div>
              <div>
                <dt className="font-semibold text-slate-900">Display phone</dt>
                <dd>{setup.displayPhone ?? '—'}</dd>
              </div>
              <div>
                <dt className="font-semibold text-slate-900">WABA ID</dt>
                <dd className="font-mono">{setup.wabaId ?? '—'}</dd>
              </div>
              <div>
                <dt className="font-semibold text-slate-900">Graph version</dt>
                <dd>{setup.graphVersion}</dd>
              </div>
            </dl>
            <pre className="mt-4 overflow-x-auto rounded-xl bg-slate-950 p-4 text-xs leading-relaxed text-emerald-300 whitespace-pre-wrap">
              {liveCurl}
            </pre>
            <Button type="button" variant="outline" className="mt-3 gap-2" onClick={() => void copyCurl()}>
              {copied ? <CheckCircle2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? 'Copied' : 'Copy cURL'}
            </Button>
          </>
        ) : (
          <p className="mt-4 text-sm text-amber-700">Cloud API demo credentials are not configured yet.</p>
        )}
      </section>

      <section className="rounded-2xl border border-violet-100 bg-violet-50/50 p-6 sm:p-8">
        <h2 className="text-lg font-bold text-slate-900">2. Send message from ChatLoora</h2>
        <p className="mt-2 text-sm text-slate-600">
          Enter a recipient WhatsApp number (country code, digits only) and send a text message through ChatLoora&apos;s
          WhatsApp Cloud API integration. Open WhatsApp on your phone to confirm delivery while recording the App Review
          video.
        </p>
        <div className="mt-5 space-y-4">
          <div>
            <Label htmlFor="to">Recipient WhatsApp number</Label>
            <Input
              id="to"
              className="mt-1 bg-white"
              placeholder="9647XXXXXXXX"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="body">Message</Label>
            <Textarea
              id="body"
              className="mt-1 bg-white"
              rows={3}
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
          </div>
          <Button
            type="button"
            className="gap-2"
            disabled={loading || !setup?.configured || !to.trim() || !body.trim()}
            onClick={() => void sendMessage()}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Send via WhatsApp Cloud API
          </Button>
          {result ? <p className="text-sm font-medium text-emerald-700">{result}</p> : null}
          {error ? <p className="text-sm font-medium text-red-600">{error}</p> : null}
        </div>
      </section>

      <p className="text-sm text-slate-500">
        Platform operators can also connect Cloud API numbers inside the app:{' '}
        <Link href="/whatsapp" className="font-medium text-violet-700 hover:underline">
          WhatsApp connect
        </Link>{' '}
        or{' '}
        <Link href="/platform" className="font-medium text-violet-700 hover:underline">
          Platform → WhatsApp Cloud
        </Link>
        .
      </p>
    </div>
  );
}

export function WhatsAppApiDemoPageShell({ children }: { children: React.ReactNode }) {
  return (
    <LandingShell>
      <LandingNavbar />
      <main className="px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl">
          <p className="text-xs font-semibold tracking-[0.18em] text-violet-600 uppercase">Meta · WhatsApp</p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            ChatLoora WhatsApp Cloud API
          </h1>
          <p className="mt-4 text-base text-slate-600 sm:text-lg">
            ChatLoora (operated by Mey Architects, PC) sends WhatsApp messages through the official Meta WhatsApp Cloud
            API. This page is published for Meta App Review of advanced access to{' '}
            <strong>whatsapp_business_messaging</strong>.
          </p>
          <div className="mt-10">{children}</div>
        </div>
      </main>
      <LandingFooter />
    </LandingShell>
  );
}
