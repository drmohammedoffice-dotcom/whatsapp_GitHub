'use client';

import Link from 'next/link';
import { useTranslation } from '@/components/providers/locale-provider';
import { LEGAL_ROUTES } from '@/lib/company-info';
import { cn } from '@/lib/utils';

/** Small "By continuing you agree to the Terms and Privacy Policy" note under auth forms. */
export function LegalConsentNote({ className }: { className?: string }) {
  const { locale } = useTranslation();
  const linkClass = 'font-medium text-primary underline-offset-4 hover:underline';

  return (
    <p className={cn('mt-4 text-center text-xs leading-5 text-muted-foreground', className)}>
      {locale === 'ar' ? (
        <>
          بالمتابعة توافق على{' '}
          <Link href={LEGAL_ROUTES.terms} className={linkClass}>
            الشروط
          </Link>{' '}
          و
          <Link href={LEGAL_ROUTES.privacy} className={linkClass}>
            سياسة الخصوصية
          </Link>
          .
        </>
      ) : (
        <>
          By continuing you agree to the{' '}
          <Link href={LEGAL_ROUTES.terms} className={linkClass}>
            Terms of Service
          </Link>{' '}
          and{' '}
          <Link href={LEGAL_ROUTES.privacy} className={linkClass}>
            Privacy Policy
          </Link>
          .
        </>
      )}
    </p>
  );
}
