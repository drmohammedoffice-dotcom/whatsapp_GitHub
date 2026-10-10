'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { TikTokIntegrationShell } from '@/components/tiktok/tiktok-integration-shell';
import { InstantFormBuilder } from '@/components/instant-forms/form-builder';
import { AlertBanner } from '@/components/shared/alert-banner';
import { useTranslation } from '@/components/providers/locale-provider';
import {
  getInstantForm,
  publishInstantForm,
  saveInstantFormDraft,
  type InstantFormView,
} from '@/lib/instant-forms/api';
import type { InstantFormDocument } from '@/lib/instant-forms/document';

export default function InstantFormBuilderPage() {
  const params = useParams<{ id: string }>();
  const { locale, t } = useTranslation();
  const [form, setForm] = useState<InstantFormView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);

  useEffect(() => {
    void getInstantForm(params.id)
      .then(setForm)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed'));
  }, [params.id]);

  const onSaveDraft = useCallback(
    async (doc: InstantFormDocument) => {
      setSaving(true);
      try {
        const updated = await saveInstantFormDraft(params.id, doc);
        setForm(updated);
      } finally {
        setSaving(false);
      }
    },
    [params.id],
  );

  const onPublish = useCallback(async () => {
    setPublishing(true);
    setError(null);
    try {
      const updated = await publishInstantForm(params.id);
      setForm(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Publish failed');
    } finally {
      setPublishing(false);
    }
  }, [params.id]);

  if (error && !form) {
    return (
      <TikTokIntegrationShell>
        <AlertBanner variant="error">{error}</AlertBanner>
      </TikTokIntegrationShell>
    );
  }

  if (!form) {
    return (
      <TikTokIntegrationShell>
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t('common.loading')}
        </div>
      </TikTokIntegrationShell>
    );
  }

  return (
    <TikTokIntegrationShell>
      {error ? <AlertBanner className="mb-3" variant="error">{error}</AlertBanner> : null}
      <InstantFormBuilder
        form={form}
        onSaveDraft={onSaveDraft}
        onPublish={onPublish}
        saving={saving}
        publishing={publishing}
        locale={locale === 'ar' ? 'ar' : 'en'}
      />
    </TikTokIntegrationShell>
  );
}
