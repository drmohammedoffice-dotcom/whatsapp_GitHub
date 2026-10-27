'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { AlertTriangle, Loader2, Trash2 } from 'lucide-react';
import { ACCOUNT_DELETE_ANCHOR } from '@/components/legal/account-deletion-actions';
import { useTranslation } from '@/components/providers/locale-provider';
import { AlertBanner } from '@/components/shared/alert-banner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LEGAL_ROUTES } from '@/lib/company-info';
import { clearStoredPushToken } from '@/lib/push-devices';
import { API_URL, authedFetch, clearSession, parseApiError, setRememberedEmail } from '@/lib/utils';

const CONFIRM_WORDS = ['DELETE', 'حذف'];

const COPY = {
  ar: {
    title: 'حذف الحساب',
    zone: 'منطقة الخطر',
    desc: 'حذف حسابك وكل بيانات مساحة العمل نهائياً. لا يمكن التراجع عن هذا الإجراء.',
    open: 'حذف الحساب',
    dialogTitle: 'حذف الحساب نهائياً؟',
    dialogDesc: 'سيتم حذف حسابك فوراً وتسجيل خروجك من جميع الأجهزة.',
    deletedTitle: 'ما الذي سيُحذف:',
    deleted: [
      'ملف الحساب الشخصي',
      'جلسات واتساب وبيانات الاعتماد',
      'محادثات صندوق الوارد وجهات الاتصال والوسائط',
      'بيانات التتبع والتحويلات',
      'ربط حسابات تيك توك ورموز الوصول',
      'بيانات النماذج الفورية والمتجر والطلبات',
      'الملفات المرفوعة',
    ],
    retainedTitle: 'ما الذي نحتفظ به:',
    retained: 'سجلات الدفع والفواتير (التزامات محاسبية وقانونية) وحد أدنى من سجلات التدقيق الأمني. تُزال البيانات من النسخ الاحتياطية خلال 30 يوماً.',
    more: 'تفاصيل أكثر',
    password: 'كلمة المرور الحالية',
    confirmLabel: 'اكتب DELETE أو «حذف» للتأكيد',
    cancel: 'إلغاء',
    submit: 'حذف الحساب نهائياً',
    deleting: 'جارٍ الحذف…',
    wrongWord: 'اكتب DELETE أو «حذف» بالضبط للتأكيد.',
    failed: 'تعذّر حذف الحساب. حاول مرة أخرى.',
    network: 'تعذّر الاتصال بالخادم. تحقق من الإنترنت وحاول مرة أخرى.',
  },
  en: {
    title: 'Delete account',
    zone: 'Danger zone',
    desc: 'Permanently delete your account and all workspace data. This cannot be undone.',
    open: 'Delete account',
    dialogTitle: 'Delete account permanently?',
    dialogDesc: 'Your account will be deleted immediately and you will be signed out on all devices.',
    deletedTitle: 'What will be deleted:',
    deleted: [
      'Your account profile',
      'WhatsApp sessions and credentials',
      'Inbox conversations, contacts and media',
      'Tracking and conversion data',
      'TikTok connections and access tokens',
      'Instant forms, store and order data',
      'Uploaded files',
    ],
    retainedTitle: 'What we keep:',
    retained: 'Payment records and invoices (accounting / legal obligations) and minimal security audit logs. Data is removed from backups within 30 days.',
    more: 'More details',
    password: 'Current password',
    confirmLabel: 'Type DELETE to confirm',
    cancel: 'Cancel',
    submit: 'Delete account permanently',
    deleting: 'Deleting…',
    wrongWord: 'Type DELETE exactly to confirm.',
    failed: 'Could not delete the account. Please try again.',
    network: 'Could not reach the server. Check your connection and try again.',
  },
} as const;

async function readMessage(response: Response, fallback: string) {
  try {
    const body = (await response.json()) as { message?: unknown };
    if (typeof body.message === 'string' && body.message.trim()) return body.message;
    if (Array.isArray(body.message) && body.message.length) return body.message.join(' · ');
  } catch {
    /* not JSON */
  }
  return fallback;
}

