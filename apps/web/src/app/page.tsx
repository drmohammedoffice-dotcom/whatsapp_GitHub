'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowRight, Bot, Inbox, MessageSquare, Shield, Zap } from 'lucide-react';
import { useTranslation } from '@/components/providers/locale-provider';
import { LanguageToggle } from '@/components/shared/language-toggle';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export default function HomePage() {
  const { t, dir } = useTranslation();

  const features = [
    { icon: Inbox, titleKey: 'home.featureInbox', descKey: 'home.featureInboxDesc' },
    { icon: Bot, titleKey: 'home.featureAi', descKey: 'home.featureAiDesc' },
    { icon: Shield, titleKey: 'home.featureSecurity', descKey: 'home.featureSecurityDesc' },
    { icon: Zap, titleKey: 'home.featureRealtime', descKey: 'home.featureRealtimeDesc' },
  ];

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <MessageSquare className="h-5 w-5" />
            </div>
            <span className="text-lg font-bold">Watsapp</span>
          </Link>
          <div className="flex items-center gap-3">
            <LanguageToggle variant="button" />
            <Link href="/login">
              <Button variant="ghost">{t('home.signIn')}</Button>
            </Link>
            <Link href="/register">
              <Button>
                {t('home.getStarted')}{' '}
                <ArrowRight className={cn('h-4 w-4', dir === 'rtl' && 'rotate-180')} />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center"
        >
          <Badge variant="secondary" className="mb-6">
            {t('home.badge')}
          </Badge>
          <h1 className="mx-auto max-w-3xl text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
            {t('home.title')}{' '}
            <span className="bg-gradient-to-r from-primary to-indigo-500 bg-clip-text text-transparent">
              {t('home.titleHighlight')}
            </span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">{t('home.subtitle')}</p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Link href="/register">
              <Button size="lg">
                {t('home.ctaTrial')}{' '}
                <ArrowRight className={cn('h-4 w-4', dir === 'rtl' && 'rotate-180')} />
              </Button>
            </Link>
            <Link href="/login">
              <Button size="lg" variant="outline">
                {t('home.ctaDemo')}
              </Button>
            </Link>
          </div>
        </motion.div>

        <div className="mt-24 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <motion.div
                key={feature.titleKey}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.1 + index * 0.1 }}
              >
                <Card className="h-full border-0 shadow-card transition-shadow hover:shadow-lg">
                  <CardContent className="p-6">
                    <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Icon className="h-5 w-5" />
                    </div>
                    <h3 className="font-semibold">{t(feature.titleKey)}</h3>
                    <p className="mt-2 text-sm text-muted-foreground">{t(feature.descKey)}</p>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
