'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, GraduationCap, Loader2 } from 'lucide-react';
import { TrainingMediaPanel } from '@/components/ai/training-media-panel';
import { VoiceNotesTrainingPanel } from '@/components/ai/voice-notes-training-panel';
import { useTranslation } from '@/components/providers/locale-provider';
import { AlertBanner } from '@/components/shared/alert-banner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { type AiPlatformDefinition } from '@/lib/ai-platforms';
import { api, parseApiError } from '@/lib/utils';

type AiSettings = {
  enabled: boolean;
  autoReplyEnabled: boolean;
  confidenceThreshold: number;
  greetingMessage?: string | null;
  outOfOfficeMessage?: string | null;
  transferOnLowConfidence: boolean;
  transferOnComplaint: boolean;
  transferOnRefund: boolean;
  transferOnSensitive: boolean;
  transferOnHumanRequest: boolean;
  pauseAiOnHumanReply: boolean;
  pauseAiOnAssignment: boolean;
  systemPromptOverride?: string | null;
};

const DEFAULT_SETTINGS: AiSettings = {
  enabled: false,
  autoReplyEnabled: false,
  confidenceThreshold: 0.65,
  transferOnLowConfidence: true,
  transferOnComplaint: true,
  transferOnRefund: true,
  transferOnSensitive: true,
  transferOnHumanRequest: true,
  pauseAiOnHumanReply: true,
  pauseAiOnAssignment: true,
};

type PlatformTrainingViewProps = {
  platform: AiPlatformDefinition;
};

export function PlatformTrainingView({ platform }: PlatformTrainingViewProps) {
  const { t } = useTranslation();
  const [settings, setSettings] = useState<AiSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [trainingSaving, setTrainingSaving] = useState(false);
  const [trainingNotice, setTrainingNotice] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setTrainingNotice(null);
    api<AiSettings>(`/ai/settings?platform=${platform.platform}`)
      .then(setSettings)
      .catch(() => setSettings(DEFAULT_SETTINGS))
      .finally(() => setLoading(false));
  }, [platform.platform]);

  async function saveTraining(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const current = settings ?? DEFAULT_SETTINGS;
    setTrainingSaving(true);
    setTrainingNotice(null);
    try {
      const form = new FormData(event.currentTarget);
      const systemPromptOverride = String(form.get('trainingInstructions') ?? '').trim() || null;
      const updated = await api<AiSettings>('/ai/settings', {
        method: 'POST',
        body: JSON.stringify({
          platform: platform.platform,
          enabled: true,
          autoReplyEnabled: true,
          confidenceThreshold: current.confidenceThreshold,
          greetingMessage: current.greetingMessage ?? null,
          outOfOfficeMessage: current.outOfOfficeMessage ?? null,
          transferOnLowConfidence: current.transferOnLowConfidence,
          transferOnComplaint: current.transferOnComplaint,
          transferOnRefund: current.transferOnRefund,
          transferOnSensitive: current.transferOnSensitive,
          transferOnHumanRequest: current.transferOnHumanRequest,
          pauseAiOnHumanReply: current.pauseAiOnHumanReply,
          pauseAiOnAssignment: current.pauseAiOnAssignment,
          systemPromptOverride,
        }),
      });
      setSettings(updated);
      setTrainingNotice(t('ai.trainingSaved'));
    } catch (err) {
      setTrainingNotice(parseApiError(err));
    } finally {
      setTrainingSaving(false);
    }
  }

  const PlatformIcon = platform.icon;

  return (
    <Card className="border-0 shadow-card">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <GraduationCap className="h-5 w-5" />
              {t('ai.platformTrainingTitle').replace('{platform}', t(platform.labelKey))}
            </CardTitle>
            <CardDescription className="mt-1">{t(platform.descKey)}</CardDescription>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link href="/ai">
              <ArrowLeft className="me-2 h-4 w-4" />
              {t('ai.backToAiHub')}
            </Link>
          </Button>
        </div>
        <div className="flex items-center gap-2 pt-2">
          <PlatformIcon className="h-4 w-4 text-muted-foreground" />
          <Badge variant="outline">{t(platform.labelKey)}</Badge>
        </div>
      </CardHeader>
      <CardContent>
        {trainingNotice && (
          <AlertBanner className="mb-4" variant={trainingNotice === t('ai.trainingSaved') ? 'success' : 'error'}>
            {trainingNotice}
          </AlertBanner>
        )}
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t('common.loading')}
          </div>
        ) : (
          <form onSubmit={saveTraining} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="trainingInstructions">{t('ai.tabTraining')}</Label>
              <Textarea
                id="trainingInstructions"
                name="trainingInstructions"
                key={`${platform.platform}-${settings?.systemPromptOverride ?? 'empty'}`}
                defaultValue={settings?.systemPromptOverride ?? ''}
                placeholder={t('ai.trainingPlaceholder')}
                rows={16}
                className="font-mono text-sm leading-relaxed"
              />
            </div>
            <p className="text-sm text-muted-foreground">{t('ai.trainingHint')}</p>
            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" disabled={trainingSaving}>
                {trainingSaving ? (
                  <>
                    <Loader2 className="me-2 h-4 w-4 animate-spin" />
                    {t('ai.savingTraining')}
                  </>
                ) : (
                  t('ai.saveTraining')
                )}
              </Button>
              {settings?.enabled && settings.autoReplyEnabled && (
                <Badge variant="success">{t('common.enabled')}</Badge>
              )}
            </div>
          </form>
        )}
        <TrainingMediaPanel platform={platform.platform} platformLabelKey={platform.labelKey} />
        <VoiceNotesTrainingPanel platform={platform.platform} />
      </CardContent>
    </Card>
  );
}