function clearLocalAuthState() {
  // The account (and its registered devices) is gone server-side; just forget the token locally.
  clearStoredPushToken();
  clearSession();
  setRememberedEmail(null);
  try {
    window.sessionStorage.clear();
  } catch {
    /* ignore */
  }
}

export function DeleteAccountCard() {
  const { locale } = useTranslation();
  const c = locale === 'ar' ? COPY.ar : COPY.en;
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Deep link from /account-deletion → /account#delete-account opens the dialog.
  useEffect(() => {
    if (window.location.hash === `#${ACCOUNT_DELETE_ANCHOR}`) {
      document.getElementById(ACCOUNT_DELETE_ANCHOR)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setOpen(true);
    }
  }, []);

  const confirmOk = CONFIRM_WORDS.includes(confirmation.trim());

  function onOpenChange(next: boolean) {
    if (busy) return;
    setOpen(next);
    if (!next) {
      setPassword('');
      setConfirmation('');
      setError(null);
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!confirmOk) {
      setError(c.wrongWord);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const response = await authedFetch(
        `${API_URL}/api/v1/account/delete`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          // API contract expects the literal "DELETE" regardless of the word the user typed.
          body: JSON.stringify({ password, confirmation: 'DELETE' }),
        },
        // A 401 here usually means "wrong password" — show it instead of redirecting to /login.
        { redirectOnInvalid: false },
      );
      if (!response.ok) {
        setError(await readMessage(response, c.failed));
        setBusy(false);
        return;
      }
      clearLocalAuthState();
      window.location.replace(`${LEGAL_ROUTES.accountDeletion}?done=1`);
    } catch (err) {
      setError(err instanceof TypeError ? c.network : parseApiError(err));
      setBusy(false);
    }
  }

  return (
    <Card id={ACCOUNT_DELETE_ANCHOR} className="scroll-mt-24 border border-destructive/30 shadow-card lg:col-span-2">
      <CardHeader>
        <p className="text-xs font-semibold uppercase tracking-wider text-destructive">{c.zone}</p>
        <CardTitle className="flex items-center gap-2 text-destructive">
          <Trash2 className="h-5 w-5" />
          {c.title}
        </CardTitle>
        <CardDescription>{c.desc}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Link href={LEGAL_ROUTES.accountDeletion} className="text-sm text-muted-foreground underline-offset-4 hover:underline">
          {c.more}
        </Link>
        <Button variant="destructive" onClick={() => onOpenChange(true)}>
          <Trash2 className="me-2 h-4 w-4" />
          {c.open}
        </Button>
      </CardContent>

      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              {c.dialogTitle}
            </DialogTitle>
            <DialogDescription>{c.dialogDesc}</DialogDescription>
          </DialogHeader>

          <div className="space-y-3 text-sm">
            <div>
              <p className="font-medium">{c.deletedTitle}</p>
              <ul className="mt-1 list-disc space-y-0.5 ps-5 text-muted-foreground">
                {c.deleted.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
            <div>
              <p className="font-medium">{c.retainedTitle}</p>
              <p className="mt-1 text-muted-foreground">{c.retained}</p>
            </div>
          </div>

          <form className="space-y-4" onSubmit={(e) => void submit(e)}>
            <div className="space-y-2">
              <Label htmlFor="delete-password">{c.password}</Label>
              <Input
                id="delete-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={busy}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="delete-confirm">{c.confirmLabel}</Label>
              <Input
                id="delete-confirm"
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                placeholder="DELETE"
                required
                disabled={busy}
                dir="ltr"
              />
            </div>

            {error && <AlertBanner message={error} onDismiss={() => setError(null)} />}

            <DialogFooter className="gap-2 sm:gap-0">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
                {c.cancel}
              </Button>
              <Button type="submit" variant="destructive" disabled={busy || !password || !confirmOk}>
                {busy ? (
                  <>
                    <Loader2 className="me-2 h-4 w-4 animate-spin" />
                    {c.deleting}
                  </>
                ) : (
                  c.submit
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
