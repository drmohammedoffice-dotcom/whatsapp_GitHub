'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { socialConnectItems } from '@/components/layout/nav-config';
import { ChannelBrandIcon } from '@/components/channels/channel-brand-icon';
import { useTranslation } from '@/components/providers/locale-provider';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function ConnectSocialPage() {
  const { t, dir } = useTranslation();
  const Arrow = dir === 'rtl' ? ArrowLeft : ArrowRight;

  return (
    <AppShell>
      <PageHeader title={t('nav.socialConnectHub')} description={t('nav.socialConnectHubDesc')} />
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {socialConnectItems.map((item, index) => (
          <motion.div
            key={item.href}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: index * 0.06 }}
          >
            <Link href={item.href} className="block h-full">
              <Card className="h-full border-0 shadow-card transition-all duration-200 hover:-translate-y-1 hover:shadow-lg">
                <CardHeader className="flex flex-row items-start gap-3">
                  {item.brand ? <ChannelBrandIcon brand={item.brand} size="md" className="rounded-xl" /> : null}
                  <div className="min-w-0 flex-1">
                    <CardTitle className="text-base">{t(item.labelKey)}</CardTitle>
                    <CardDescription className="mt-1">{t(item.descKey)}</CardDescription>
                  </div>
                  <Arrow className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <p className="text-sm font-medium text-primary">{t('common.connect')}</p>
                </CardContent>
              </Card>
            </Link>
          </motion.div>
        ))}
      </div>
    </AppShell>
  );
}
