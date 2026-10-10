'use client';

import { CheckCircle2, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';

/**
 * Meta redirects here after Embedded Signup with ?code=...
 * Forwards the code to the opener window (parent /whatsapp page) and closes.
 */
export default function WhatsAppEmbeddedCallbackPage() {
  const [status, setStatus] = useState<'working' | 'done' | 'error'>('working');
  const [hint, setHint] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const code = (params.get('code') || hashParams.get('code'))?.trim();
    const error = params.get('error_description') || params.get('error') || hashParams.get('error_description');

    if (error) {
      setStatus('error');
      setHint(decodeURIComponent(error));
      if (window.opener) {
        window.opener.postMessage(
          { type: 'CHATLOORA_WA_EMBED_ERROR', message: decodeURIComponent(error) },
          window.location.origin,
        );
      }
      return;
    }

    if (!code) {
      setStatus('error');
      setHint('لم يتم العثور على رمز الربط في الرابط.');
      return;
    }

    try {
      localStorage.setItem('chatloora_wa_embed_code', JSON.stringify({ code, at: Date.now() }));
    } catch {
      /* ignore */
    }
    try {
      sessionStorage.setItem('chatloora_wa_embed_code', code);
    } catch {
      /* ignore */
    }

    const notify = () => {
      if (window.opener && !window.opener.closed) {
        window.opener.postMessage({ type: 'CHATLOORA_WA_EMBED_CODE', code }, window.location.origin);
      }
    };
    notify();
    const timer = window.setInterval(notify, 400);
    setStatus('done');
    window.setTimeout(() => {
      window.clearInterval(timer);
      if (window.opener && !window.opener.closed) {
        window.close();
        return;
      }
      window.location.replace('/whatsapp?embed_code=1');
    }, 2500);
  }, []);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background p-6 text-center">
      {status === 'working' && (
        <>
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">جاري إكمال ربط واتساب…</p>
        </>
      )}
      {status === 'done' && (
        <>
          <CheckCircle2 className="h-10 w-10 text-emerald-500" />
          <p className="font-medium">تم استلام رمز ميتا</p>
          <p className="text-sm text-muted-foreground">جاري حفظ الرقم في المنصة من الصفحة الأصلية. لا تغلقها قبل ظهور الرقم.</p>
        </>
      )}
      {status === 'error' && (
        <p className="text-sm text-destructive">
          {hint || 'تعذّر إكمال الربط من هذه النافذة. ارجع إلى صفحة واتساب وحاول مرة أخرى.'}
        </p>
      )}
    </div>
  );
}
