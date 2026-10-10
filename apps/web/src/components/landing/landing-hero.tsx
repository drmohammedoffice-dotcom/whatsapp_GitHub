'use client';

import { motion } from 'framer-motion';
import { ArrowRight, Download, Play, Star } from 'lucide-react';
import Link from 'next/link';
import { useLocale } from '@/components/providers/locale-provider';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { LandingReveal } from './landing-ui';
import { CHATLOORA_WINDOWS_DOWNLOAD_FILENAME, CHATLOORA_WINDOWS_DOWNLOAD_URL } from '@/lib/chatloora-downloads';
import { useLandingCopy } from './use-landing-copy';

function DashboardPreview() {
  const { dir } = useLocale();
  return (
    <div className="relative mx-auto w-full max-w-5xl">
      <div className="absolute -inset-4 rounded-[2rem] bg-gradient-to-br from-violet-500/30 via-fuchsia-400/20 to-sky-400/30 blur-2xl" />
      <motion.div
        initial={{ opacity: 0, y: 40, rotateX: 8 }}
        animate={{ opacity: 1, y: 0, rotateX: 0 }}
        transition={{ duration: 0.8, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
        className="relative overflow-hidden rounded-[1.75rem] border border-white/70 bg-white/80 shadow-[0_30px_80px_-20px_rgba(79,70,229,0.45)] backdrop-blur-xl"
        style={{ transformStyle: 'preserve-3d' }}
      >
        <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50/80 px-4 py-3">
          <span className="h-2.5 w-2.5 rounded-full bg-rose-400" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
          <div className="ms-3 h-6 flex-1 truncate rounded-full bg-white/90 px-3 text-[11px] leading-6 text-slate-400">
            chatloora.com/tiktok
          </div>
        </div>
        <div className={cn('grid gap-0 md:grid-cols-[220px_1fr_200px]', dir === 'rtl' && 'md:[direction:rtl]')}>
          <div className="hidden space-y-2 border-e border-slate-100 bg-slate-50/50 p-4 md:block">
            {['TikTok', 'Pixels', 'WhatsApp', 'Top-up'].map((ch, i) => (
              <div
                key={ch}
                className={cn(
                  'rounded-xl px-3 py-2 text-xs font-medium',
                  i === 0 ? 'bg-violet-600 text-white shadow-md shadow-violet-500/30' : 'bg-white text-slate-600',
                )}
              >
                {ch}
              </div>
            ))}
          </div>
          <div className="space-y-3 p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-900">TikTok campaign</p>
                <p className="text-[11px] text-emerald-600">TikTok only · mobile</p>
              </div>
              <span className="rounded-full bg-violet-100 px-2.5 py-1 text-[10px] font-semibold text-violet-700">
                Live
              </span>
            </div>
            <div className="space-y-2">
              <div className="max-w-[85%] rounded-2xl rounded-ss-md bg-slate-100 px-3 py-2 text-xs text-slate-700">
                WhatsApp linked · pixel ready
              </div>
              <div className="ms-auto max-w-[85%] rounded-2xl rounded-se-md bg-gradient-to-br from-violet-600 to-indigo-600 px-3 py-2 text-xs text-white shadow-md shadow-violet-500/20">
                Campaign published on TikTok only. Extra platforms were not added.
              </div>
              <div className="max-w-[85%] rounded-2xl rounded-ss-md bg-slate-100 px-3 py-2 text-xs text-slate-700">
                Top up $10
              </div>
              <div className="ms-auto max-w-[85%] rounded-2xl rounded-se-md bg-gradient-to-br from-violet-600 to-indigo-600 px-3 py-2 text-xs text-white">
                Balance added. Manage it from your phone.
              </div>
            </div>
          </div>
          <div className="hidden space-y-3 border-s border-slate-100 bg-slate-50/40 p-4 md:block">
            <p className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase">Campaign</p>
            {[
              ['Placement', 'TikTok'],
              ['Pixel', 'On'],
              ['Phone', 'Ready'],
            ].map(([k, v]) => (
              <div key={k} className="rounded-xl bg-white p-3 shadow-sm">
                <p className="text-[10px] text-slate-500">{k}</p>
                <p className="text-lg font-bold text-slate-900">{v}</p>
              </div>
            ))}
          </div>
        </div>
      </motion.div>
    </div>
  );
}

export function LandingHero() {
  const copy = useLandingCopy();
  const { dir } = useLocale();

  return (
    <section id="home" className="relative overflow-hidden px-4 pb-16 pt-10 sm:px-6 sm:pb-24 sm:pt-16 lg:px-8">
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        animate={{ backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'] }}
        transition={{ duration: 18, repeat: Infinity, ease: 'linear' }}
        style={{
          backgroundImage:
            'radial-gradient(ellipse 80% 60% at 20% 20%, rgba(139,92,246,0.28), transparent), radial-gradient(ellipse 70% 50% at 80% 10%, rgba(56,189,248,0.22), transparent), radial-gradient(ellipse 60% 40% at 50% 90%, rgba(217,70,239,0.15), transparent)',
          backgroundSize: '200% 200%',
        }}
      />

      <div className="mx-auto max-w-7xl">
        <LandingReveal className="mx-auto max-w-4xl text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-violet-200/80 bg-white/70 px-4 py-1.5 text-xs font-semibold text-violet-700 shadow-sm backdrop-blur">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-violet-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-violet-600" />
            </span>
            {copy.hero.badge}
          </div>

          <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl lg:text-6xl lg:leading-[1.08]">
            <span className="block">{copy.hero.titleLine1}</span>
            <span className="mt-2 block bg-gradient-to-r from-violet-600 via-indigo-600 to-sky-500 bg-clip-text text-transparent">
              {copy.hero.titleLine2}
            </span>
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-base text-slate-600 sm:text-lg">{copy.hero.subtitle}</p>

          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <Link href="/register">
              <Button
                size="lg"
                className="h-12 rounded-full bg-gradient-to-r from-violet-600 to-indigo-600 px-7 text-base shadow-lg shadow-violet-500/30 hover:from-violet-500 hover:to-indigo-500"
              >
                {copy.hero.ctaPrimary}
                <ArrowRight className={cn('h-4 w-4', dir === 'rtl' && 'rotate-180')} />
              </Button>
            </Link>
            <a href="#video">
              <Button
                size="lg"
                variant="outline"
                className="h-12 rounded-full border-slate-200 bg-white/80 px-7 text-base backdrop-blur"
              >
                <Play className="h-4 w-4 fill-current" />
                {copy.hero.ctaSecondary}
              </Button>
            </a>
            <a href={CHATLOORA_WINDOWS_DOWNLOAD_URL} download={CHATLOORA_WINDOWS_DOWNLOAD_FILENAME}>
              <Button
                size="lg"
                variant="outline"
                className="h-12 rounded-full border-violet-200 bg-violet-50/90 px-7 text-base text-violet-900 backdrop-blur hover:bg-violet-100"
              >
                <Download className="h-4 w-4" />
                {copy.hero.downloadWindows}
              </Button>
            </a>
          </div>
          <p className="mt-3 text-center text-xs text-slate-500">{copy.hero.downloadWindowsHint}</p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3 text-sm text-slate-600">
            <div className="flex items-center gap-0.5 text-amber-400">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} className="h-4 w-4 fill-current" />
              ))}
            </div>
            <span className="font-semibold text-slate-800">{copy.hero.trusted}</span>
            <span className="text-slate-400">·</span>
            <span>{copy.hero.stars}</span>
          </div>
        </LandingReveal>

        <div className="mt-14 sm:mt-20">
          <DashboardPreview />
        </div>
      </div>
    </section>
  );
}
