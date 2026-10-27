'use client';

import { useInView, useMotionValue, useSpring } from 'framer-motion';
import {
  Check,
  Sparkles,
  X,
  ArrowRight,
  Mail,
  Megaphone,
  Phone,
  ShieldCheck,
  Smartphone,
  Target,
  Wallet,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef } from 'react';
import { useLocale } from '@/components/providers/locale-provider';
import { Button } from '@/components/ui/button';
import { WHATSAPP_SALES_NUMBER } from '@/lib/billing';
import { COMPANY_LEGAL, LEGAL_ROUTES } from '@/lib/company-info';
import { useIsMobileApp } from '@/lib/use-is-mobile-app';
import { cn } from '@/lib/utils';
import { LandingReveal, LandingSectionHeader } from './landing-ui';
import { useLandingCopy } from './use-landing-copy';

const featureIcons = [Phone, Target, Megaphone, Wallet, Smartphone, ShieldCheck];

function AnimatedCounter({ value, suffix }: { value: number; suffix: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: '-40px' });
  const motionValue = useMotionValue(0);
  const spring = useSpring(motionValue, { stiffness: 60, damping: 20 });

  useEffect(() => {
    if (inView) motionValue.set(value);
  }, [inView, motionValue, value]);

  useEffect(() => {
    const unsub = spring.on('change', (latest) => {
      if (!ref.current) return;
      const decimals = Number.isInteger(value) ? 0 : 1;
      ref.current.textContent = `${latest.toFixed(decimals)}${suffix}`;
    });
    return () => unsub();
  }, [spring, suffix, value]);

  return <span ref={ref}>0{suffix}</span>;
}

export function LandingProblems() {
  const copy = useLandingCopy();
  return (
    <section className="px-4 py-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <LandingSectionHeader eyebrow={copy.problems.eyebrow} title={copy.problems.title} subtitle={copy.problems.subtitle} />
        <div className="mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {copy.problems.items.map((item, i) => (
            <LandingReveal key={item} delay={i * 0.05}>
              <div className="flex items-center gap-3 rounded-2xl border border-rose-100 bg-rose-50/80 px-4 py-3.5 text-sm font-medium text-rose-800">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-rose-500/15 text-rose-600">
                  <X className="h-4 w-4" />
                </span>
                {item}
              </div>
            </LandingReveal>
          ))}
        </div>
        <LandingReveal className="mt-10 overflow-hidden rounded-[1.75rem] border border-violet-200/70 bg-gradient-to-br from-violet-600 via-indigo-600 to-sky-500 p-8 text-white shadow-xl shadow-violet-500/25 sm:p-10">
          <h3 className="text-2xl font-bold sm:text-3xl">{copy.problems.solutionTitle}</h3>
          <p className="mt-3 max-w-2xl text-violet-50 sm:text-lg">{copy.problems.solutionSubtitle}</p>
        </LandingReveal>
      </div>
    </section>
  );
}

