'use client';

import { motion, useInView, useMotionValue, useSpring } from 'framer-motion';
import {
  Bot,
  Building2,
  CalendarDays,
  Check,
  GraduationCap,
  HeartPulse,
  Home,
  Inbox,
  LineChart,
  MessageSquare,
  ShoppingBag,
  Sparkles,
  Stethoscope,
  Users,
  UtensilsCrossed,
  X,
  BriefcaseBusiness,
  UserRound,
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
import { useEffect, useRef, type ReactElement } from 'react';
import { useLocale } from '@/components/providers/locale-provider';
import { Button } from '@/components/ui/button';
import { CHATLOORA_WINDOWS_DOWNLOAD_FILENAME, CHATLOORA_WINDOWS_DOWNLOAD_URL } from '@/lib/chatloora-downloads';
import { WHATSAPP_SALES_NUMBER } from '@/lib/billing';
import { cn } from '@/lib/utils';
import { LandingReveal, LandingSectionHeader } from './landing-ui';
import { useLandingCopy } from './use-landing-copy';

const audienceIcons = [
  ShoppingBag,
  Stethoscope,
  HeartPulse,
  UtensilsCrossed,
  Home,
  BriefcaseBusiness,
  GraduationCap,
  Sparkles,
  Users,
  UserRound,
];

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

export function LandingAudience() {
  const copy = useLandingCopy();
  return (
    <section id="solutions" className="px-4 py-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <LandingSectionHeader eyebrow={copy.audience.eyebrow} title={copy.audience.title} subtitle={copy.audience.subtitle} />
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {copy.audience.items.map((item, i) => {
            const Icon = audienceIcons[i] ?? Building2;
            return (
              <LandingReveal key={item.title} delay={i * 0.04}>
                <div className="group h-full rounded-2xl border border-white/70 bg-white/80 p-5 shadow-soft backdrop-blur transition hover:-translate-y-1 hover:shadow-card">
                  <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500/15 to-sky-500/15 text-violet-700">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="font-semibold text-slate-900">{item.title}</h3>
                  <p className="mt-1.5 text-sm text-slate-600">{item.desc}</p>
                </div>
              </LandingReveal>
            );
          })}
        </div>
      </div>
    </section>
  );
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

export function LandingMeta() {
  const copy = useLandingCopy();
  return (
    <section className="px-4 py-16 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl rounded-[1.75rem] border border-sky-100 bg-gradient-to-br from-sky-50 via-white to-indigo-50 p-8 sm:p-12">
        <LandingSectionHeader eyebrow={copy.meta.eyebrow} title={copy.meta.title} subtitle={copy.meta.subtitle} />
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {copy.meta.items.map((item, i) => (
            <LandingReveal key={item} delay={i * 0.05}>
              <div className="rounded-2xl border border-white bg-white/90 px-5 py-6 text-center shadow-soft">
                <MessageSquare className="mx-auto mb-3 h-6 w-6 text-sky-600" />
                <p className="font-semibold text-slate-800">{item}</p>
              </div>
            </LandingReveal>
          ))}
        </div>
      </div>
    </section>
  );
}

export function LandingClinics() {
  const copy = useLandingCopy();
  return (
    <section className="px-4 py-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div>
            <LandingSectionHeader
              align="start"
              className="!mx-0 !text-start"
              eyebrow={copy.clinics.eyebrow}
              title={copy.clinics.title}
              subtitle={copy.clinics.subtitle}
            />
            <ul className="mt-8 grid gap-3 sm:grid-cols-2">
              {copy.clinics.capabilities.map((c) => (
                <li key={c} className="flex items-start gap-2 rounded-xl bg-white/80 px-3 py-2.5 text-sm text-slate-700 shadow-soft">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                  {c}
                </li>
              ))}
            </ul>
            <div className="mt-6 rounded-2xl border border-violet-100 bg-violet-50/80 p-5">
              <div className="mb-2 flex items-center gap-2 font-semibold text-violet-900">
                <CalendarDays className="h-5 w-5" />
                {copy.clinics.calendarTitle}
              </div>
              <p className="text-sm text-violet-800/80">{copy.clinics.calendarDesc}</p>
            </div>
          </div>
          <LandingReveal>
            <div className="relative overflow-hidden rounded-[1.75rem] border border-white/80 bg-white p-5 shadow-card">
              <p className="mb-4 text-xs font-semibold tracking-wide text-slate-500 uppercase">{copy.clinics.previewLabel}</p>
              <div className="space-y-3">
                <div className="rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 p-4 text-white">
                  <p className="text-xs opacity-80">Today</p>
                  <p className="text-2xl font-bold">18 appointments</p>
                </div>
                {['Dr. Nour · 2:00 PM · Confirmed', 'Dr. Ali · 3:30 PM · Reminder sent', 'New lead · AI booking…'].map((row) => (
                  <div key={row} className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm">
                    <Stethoscope className="h-4 w-4 text-violet-600" />
                    {row}
                  </div>
                ))}
              </div>
            </div>
          </LandingReveal>
        </div>
      </div>
    </section>
  );
}

export function LandingSales() {
  const copy = useLandingCopy();
  return (
    <section className="px-4 py-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <LandingSectionHeader eyebrow={copy.sales.eyebrow} title={copy.sales.title} subtitle={copy.sales.subtitle} />
        <div className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          {copy.sales.items.map((item, i) => (
            <LandingReveal key={item.title} delay={i * 0.05}>
              <div className="h-full rounded-2xl border border-indigo-100 bg-gradient-to-b from-white to-indigo-50/50 p-5 shadow-soft">
                <p className="text-xs font-bold text-indigo-500">0{i + 1}</p>
                <h3 className="mt-2 font-semibold text-slate-900">{item.title}</h3>
                <p className="mt-2 text-sm text-slate-600">{item.desc}</p>
              </div>
            </LandingReveal>
          ))}
        </div>
      </div>
    </section>
  );
}

const INTEGRATIONS: Array<{
  name: string;
  Icon: (props: { className?: string }) => ReactElement;
  wrapClass: string;
}> = [
  {
    name: 'WhatsApp',
    wrapClass: 'bg-[#25D366] text-white',
    Icon: ({ className }) => (
      <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.435 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
      </svg>
    ),
  },
  {
    name: 'TikTok',
    wrapClass: 'bg-black text-white',
    Icon: ({ className }) => (
      <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
        <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.95-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" />
      </svg>
    ),
  },
  {
    name: 'Facebook',
    wrapClass: 'bg-[#1877F2] text-white',
    Icon: ({ className }) => (
      <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
        <path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z" />
      </svg>
    ),
  },
  {
    name: 'Instagram',
    wrapClass: 'bg-gradient-to-br from-[#833AB4] via-[#FD1D1D] to-[#FCAF45] text-white',
    Icon: ({ className }) => (
      <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
      </svg>
    ),
  },
  {
    name: 'Telegram',
    wrapClass: 'bg-[#229ED9] text-white',
    Icon: ({ className }) => (
      <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
        <path d="M11.944 0A12 12 0 000 12a12 12 0 0012 12 12 12 0 0012-12A12 12 0 0012 0a12 12 0 00-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 01.171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
      </svg>
    ),
  },
  {
    name: 'Google Calendar',
    wrapClass: 'bg-white text-[#1A73E8] ring-1 ring-slate-200',
    Icon: ({ className }) => (
      <svg viewBox="0 0 24 24" className={className} aria-hidden>
        <path fill="#1A73E8" d="M19.5 3h-1.5V1.5h-1.5V3H7.5V1.5H6V3H4.5A1.5 1.5 0 003 4.5v15A1.5 1.5 0 004.5 21h15a1.5 1.5 0 001.5-1.5v-15A1.5 1.5 0 0019.5 3zm0 16.5h-15V9h15v10.5zM19.5 7.5h-15v-3H6V6h1.5V4.5h9V6H18V4.5h1.5v3z" />
        <path fill="#EA4335" d="M8.25 12.75h1.5v1.5h-1.5z" />
        <path fill="#FBBC04" d="M11.25 12.75h1.5v1.5h-1.5z" />
        <path fill="#34A853" d="M14.25 12.75h1.5v1.5h-1.5z" />
        <path fill="#1A73E8" d="M8.25 15.75h1.5v1.5h-1.5z" />
        <path fill="#EA4335" d="M11.25 15.75h1.5v1.5h-1.5z" />
      </svg>
    ),
  },
  {
    name: 'Google Drive',
    wrapClass: 'bg-white ring-1 ring-slate-200',
    Icon: ({ className }) => (
      <svg viewBox="0 0 24 24" className={className} aria-hidden>
        <path fill="#4285F4" d="M4.433 14.5l-2.31 4A2.25 2.25 0 004.08 21.75h4.62L11.01 14.5z" />
        <path fill="#0F9D58" d="M12 2.25L7.38 10.5h9.24L12 2.25z" />
        <path fill="#F4B400" d="M19.92 21.75a2.25 2.25 0 001.957-3.25l-4.62-8H12.75l4.62 8z" />
        <path fill="#DD2C00" d="M8.7 21.75h6.6L12.75 14.5H8.7z" />
      </svg>
    ),
  },
  {
    name: 'OpenAI',
    wrapClass: 'bg-[#10A37F] text-white',
    Icon: ({ className }) => (
      <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
        <path d="M22.282 9.821a5.985 5.985 0 00-.516-4.91 6.046 6.046 0 00-6.51-2.9A6.065 6.065 0 004.981 4.18a5.985 5.985 0 00-3.998 2.9 6.046 6.046 0 00.743 7.097 5.98 5.98 0 00.517 4.911 6.052 6.052 0 006.511 2.9A5.985 5.985 0 0013.26 24a6.056 6.056 0 005.772-4.206 5.99 5.99 0 003.997-2.9 6.056 6.056 0 00-.747-7.073zM13.26 22.43a4.476 4.476 0 01-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 00.392-.681v-6.737l2.02 1.168a.071.071 0 01.038.052v5.583a4.504 4.504 0 01-4.494 4.494zM3.6 18.304a4.47 4.47 0 01-.535-3.014l.142.085 4.783 2.759a.771.771 0 00.78 0l5.843-3.369v2.332a.08.08 0 01-.033.062L9.74 19.95a4.5 4.5 0 01-6.14-1.646zM2.34 7.896a4.485 4.485 0 012.366-1.973V11.6a.766.766 0 00.388.676l5.815 3.355-2.02 1.168a.076.076 0 01-.071 0l-4.83-2.786A4.504 4.504 0 012.34 7.872zm16.597 3.855l-5.833-3.387L15.119 7.2a.076.076 0 01.071 0l4.83 2.791a4.494 4.494 0 01-.676 8.105v-5.678a.79.79 0 00-.407-.668zm2.01-3.023l-.141-.085-4.774-2.782a.776.776 0 00-.785 0L9.409 9.23V6.897a.066.066 0 01.028-.061l4.83-2.787a4.5 4.5 0 016.68 4.66zm-12.64 4.135l-2.02-1.164a.08.08 0 01-.038-.057V6.075a4.5 4.5 0 017.375-3.453l-.142.08L8.704 5.46a.795.795 0 00-.393.681zm1.097-2.365l2.602-1.5 2.607 1.5v2.999l-2.597 1.5-2.607-1.5z" />
      </svg>
    ),
  },
];

export function LandingIntegrations() {
  const copy = useLandingCopy();
  return (
    <section className="px-4 py-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <LandingSectionHeader
          eyebrow={copy.integrations.eyebrow}
          title={copy.integrations.title}
          subtitle={copy.integrations.subtitle}
        />
        <div className="relative mt-14">
          <div className="absolute start-1/2 top-1/2 hidden h-40 w-40 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-gradient-to-br from-violet-600 to-indigo-600 text-sm font-bold text-white shadow-xl shadow-violet-500/40 lg:flex">
            ChatLoora
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {INTEGRATIONS.map((item, i) => (
              <LandingReveal key={item.name} delay={i * 0.04}>
                <motion.div
                  animate={{ y: [0, -6, 0] }}
                  transition={{ duration: 3.5 + i * 0.2, repeat: Infinity, ease: 'easeInOut' }}
                  className="rounded-2xl border border-white bg-white/90 p-5 text-center shadow-card backdrop-blur"
                >
                  <div
                    className={cn(
                      'mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl shadow-md',
                      item.wrapClass,
                    )}
                  >
                    <item.Icon className="h-6 w-6" />
                  </div>
                  <p className="text-sm font-semibold text-slate-800">{item.name}</p>
                </motion.div>
              </LandingReveal>
            ))}
          </div>
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
                    <span className="absolute -top-3 start-1/2 -translate-x-1/2 rounded-full bg-amber-300 px-3 py-1 text-[11px] font-bold text-slate-900">
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
  const supportEmail = copy.contact.supportEmail || 'noreply@chatloora.com';
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
  const year = new Date().getFullYear();
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
            <a href="#features" className="block hover:text-violet-600">
              {copy.nav.features}
            </a>
            <a href="#pricing" className="block hover:text-violet-600">
              {copy.nav.pricing}
            </a>
            <a href="#how-it-works" className="block hover:text-violet-600">
              {copy.nav.howItWorks}
            </a>
          </div>
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-900">{copy.footer.resources}</p>
          <div className="mt-3 space-y-2 text-sm text-slate-600">
            <a href="#faq" className="block hover:text-violet-600">
              {copy.nav.faq}
            </a>
            <Link href="/pricing" className="block hover:text-violet-600">
              {copy.nav.pricing}
            </Link>
            <Link href="/register" className="block hover:text-violet-600">
              {copy.nav.startTrial}
            </Link>
            <a
              href={CHATLOORA_WINDOWS_DOWNLOAD_URL}
              download={CHATLOORA_WINDOWS_DOWNLOAD_FILENAME}
              className="block hover:text-violet-600"
            >
              {copy.footer.windowsApp}
            </a>
          </div>
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-900">{copy.footer.legal}</p>
          <div className="mt-3 space-y-2 text-sm text-slate-600">
            <Link href="/company" className="block hover:text-violet-600">
              {copy.footer.companyInfo}
            </Link>
            <span className="block">{copy.footer.privacy}</span>
            <span className="block">{copy.footer.terms}</span>
          </div>
        </div>
      </div>
      <div className="mx-auto mt-10 max-w-7xl border-t border-slate-200 pt-6 text-center text-sm text-slate-500">
        © {year} Mey Architects, PC · ChatLoora. {copy.footer.rights}
      </div>
    </footer>
  );
}
