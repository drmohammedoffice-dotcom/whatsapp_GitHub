import Link from 'next/link';
import type { ReactNode } from 'react';
import { LandingFooter } from '@/components/landing/landing-sections';
import { LandingNavbar } from '@/components/landing/landing-navbar';
import { LandingShell } from '@/components/landing/landing-ui';
import { COMPANY_LEGAL, LEGAL_ROUTES } from '@/lib/company-info';

/**
 * Shared layout for public legal pages (/privacy, /terms, /account-deletion).
 * Arabic first (RTL) followed by the English version (LTR) on the same page,
 * with jump links acting as a simple AR / EN toggle. Fully static (no auth).
 */
export function LegalLayout({
  titleAr,
  titleEn,
  lastUpdated,
  arabic,
  english,
  top,
}: {
  titleAr: string;
  titleEn: string;
  lastUpdated?: string;
  arabic: ReactNode;
  english: ReactNode;
  /** Optional block rendered above both language versions (e.g. interactive actions). */
  top?: ReactNode;
}) {
  return (
    <LandingShell>
      <LandingNavbar />
      <main className="px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
        <div className="mx-auto max-w-3xl">
          <div className="text-center">
            <p className="text-xs font-semibold tracking-[0.18em] text-violet-600 uppercase">
              {COMPANY_LEGAL.tradeName} · Legal
            </p>
            <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl" lang="ar" dir="rtl">
              {titleAr}
            </h1>
            <p className="mt-2 text-lg font-semibold text-slate-700" lang="en" dir="ltr">
              {titleEn}
            </p>
            {lastUpdated ? (
              <p className="mt-3 text-sm text-slate-500">
                <span lang="ar" dir="rtl">آخر تحديث: {lastUpdated}</span>
                <span className="mx-2 text-slate-300">|</span>
                <span lang="en" dir="ltr">Last updated: {lastUpdated}</span>
              </p>
            ) : null}
            <nav aria-label="Language" className="mt-6 inline-flex rounded-full border border-slate-200 bg-white/80 p-1 text-sm shadow-soft">
              <a href="#ar" className="rounded-full px-4 py-1.5 font-medium text-slate-700 hover:bg-violet-50 hover:text-violet-700">
                العربية
              </a>
              <a href="#en" className="rounded-full px-4 py-1.5 font-medium text-slate-700 hover:bg-violet-50 hover:text-violet-700">
                English
              </a>
            </nav>
          </div>

          {top ? <div className="mt-10">{top}</div> : null}

          <article
            id="ar"
            lang="ar"
            dir="rtl"
            className="mt-10 scroll-mt-24 rounded-2xl border border-slate-200 bg-white/85 p-6 text-start shadow-soft backdrop-blur sm:p-10"
          >
            {arabic}
          </article>

          <article
            id="en"
            lang="en"
            dir="ltr"
            className="mt-8 scroll-mt-24 rounded-2xl border border-slate-200 bg-white/85 p-6 text-left shadow-soft backdrop-blur sm:p-10"
          >
            {english}
          </article>

          <LegalLinks />
        </div>
      </main>
      <LandingFooter />
    </LandingShell>
  );
}

export function LegalLinks() {
  return (
    <p className="mt-10 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-sm text-slate-500">
      <Link href={LEGAL_ROUTES.privacy} className="font-medium text-violet-700 hover:underline">
        سياسة الخصوصية · Privacy Policy
      </Link>
      <Link href={LEGAL_ROUTES.terms} className="font-medium text-violet-700 hover:underline">
        الشروط · Terms
      </Link>
      <Link href={LEGAL_ROUTES.accountDeletion} className="font-medium text-violet-700 hover:underline">
        حذف الحساب · Account deletion
      </Link>
      <Link href="/company" className="font-medium text-violet-700 hover:underline">
        معلومات الشركة · Company
      </Link>
    </p>
  );
}

export function LegalH2({ children }: { children: ReactNode }) {
  return <h2 className="mt-8 text-xl font-bold text-slate-900 first:mt-0">{children}</h2>;
}

export function LegalH3({ children }: { children: ReactNode }) {
  return <h3 className="mt-5 text-base font-semibold text-slate-900">{children}</h3>;
}

export function LegalP({ children }: { children: ReactNode }) {
  return <p className="mt-3 text-[15px] leading-7 text-slate-700">{children}</p>;
}

export function LegalList({ children }: { children: ReactNode }) {
  return <ul className="mt-3 list-disc space-y-2 ps-6 text-[15px] leading-7 text-slate-700 marker:text-violet-400">{children}</ul>;
}

export function LegalMail({ email }: { email: string }) {
  return (
    <a href={`mailto:${email}`} dir="ltr" className="font-medium text-violet-700 hover:underline">
      {email}
    </a>
  );
}
