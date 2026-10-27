'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { CheckCircle2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { COMPANY_LEGAL } from '@/lib/company-info';
import { getAccessToken } from '@/lib/utils';

export const ACCOUNT_DELETE_ANCHOR = 'delete-account';

/**
 * Interactive block for /account-deletion:
 * - `?done=1` → success message after the account was deleted.
 * - logged in (access token in localStorage) → button to the delete section in account settings.
 * - otherwise → "log in to delete" + email fallback.
 */
export function AccountDeletionActions() {
  const [state, setState] = useState<'loading' | 'done' | 'loggedIn' | 'guest'>('loading');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('done') === '1') {
      setState('done');
      return;
    }
    setState(getAccessToken() ? 'loggedIn' : 'guest');
  }, []);

  const email = COMPANY_LEGAL.privacyEmail;
  const settingsHref = `/account#${ACCOUNT_DELETE_ANCHOR}`;

  if (state === 'loading') {
    return <div className="h-32 animate-pulse rounded-2xl border border-slate-200 bg-white/60" aria-hidden />;
  }

  if (state === 'done') {
    return (
      <div role="status" className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center shadow-soft sm:p-8">
        <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600" />
        <p className="mt-3 text-lg font-bold text-emerald-900" lang="ar" dir="rtl">
          تم حذف حسابك بنجاح.
        </p>
        <p className="mt-1 text-sm text-emerald-800" lang="ar" dir="rtl">
          حُذفت بيانات حسابك ومساحة العمل، وستُزال من النسخ الاحتياطية خلال 30 يوماً.
        </p>
        <p className="mt-3 font-semibold text-emerald-900" lang="en" dir="ltr">
          Your account has been deleted.
        </p>
        <p className="mt-1 text-sm text-emerald-800" lang="en" dir="ltr">
          Your account and workspace data were deleted and will be removed from backups within 30 days.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-rose-200 bg-rose-50/70 p-6 text-center shadow-soft sm:p-8">
      <Trash2 className="mx-auto h-9 w-9 text-rose-600" />
      {state === 'loggedIn' ? (
        <>
          <p className="mt-3 font-semibold text-slate-900" lang="ar" dir="rtl">
            أنت مسجّل الدخول. يمكنك حذف حسابك الآن من الإعدادات.
          </p>
          <p className="mt-1 text-sm text-slate-600" lang="en" dir="ltr">
            You are signed in. You can delete your account now from settings.
          </p>
          <Button asChild variant="destructive" className="mt-5">
            <Link href={settingsHref}>حذف الحساب · Delete account</Link>
          </Button>
        </>
      ) : (
        <>
          <p className="mt-3 font-semibold text-slate-900" lang="ar" dir="rtl">
            سجّل الدخول لحذف حسابك.
          </p>
          <p className="mt-1 text-sm text-slate-600" lang="en" dir="ltr">
            Log in to delete your account.
          </p>
          <Button asChild className="mt-5">
            <Link href="/login">تسجيل الدخول · Log in</Link>
          </Button>
          <p className="mt-5 text-sm text-slate-600" lang="ar" dir="rtl">
            أو راسلنا على{' '}
            <a href={`mailto:${email}?subject=${encodeURIComponent('Account deletion request')}`} dir="ltr" className="font-medium text-violet-700 hover:underline">
              {email}
            </a>{' '}
            من البريد الإلكتروني المسجّل في حسابك.
          </p>
          <p className="mt-1 text-sm text-slate-600" lang="en" dir="ltr">
            Or email{' '}
            <a href={`mailto:${email}?subject=${encodeURIComponent('Account deletion request')}`} className="font-medium text-violet-700 hover:underline">
              {email}
            </a>{' '}
            from your account email.
          </p>
        </>
      )}
    </div>
  );
}
