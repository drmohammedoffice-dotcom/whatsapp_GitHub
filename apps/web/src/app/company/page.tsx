import type { Metadata } from 'next';
import Link from 'next/link';
import { LandingFooter } from '@/components/landing/landing-sections';
import { LandingNavbar } from '@/components/landing/landing-navbar';
import { LandingShell } from '@/components/landing/landing-ui';
import { COMPANY_LEGAL, companyFullAddress, companyJsonLd } from '@/lib/company-info';

const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.chatloora.com';

export const metadata: Metadata = {
  title: 'Company Information — Mey Architects, PC',
  description:
    'Legal business information for Mey Architects, PC, operator of the ChatLoora customer conversations platform.',
  robots: { index: true, follow: true },
  openGraph: {
    title: 'Mey Architects, PC — Company Information',
    description: 'Official legal business details for Meta and partner verification.',
    url: `${baseUrl}/company`,
    type: 'website',
  },
};

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-b border-slate-200 py-4 last:border-b-0 sm:grid sm:grid-cols-3 sm:gap-6">
      <dt className="text-sm font-semibold text-slate-900">{label}</dt>
      <dd className="mt-1 text-sm text-slate-700 sm:col-span-2 sm:mt-0">{value}</dd>
    </div>
  );
}

export default function CompanyPage() {
  const jsonLd = companyJsonLd(baseUrl);

  return (
    <LandingShell>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <LandingNavbar />
      <main className="px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl">
          <p className="text-xs font-semibold tracking-[0.18em] text-violet-600 uppercase">Legal</p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            {COMPANY_LEGAL.legalName}
          </h1>
          <p className="mt-4 text-base text-slate-600 sm:text-lg">
            This page lists the official legal business information for{' '}
            <strong className="font-semibold text-slate-900">{COMPANY_LEGAL.legalName}</strong>, the company
            that operates the <strong className="font-semibold text-slate-900">{COMPANY_LEGAL.tradeName}</strong>{' '}
            platform. The details below are published for Meta and other partner verification.
          </p>

          <section className="mt-10 rounded-2xl border border-slate-200 bg-white/80 p-6 shadow-soft backdrop-blur sm:p-8">
            <h2 className="text-lg font-bold text-slate-900">Business details</h2>
            <dl className="mt-4">
              <InfoRow label="Legal business name" value={COMPANY_LEGAL.legalName} />
              <InfoRow label="Trade / product name" value={COMPANY_LEGAL.tradeName} />
              <InfoRow label="Entity type" value={COMPANY_LEGAL.entityType} />
              <InfoRow label="Employer Identification Number (EIN)" value={COMPANY_LEGAL.ein} />
              <InfoRow label="Date of incorporation" value={COMPANY_LEGAL.dateOfIncorporationDisplay} />
              <InfoRow label="Registered business address" value={companyFullAddress()} />
              <InfoRow label="Designated officer title" value={COMPANY_LEGAL.officerTitle} />
            </dl>
          </section>

          <section className="mt-8 rounded-2xl border border-violet-100 bg-violet-50/60 p-6 sm:p-8">
            <h2 className="text-lg font-bold text-slate-900">Platform operator</h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-700">
              {COMPANY_LEGAL.tradeName} is a software platform for customer conversations, AI replies, and
              advertising integrations. The website and services at{' '}
              <a href={baseUrl} className="font-medium text-violet-700 hover:underline">
                {baseUrl.replace(/^https?:\/\//, '')}
              </a>{' '}
              are operated by <strong>{COMPANY_LEGAL.legalName}</strong>.
            </p>
          </section>

          <p className="mt-8 text-sm text-slate-500">
            <Link href="/" className="font-medium text-violet-700 hover:underline">
              ← Back to home
            </Link>
          </p>
        </div>
      </main>
      <LandingFooter />
    </LandingShell>
  );
}
