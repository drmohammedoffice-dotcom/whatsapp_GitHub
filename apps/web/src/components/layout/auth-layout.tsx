'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { MessageSquare } from 'lucide-react';
import { ReactNode } from 'react';
import { useTranslation } from '@/components/providers/locale-provider';
import { LanguageToggle } from '@/components/shared/language-toggle';

export function AuthLayout({
  children,
  title,
  subtitle,
}: {
  children: ReactNode;
  title: string;
  subtitle: string;
}) {
  const { t } = useTranslation();
  const features = [
    t('auth.featureInbox'),
    t('auth.featureAi'),
    t('auth.featureWebhooks'),
  ];

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-gradient-to-br from-primary via-primary/90 to-indigo-700 p-12 lg:flex lg:flex-col lg:justify-between">
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5 }}>
          <Link href="/" className="flex items-center gap-3 text-white">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/20 backdrop-blur">
              <MessageSquare className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xl font-bold">Watsapp</p>
              <p className="text-sm text-white/80">{t('auth.platformTagline')}</p>
            </div>
          </Link>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="space-y-6"
        >
          <h1 className="text-4xl font-bold leading-tight text-white">{t('auth.heroTitle')}</h1>
          <p className="max-w-md text-lg text-white/85">{t('auth.heroSubtitle')}</p>
          <div className="grid grid-cols-3 gap-4 pt-4">
            {features.map((item) => (
              <div key={item} className="rounded-xl bg-white/10 p-4 backdrop-blur">
                <p className="text-sm font-semibold text-white">{item}</p>
              </div>
            ))}
          </div>
        </motion.div>

        <p className="text-sm text-white/60">© {new Date().getFullYear()} {t('auth.copyright')}</p>
      </div>

      <div className="relative flex items-center justify-center bg-background p-6 sm:p-10">
        <div className="absolute end-4 top-4 sm:end-6 sm:top-6">
          <LanguageToggle variant="button" />
        </div>
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-md space-y-8"
        >
          <div className="space-y-2 text-center lg:text-start">
            <div className="mb-6 flex justify-center lg:hidden">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                <MessageSquare className="h-6 w-6" />
              </div>
            </div>
            <h2 className="text-2xl font-bold tracking-tight">{title}</h2>
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          </div>
          {children}
        </motion.div>
      </div>
    </div>
  );
}
