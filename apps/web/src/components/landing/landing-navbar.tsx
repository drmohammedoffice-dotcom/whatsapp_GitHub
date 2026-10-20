'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { Menu, X } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ChatLooraBrand } from '@/components/brand/chatloora-brand';
import { LanguageToggle } from '@/components/shared/language-toggle';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useLandingCopy } from './use-landing-copy';

const LINKS = [
  { id: 'home', key: 'home' as const },
  { id: 'features', key: 'features' as const },
  { id: 'solutions', key: 'solutions' as const },
  { id: 'how-it-works', key: 'howItWorks' as const },
  { id: 'pricing', key: 'pricing' as const },
  { id: 'testimonials', key: 'testimonials' as const },
  { id: 'faq', key: 'faq' as const },
  { id: 'contact', key: 'contact' as const },
];

export function LandingNavbar() {
  const copy = useLandingCopy();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  return (
    <header
      className={cn(
        'sticky top-0 z-50 transition-all duration-300',
        scrolled
          ? 'border-b border-white/40 bg-white/70 shadow-soft backdrop-blur-xl'
          : 'border-b border-transparent bg-transparent',
      )}
    >
      {/* Mobile: brand | language (center) | menu — matches red-circle placement */}
      <div className="mx-auto grid h-[4.25rem] max-w-7xl grid-cols-[auto_1fr_auto] items-center gap-2 px-4 sm:px-6 lg:hidden">
        <ChatLooraBrand href="/#home" layout="full-logo" size="sm" />
        <div className="flex justify-center">
          <LanguageToggle variant="button" />
        </div>
        <button
          type="button"
          className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white/80 text-slate-700"
          aria-label={copy.nav.menu}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Desktop */}
      <div className="mx-auto hidden h-[4.25rem] max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:flex lg:px-8">
        <ChatLooraBrand href="/#home" layout="full-logo" size="sm" />

        <nav className="flex items-center gap-1">
          {LINKS.map((link) => (
            <a
              key={link.id}
              href={`#${link.id}`}
              className="rounded-full px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-violet-50 hover:text-violet-700"
            >
              {copy.nav[link.key]}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <LanguageToggle variant="button" />
          <Link href="/login">
            <Button variant="ghost" className="font-medium text-slate-700">
              {copy.nav.login}
            </Button>
          </Link>
          <Link href="/become-a-partner">
            <Button variant="ghost" className="font-medium text-slate-700">
              {copy.nav.becomePartner}
            </Button>
          </Link>
          <Link href="/register">
            <Button className="rounded-full bg-gradient-to-r from-violet-600 to-indigo-600 px-5 shadow-lg shadow-violet-500/25 hover:from-violet-500 hover:to-indigo-500">
              {copy.nav.startTrial}
            </Button>
          </Link>
        </div>
      </div>

      <AnimatePresence>
        {open ? (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t border-slate-200/70 bg-white/95 backdrop-blur-xl lg:hidden"
          >
            <div className="space-y-1 px-4 py-4">
              {LINKS.map((link) => (
                <a
                  key={link.id}
                  href={`#${link.id}`}
                  onClick={() => setOpen(false)}
                  className="block rounded-xl px-3 py-3 text-sm font-medium text-slate-700 hover:bg-violet-50"
                >
                  {copy.nav[link.key]}
                </a>
              ))}
              <div className="flex flex-col gap-2 border-t border-slate-100 pt-3">
                <Link href="/login" onClick={() => setOpen(false)}>
                  <Button variant="outline" className="w-full">
                    {copy.nav.login}
                  </Button>
                </Link>
                <Link href="/become-a-partner" onClick={() => setOpen(false)}>
                  <Button variant="outline" className="w-full">
                    {copy.nav.becomePartner}
                  </Button>
                </Link>
                <Link href="/register" onClick={() => setOpen(false)}>
                  <Button className="w-full rounded-full bg-gradient-to-r from-violet-600 to-indigo-600">
                    {copy.nav.startTrial}
                  </Button>
                </Link>
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </header>
  );
}
