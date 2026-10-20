import type { Metadata } from 'next';
import { FlashLanding, type LandingPayload } from '@/components/store/flash-landing';
import { MetaPixelTag } from '@/components/store/meta-pixel-tag';

export const dynamic = 'force-dynamic';

const TITLE = 'فلاشة ذهبية – 12 دورة احترافية | 35,000 دينار';
const DESC =
  'فلاشة 32 GB تضم 12 دورة احترافية في التسويق الرقمي والمحتوى والفيديو والذكاء الاصطناعي. السعر الحالي 35,000 د.ع بدل 100,000 د.ع، والتوصيل مجاني.';

async function loadLanding(): Promise<LandingPayload | null> {
  const base = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
  try {
    const res = await fetch(`${base}/api/v1/store/public/landing/flash-12-courses`, { cache: 'no-store' });
    if (!res.ok) return null;
    return (await res.json()) as LandingPayload;
  } catch {
    return null;
  }
}

export async function generateMetadata(): Promise<Metadata> {
  const data = await loadLanding();
  const image = data?.product.media[0]?.url || '/store/flash-12-courses/hero-dark.jpg';
  const price = data?.product.price ?? 35000;
  return {
    title: TITLE,
    description: DESC,
    alternates: { canonical: '/store/flash-12-courses' },
    openGraph: {
      title: TITLE,
      description: DESC,
      locale: 'ar_IQ',
      type: 'website',
      images: [{ url: image, width: 1080, height: 1350, alt: 'فلاشة ذهبية – 12 دورة احترافية' }],
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

export default async function FlashLandingPage() {
  const data = await loadLanding();
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: data?.product.name || 'فلاشة ذهبية – 12 دورة احترافية',
    description: DESC,
    image: data?.product.media.map((m) => m.url) || ['/store/flash-12-courses/hero-dark.jpg'],
    offers: {
      '@type': 'Offer',
      priceCurrency: 'IQD',
      price: String(data?.product.price ?? 35000),
      availability: data?.product.inStock === false ? 'https://schema.org/OutOfStock' : 'https://schema.org/InStock',
    },
  };
  return (
    <>
      <MetaPixelTag pixelId={data?.metaPixelId} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <FlashLanding initial={data} />
    </>
  );
}
