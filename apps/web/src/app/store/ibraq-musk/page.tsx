import type { Metadata } from 'next';
import { Amiri, Cairo } from 'next/font/google';
import { IbraqMuskLanding, type IbraqLandingPayload } from '@/components/store/ibraq-musk-landing';

export const dynamic = 'force-dynamic';

const display = Amiri({
  subsets: ['arabic', 'latin'],
  weight: ['400', '700'],
  variable: '--font-ibraq-display',
  display: 'swap',
});

const body = Cairo({
  subsets: ['arabic', 'latin'],
  weight: ['400', '600', '700'],
  variable: '--font-ibraq-body',
  display: 'swap',
});

const TITLE = 'مسكات إبراق الأصلية | 12 رائحة في بوكس واحد';
const DESC =
  'اكتشف مجموعة مسكات إبراق الأصلية، 12 رائحة متنوعة بحجم 20 مل لكل عطر. بكج واحد بـ70 ألف وبكجين بـ120 ألف مع توصيل مجاني.';

async function loadLanding(): Promise<IbraqLandingPayload | null> {
  const base = process.env.API_INTERNAL_URL || process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:4000';
  try {
    const res = await fetch(`${base}/api/v1/store/public/landing/ibraq-musk`, { cache: 'no-store' });
    if (!res.ok) return null;
    return (await res.json()) as IbraqLandingPayload;
  } catch {
    return null;
  }
}

export async function generateMetadata(): Promise<Metadata> {
  const data = await loadLanding();
  const image = data?.product.media[0]?.url || '/store/ibraq-musk/hero.svg';
  const price = data?.product.price ?? 70000;
  return {
    title: TITLE,
    description: DESC,
    alternates: { canonical: '/store/ibraq-musk' },
    openGraph: {
      title: TITLE,
      description: DESC,
      locale: 'ar_IQ',
      type: 'website',
      images: [{ url: image, width: 1080, height: 1350, alt: 'مجموعة المسك من إبراق' }],
    },
    twitter: {
      card: 'summary_large_image',
      title: TITLE,
      description: DESC,
      images: [image],
    },
    other: {
      'product:price:amount': String(price),
      'product:price:currency': 'IQD',
    },
  };
}

export default async function IbraqMuskPage() {
  const data = await loadLanding();
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: data?.product.name || 'مجموعة المسك من إبراق',
    brand: { '@type': 'Brand', name: 'IBRAQ' },
    description: DESC,
    sku: '6287020285073',
    image: data?.product.media.map((m) => m.url) || ['/store/ibraq-musk/hero.svg'],
    offers: {
      '@type': 'AggregateOffer',
      priceCurrency: 'IQD',
      lowPrice: '70000',
      highPrice: '120000',
      availability:
        data?.product.inStock === false ? 'https://schema.org/OutOfStock' : 'https://schema.org/InStock',
    },
  };

  return (
    <div className={`${display.variable} ${body.variable}`}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <IbraqMuskLanding initial={data} />
    </div>
  );
}
