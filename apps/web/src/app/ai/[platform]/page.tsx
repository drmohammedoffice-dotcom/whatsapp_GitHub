'use client';

import { notFound } from 'next/navigation';
import { use } from 'react';
import { PlatformTrainingView } from '@/components/ai/platform-training-view';
import { AppShell } from '@/components/layout/app-shell';
import { useTranslation } from '@/components/providers/locale-provider';
import { PageHeader } from '@/components/shared/page-header';
import { getAiPlatformBySlug, isAiPlatformSlug } from '@/lib/ai-platforms';

type PageProps = {
  params: Promise<{ platform: string }>;
};

export default function AiPlatformTrainingPage({ params }: PageProps) {
  const { platform: platformSlug } = use(params);
  const { t } = useTranslation();

  if (!isAiPlatformSlug(platformSlug)) {
    notFound();
  }

  const platform = getAiPlatformBySlug(platformSlug);
  if (!platform) notFound();

  return (
    <AppShell>
      <PageHeader
        title={t('ai.platformTrainingTitle').replace('{platform}', t(platform.labelKey))}
        description={t(platform.descKey)}
      />
      <div className="mt-6">
        <PlatformTrainingView platform={platform} />
      </div>
    </AppShell>
  );
}