export function LandingFeatures() {
  const copy = useLandingCopy();
  return (
    <section id="features" className="px-4 py-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <LandingSectionHeader eyebrow={copy.features.eyebrow} title={copy.features.title} subtitle={copy.features.subtitle} />
        <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {copy.features.items.map((item, i) => {
            const Icon = featureIcons[i] ?? Sparkles;
            return (
              <LandingReveal key={item.title} delay={i * 0.06}>
                <div className="group relative h-full overflow-hidden rounded-[1.5rem] border border-white/80 bg-white/85 p-7 shadow-card backdrop-blur transition hover:-translate-y-1 hover:shadow-xl">
                  <div className="absolute -end-8 -top-8 h-28 w-28 rounded-full bg-violet-400/10 blur-2xl transition group-hover:bg-violet-400/20" />
                  <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 text-white shadow-lg shadow-violet-500/30">
                    <Icon className="h-6 w-6" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900">{item.title}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-slate-600 sm:text-base">{item.desc}</p>
                </div>
              </LandingReveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export function LandingTikTok() {
  const copy = useLandingCopy();
  const { dir } = useLocale();
  return (
    <section id="solutions" className="px-4 py-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl overflow-hidden rounded-[2rem] border border-slate-900/10 bg-slate-950 px-6 py-12 text-white shadow-2xl sm:px-10 sm:py-16">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div>
            <LandingSectionHeader
              align="start"
              className="!mx-0 max-w-xl !text-start [&_h2]:text-white [&_p]:text-slate-300 [&_p:first-child]:text-fuchsia-300"
              eyebrow={copy.tiktok.eyebrow}
              title={copy.tiktok.title}
              subtitle={copy.tiktok.subtitle}
            />
            <ul className="mt-8 space-y-3">
              {copy.tiktok.bullets.map((b) => (
                <li key={b} className="flex items-start gap-3 text-sm text-slate-200">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-fuchsia-400" />
                  {b}
                </li>
              ))}
            </ul>
            <Link href="/register" className="mt-8 inline-block">
              <Button className="rounded-full bg-white text-slate-900 hover:bg-slate-100">
                {copy.tiktok.cta}
                <ArrowRight className={cn('h-4 w-4', dir === 'rtl' && 'rotate-180')} />
              </Button>
            </Link>
          </div>
          <div className="space-y-4">
            <figure className="overflow-hidden rounded-2xl border border-white/15 bg-white shadow-2xl">
              <img
                src="/tiktok-placements-locked.png"
                alt={copy.tiktok.shotAlt}
                className="h-auto w-full"
              />
              <figcaption className="bg-slate-950 px-4 py-3 text-sm leading-6 text-slate-200">
                {copy.tiktok.shotCaption}
              </figcaption>
            </figure>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-rose-400/40 bg-rose-500/15 p-4">
                <p className="text-sm font-semibold text-rose-100">{copy.tiktok.shotProblemTitle}</p>
                <p className="mt-2 text-sm leading-6 text-rose-50/90">{copy.tiktok.shotProblem}</p>
              </div>
              <div className="rounded-2xl border border-emerald-400/40 bg-emerald-500/15 p-4">
                <p className="text-sm font-semibold text-emerald-100">{copy.tiktok.shotSolutionTitle}</p>
                <p className="mt-2 text-sm leading-6 text-emerald-50/90">{copy.tiktok.shotSolution}</p>
              </div>
            </div>
          </div>
        </div>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {copy.tiktok.steps.map((step, i) => (
            <LandingReveal key={step.title} delay={i * 0.08}>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur">
                <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-full bg-fuchsia-500/20 text-sm font-bold text-fuchsia-300">
                  {i + 1}
                </div>
                <h4 className="font-semibold">{step.title}</h4>
                <p className="mt-1.5 text-sm text-slate-400">{step.desc}</p>
              </div>
            </LandingReveal>
          ))}
        </div>
      </div>
    </section>
  );
}

export function LandingHowItWorks() {
  const copy = useLandingCopy();
  return (
    <section id="how-it-works" className="px-4 py-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <LandingSectionHeader eyebrow={copy.how.eyebrow} title={copy.how.title} subtitle={copy.how.subtitle} />
        <div className="relative mt-14 space-y-4">
          <div className="absolute start-6 top-0 bottom-0 hidden w-px bg-gradient-to-b from-violet-400 via-indigo-300 to-transparent md:block" />
          {copy.how.steps.map((step, i) => (
            <LandingReveal key={step.title} delay={i * 0.04}>
              <div className="relative flex gap-4 rounded-2xl border border-white/80 bg-white/85 p-5 shadow-soft md:ps-16">
                <div className="absolute start-3 top-5 hidden h-7 w-7 items-center justify-center rounded-full bg-violet-600 text-xs font-bold text-white md:flex">
                  {i + 1}
                </div>
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-violet-100 text-sm font-bold text-violet-700 md:hidden">
                  {i + 1}
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900">{step.title}</h3>
                  <p className="mt-1 text-sm text-slate-600">{step.desc}</p>
                </div>
              </div>
            </LandingReveal>
          ))}
        </div>
      </div>
    </section>
  );
}

export function LandingVideo() {
  const copy = useLandingCopy();
  return (
    <section id="video" className="px-4 py-16 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <LandingSectionHeader eyebrow={copy.video.eyebrow} title={copy.video.title} subtitle={copy.video.subtitle} />
        <LandingReveal className="relative mt-10 overflow-hidden rounded-[1.75rem] border border-white/80 bg-slate-950 shadow-2xl ring-1 ring-violet-500/20">
          <div className="aspect-video w-full overflow-hidden bg-black">
            <iframe
              title={copy.video.title}
              src="https://www.youtube-nocookie.com/embed/Kxtc-8vPFNk?rel=0&modestbranding=1"
              className="h-full w-full border-0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              loading="lazy"
              referrerPolicy="strict-origin-when-cross-origin"
            />
          </div>
        </LandingReveal>
      </div>
    </section>
  );
}

export function LandingTestimonials() {
  const copy = useLandingCopy();
  return (
    <section id="testimonials" className="px-4 py-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <LandingSectionHeader
          eyebrow={copy.testimonials.eyebrow}
          title={copy.testimonials.title}
          subtitle={copy.testimonials.subtitle}
        />
        <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {copy.testimonials.items.map((item, i) => (
            <LandingReveal key={item.name} delay={i * 0.05}>
              <article className="flex h-full flex-col rounded-[1.5rem] border border-white/80 bg-white/90 p-6 shadow-card">
                <div className="mb-4 flex items-center gap-1 text-amber-400">
                  {Array.from({ length: 5 }).map((_, s) => (
                    <span key={s}>★</span>
                  ))}
                </div>
                <p className="flex-1 text-sm leading-relaxed text-slate-700">“{item.quote}”</p>
                <div className="mt-6 flex items-center gap-3 border-t border-slate-100 pt-4">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-indigo-500 text-sm font-bold text-white">
                    {item.name.slice(0, 1)}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{item.name}</p>
                    <p className="text-xs text-slate-500">
                      {item.role} · {item.company}
                    </p>
                    <p className="text-[11px] font-medium text-violet-600">{item.industry}</p>
                  </div>
                </div>
              </article>
            </LandingReveal>
          ))}
        </div>
      </div>
    </section>
  );
}

export function LandingStats() {
  const copy = useLandingCopy();
  return (
    <section className="px-4 py-16 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl rounded-[2rem] bg-gradient-to-br from-violet-600 via-indigo-600 to-sky-500 p-8 text-white shadow-xl shadow-violet-500/30 sm:p-12">
        <LandingSectionHeader
          className="[&_h2]:text-white [&_p:first-child]:text-violet-100"
          eyebrow={copy.stats.eyebrow}
          title={copy.stats.title}
        />
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {copy.stats.items.map((item) => (
            <div key={item.label} className="rounded-2xl bg-white/10 p-6 text-center backdrop-blur">
              <p className="text-3xl font-bold sm:text-4xl">
                <AnimatedCounter value={item.value} suffix={item.suffix} />
              </p>
              <p className="mt-2 text-sm text-violet-100">{item.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function LandingTrial() {
  const copy = useLandingCopy();
  const { dir } = useLocale();
  return (
    <section className="px-4 py-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl overflow-hidden rounded-[2rem] border border-violet-200 bg-white p-8 text-center shadow-card sm:p-12">
        <LandingSectionHeader eyebrow={copy.trial.eyebrow} title={copy.trial.title} subtitle={copy.trial.subtitle} />
        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          {copy.trial.steps.map((step, i) => (
            <div key={step} className="flex items-center gap-3">
              <div className="rounded-full bg-violet-50 px-4 py-2 text-sm font-semibold text-violet-700">{step}</div>
              {i < copy.trial.steps.length - 1 ? (
                <ArrowRight className={cn('hidden h-4 w-4 text-slate-300 sm:block', dir === 'rtl' && 'rotate-180')} />
              ) : null}
            </div>
          ))}
        </div>
        <Link href="/register" className="mt-10 inline-block">
          <Button size="lg" className="h-12 rounded-full bg-gradient-to-r from-violet-600 to-indigo-600 px-8 shadow-lg shadow-violet-500/30">
            {copy.trial.cta}
          </Button>
        </Link>
      </div>
    </section>
  );
}

export function LandingPricing() {
  const copy = useLandingCopy();
  return (
    <section id="pricing" className="px-4 py-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <LandingSectionHeader eyebrow={copy.pricing.eyebrow} title={copy.pricing.title} subtitle={copy.pricing.subtitle} />
        <div className="mt-12 grid items-stretch gap-6 lg:grid-cols-3">
          {copy.pricing.plans.map((plan, i) => {
            const popular = i === 1;
            return (
              <LandingReveal key={plan.name} delay={i * 0.08}>
                <div
                  className={cn(
                    'relative flex h-full flex-col rounded-[1.75rem] border p-7 shadow-card',
                    popular
                      ? 'border-violet-300 bg-gradient-to-b from-violet-600 to-indigo-700 text-white shadow-xl shadow-violet-500/30 lg:-translate-y-3'
                      : 'border-white/80 bg-white/90',
                  )}
                >
                  {popular ? (
                    <span className="absolute inset-x-0 -top-3 mx-auto w-fit rounded-full bg-amber-300 px-3 py-1 text-[11px] font-bold text-slate-900">
                      {copy.pricing.popular}
                    </span>
                  ) : null}
                  <h3 className={cn('text-lg font-semibold', popular ? 'text-white' : 'text-slate-900')}>{plan.name}</h3>
                  <div className="mt-4 flex items-end gap-1">
                    <span className="text-4xl font-bold">{plan.price}</span>
                    <span className={cn('pb-1 text-sm', popular ? 'text-violet-100' : 'text-slate-500')}>
                      {copy.pricing.perMonth}
                    </span>
                  </div>
                  <ul className="mt-6 flex-1 space-y-3">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-sm">
                        <Check className={cn('mt-0.5 h-4 w-4 shrink-0', popular ? 'text-emerald-300' : 'text-emerald-500')} />
                        <span className={popular ? 'text-violet-50' : 'text-slate-600'}>{f}</span>
                      </li>
                    ))}
                  </ul>
                  <Link href="/register" className="mt-8 block">
                    <Button
                      className={cn(
                        'w-full rounded-full',
                        popular ? 'bg-white text-violet-700 hover:bg-violet-50' : 'bg-violet-600 text-white hover:bg-violet-500',
                      )}
                    >
                      {copy.pricing.cta}
                    </Button>
                  </Link>
                </div>
              </LandingReveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export function LandingFaq() {
  const copy = useLandingCopy();
  return (
    <section id="faq" className="px-4 py-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl">
        <LandingSectionHeader eyebrow={copy.faq.eyebrow} title={copy.faq.title} subtitle={copy.faq.subtitle} />
        <div className="mt-10 space-y-3">
          {copy.faq.items.map((item, i) => (
            <LandingReveal key={item.q} delay={i * 0.02}>
              <details className="group rounded-2xl border border-white/80 bg-white/90 p-5 shadow-soft open:shadow-card">
                <summary className="cursor-pointer list-none font-semibold text-slate-900 marker:content-none [&::-webkit-details-marker]:hidden">
                  <span className="flex items-center justify-between gap-3">
                    {item.q}
                    <span className="text-violet-500 transition group-open:rotate-45">+</span>
                  </span>
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-slate-600">{item.a}</p>
              </details>
            </LandingReveal>
          ))}
        </div>
      </div>
    </section>
  );
}

export function LandingContact() {
  const copy = useLandingCopy();
  const waNumber = copy.contact.whatsappNumber || WHATSAPP_SALES_NUMBER;
  const supportEmail = COMPANY_LEGAL.supportEmail;
  const wa = `https://wa.me/${waNumber}`;
  return (
    <section id="contact" className="px-4 py-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <LandingSectionHeader eyebrow={copy.contact.eyebrow} title={copy.contact.title} subtitle={copy.contact.subtitle} />
        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          <a
            href={wa}
            target="_blank"
            rel="noreferrer"
            className="rounded-2xl border border-emerald-100 bg-emerald-50/80 p-6 text-center shadow-soft transition hover:-translate-y-1"
          >
            <Phone className="mx-auto mb-3 h-6 w-6 text-emerald-600" />
            <p className="font-semibold text-slate-900">{copy.contact.whatsapp}</p>
          </a>
          <a
            href={`mailto:${supportEmail}`}
            className="rounded-2xl border border-sky-100 bg-sky-50/80 p-6 text-center shadow-soft transition hover:-translate-y-1"
          >
            <Mail className="mx-auto mb-3 h-6 w-6 text-sky-600" />
            <p className="font-semibold text-slate-900">{copy.contact.email}</p>
          </a>
          <div className="rounded-2xl border border-violet-100 bg-violet-50/80 p-6 text-center shadow-soft">
            <Sparkles className="mx-auto mb-3 h-6 w-6 text-violet-600" />
            <p className="font-semibold text-slate-900">{copy.contact.social}</p>
          </div>
        </div>
      </div>
    </section>
  );
}

export function LandingFooter() {
  const copy = useLandingCopy();
  const { locale } = useLocale();
  const isMobileApp = useIsMobileApp();
  const year = new Date().getFullYear();
  const ar = locale === 'ar';
  return (
    <footer className="border-t border-slate-200/80 bg-white/70 px-4 py-14 backdrop-blur sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-7xl gap-10 md:grid-cols-4">
        <div className="md:col-span-1">
          <p className="text-lg font-bold">
            Chat<span className="bg-gradient-to-r from-violet-600 to-indigo-600 bg-clip-text text-transparent">Loora</span>
          </p>
          <p className="mt-2 text-sm font-medium text-slate-700">Mey Architects, PC</p>
          <p className="mt-2 text-sm text-slate-600">{copy.footer.tagline}</p>
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-900">{copy.footer.product}</p>
          <div className="mt-3 space-y-2 text-sm text-slate-600">
            <a href="/#features" className="block hover:text-violet-600">
              {copy.nav.features}
            </a>
            {!isMobileApp && (
              <a href="/#pricing" className="block hover:text-violet-600">
                {copy.nav.pricing}
              </a>
            )}
            <a href="/#how-it-works" className="block hover:text-violet-600">
              {copy.nav.howItWorks}
            </a>
          </div>
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-900">{copy.footer.resources}</p>
          <div className="mt-3 space-y-2 text-sm text-slate-600">
            <a href="/#faq" className="block hover:text-violet-600">
              {copy.nav.faq}
            </a>
            {!isMobileApp && (
              <Link href="/pricing" className="block hover:text-violet-600">
                {copy.nav.pricing}
              </Link>
            )}
            <Link href="/register" className="block hover:text-violet-600">
              {isMobileApp ? (ar ? 'إنشاء حساب' : 'Create account') : copy.nav.startTrial}
            </Link>
            <Link href="/login" className="block hover:text-violet-600">
              {isMobileApp ? copy.nav.login : copy.footer.signInWeb}
            </Link>
          </div>
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-900">{copy.footer.legal}</p>
          <div className="mt-3 space-y-2 text-sm text-slate-600">
            <Link href="/company" className="block hover:text-violet-600">
              {copy.footer.companyInfo}
            </Link>
            <Link href={LEGAL_ROUTES.privacy} className="block hover:text-violet-600">
              {ar ? 'سياسة الخصوصية' : 'Privacy Policy'}
            </Link>
            <Link href={LEGAL_ROUTES.terms} className="block hover:text-violet-600">
              {ar ? 'شروط الخدمة' : 'Terms of Service'}
            </Link>
            <Link href={LEGAL_ROUTES.accountDeletion} className="block hover:text-violet-600">
              {ar ? 'حذف الحساب' : 'Delete account'}
            </Link>
            <a href={`mailto:${COMPANY_LEGAL.supportEmail}`} dir="ltr" className="block hover:text-violet-600">
              {COMPANY_LEGAL.supportEmail}
            </a>
          </div>
        </div>
      </div>
      <div className="mx-auto mt-10 max-w-7xl border-t border-slate-200 pt-6 text-center text-sm text-slate-500">
        © {year} Mey Architects, PC · ChatLoora. {copy.footer.rights}
      </div>
    </footer>
  );
}
