'use client';

import { motion, type HTMLMotionProps } from 'framer-motion';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

const fadeUp = {
  hidden: { opacity: 0, y: 28 },
  show: { opacity: 1, y: 0 },
};

export function LandingReveal({
  children,
  className,
  delay = 0,
  ...props
}: HTMLMotionProps<'div'> & { children: ReactNode; delay?: number }) {
  return (
    <motion.div
      variants={fadeUp}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1], delay }}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
}

export function LandingSectionHeader({
  eyebrow,
  title,
  subtitle,
  align = 'center',
  className,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
  align?: 'center' | 'start';
  className?: string;
}) {
  return (
    <LandingReveal
      className={cn(
        'mx-auto max-w-3xl space-y-3',
        align === 'center' ? 'text-center' : 'text-start',
        className,
      )}
    >
      <p className="text-xs font-semibold tracking-[0.18em] text-violet-600 uppercase">{eyebrow}</p>
      <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl lg:text-[2.75rem] lg:leading-tight">
        {title}
      </h2>
      {subtitle ? <p className="text-base text-slate-600 sm:text-lg">{subtitle}</p> : null}
    </LandingReveal>
  );
}

export function LandingShell({ children }: { children: ReactNode }) {
  return (
    <div className="landing-root relative min-h-screen overflow-x-hidden bg-[#F8FAFC] text-slate-900">
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-32 start-1/2 h-[28rem] w-[28rem] -translate-x-1/2 rounded-full bg-violet-400/20 blur-3xl" />
        <div className="absolute top-[40%] -end-24 h-80 w-80 rounded-full bg-sky-400/20 blur-3xl" />
        <div className="absolute bottom-0 start-0 h-72 w-72 rounded-full bg-fuchsia-400/15 blur-3xl" />
      </div>
      {children}
    </div>
  );
}
