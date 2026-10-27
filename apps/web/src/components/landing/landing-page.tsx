'use client';

import { useEffect } from 'react';
import { useLocale } from '@/components/providers/locale-provider';
import { useIsMobileApp } from '@/lib/use-is-mobile-app';
import { LandingHero } from './landing-hero';
import { LandingNavbar } from './landing-navbar';
import {
  LandingContact,
  LandingFaq,
  LandingFeatures,
  LandingFooter,
  LandingHowItWorks,
  LandingPricing,
  LandingProblems,
  LandingStats,
  LandingTestimonials,
  LandingTikTok,
  LandingTrial,
  LandingVideo,
} from './landing-sections';
import { LandingContentProvider } from './landing-content-provider';
import { LandingShell } from './landing-ui';
import { useLandingCopy, useLandingVisibility } from './use-landing-copy';

function LandingJsonLd() {
  const copy = useLandingCopy();
  const { locale } = useLocale();
  const isMobileApp = useIsMobileApp();

  useEffect(() => {
    const id = 'chatloora-landing-jsonld';
    const existing = document.getElementById(id);
    if (existing) existing.remove();

    const data = {
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: 'ChatLoora',
      applicationCategory: 'BusinessApplication',
      operatingSystem: 'Web',
      description: copy.seo.description,
      ...(isMobileApp
        ? {}
        : {
            offers: {
              '@type': 'AggregateOffer',
              lowPrice: '15',
              highPrice: '49',
              priceCurrency: 'USD',
              offerCount: 3,
            },
          }),
      inLanguage: locale === 'ar' ? 'ar' : 'en',
    };

    const script = document.createElement('script');
    script.id = id;
    script.type = 'application/ld+json';
    script.text = JSON.stringify(data);
    document.head.appendChild(script);
    return () => {
      document.getElementById(id)?.remove();
    };
  }, [copy.seo.description, locale, isMobileApp]);

  useEffect(() => {
    document.title = copy.seo.title;
    const desc = document.querySelector('meta[name="description"]');
    if (desc) desc.setAttribute('content', copy.seo.description);
    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) ogTitle.setAttribute('content', copy.seo.title);
    const ogDesc = document.querySelector('meta[property="og:description"]');
    if (ogDesc) ogDesc.setAttribute('content', copy.seo.description);
  }, [copy.seo.description, copy.seo.title]);

  return null;
}

function LandingPageInner() {
  const visibility = useLandingVisibility();
  // Native app (App Store / Google Play): no prices, plans, trials or subscribe CTAs.
  const isMobileApp = useIsMobileApp();

  return (
    <LandingShell>
      <LandingJsonLd />
      <LandingNavbar />
      <main>
        <LandingHero />
        {visibility.problems ? <LandingProblems /> : null}
        {visibility.features ? <LandingFeatures /> : null}
        {visibility.tiktok ? <LandingTikTok /> : null}
        {visibility.how ? <LandingHowItWorks /> : null}
        {visibility.video ? <LandingVideo /> : null}
        {visibility.testimonials ? <LandingTestimonials /> : null}
        {visibility.stats ? <LandingStats /> : null}
        {visibility.trial && !isMobileApp ? <LandingTrial /> : null}
        {visibility.pricing && !isMobileApp ? <LandingPricing /> : null}
        {visibility.faq && !isMobileApp ? <LandingFaq /> : null}
        {visibility.contact ? <LandingContact /> : null}
      </main>
      <LandingFooter />
    </LandingShell>
  );
}

export function LandingPage() {
  return (
    <LandingContentProvider>
      <LandingPageInner />
    </LandingContentProvider>
  );
}
