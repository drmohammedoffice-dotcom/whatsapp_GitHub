'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { TikTokIntegrationShell } from '@/components/tiktok/tiktok-integration-shell';
import { PageHeader } from '@/components/shared/page-header';
import { AlertBanner } from '@/components/shared/alert-banner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useTranslation } from '@/components/providers/locale-provider';
import {
  AD_PLATFORM_OPTIONS,
  createInstantForm,
  listInstantFormTemplates,
  type InstantFormAdPlatform,
  type InstantFormTemplateMeta,
} from '@/lib/instant-forms/api';
import {
  fetchTikTokIntegrations,
  type TikTokIntegrationView,
} from '@/lib/tiktok-integration';
import { cn } from '@/lib/utils';

function accountLabel(item: TikTokIntegrationView) {
  const pixel = item.pixelName || item.name || item.pixelCode || 'Pixel';
  const advertiser = item.advertiserName || item.advertiserId;
  return advertiser ? `${pixel} — ${advertiser}` : String(pixel);
}

export default function NewInstantFormPage() {
  const { t, locale } = useTranslation();
  const router = useRouter();
  const [name, setName] = useState('');
  const [adAccountLabel, setAdAccountLabel] = useState('');
  const [pixelIntegrationId, setPixelIntegrationId] = useState<string>('');
  const [manualAccount, setManualAccount] = useState(false);
  const [adPlatform, setAdPlatform] = useState<InstantFormAdPlatform>('TIKTOK');
  const [templateKey, setTemplateKey] = useState<string | undefined>();
  const [templates, setTemplates] = useState<InstantFormTemplateMeta[]>([]);
  const [integrations, setIntegrations] = useState<TikTokIntegrationView[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    void listInstantFormTemplates()
      .then(setTemplates)
      .catch(() => setTemplates([]));
  }, []);

  useEffect(() => {
    setLoadingAccounts(true);
    void fetchTikTokIntegrations()
      .then((res) => {
        const list = (res.integrations || []).filter(
          (item) => item.pixelId || item.advertiserId || item.pixelName || item.name,
        );
        setIntegrations(list);
        if (list.length === 1 && !pixelIntegrationId) {
          const only = list[0]!;
          setPixelIntegrationId(only.id);
          setAdAccountLabel(accountLabel(only));
          setAdPlatform('TIKTOK');
        }
      })
      .catch(() => setIntegrations([]))
      .finally(() => setLoadingAccounts(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const showTikTokSelect = adPlatform === 'TIKTOK' && !manualAccount;

  const selectedIntegration = useMemo(
    () => integrations.find((item) => item.id === pixelIntegrationId) || null,
    [integrations, pixelIntegrationId],
  );

  async function onContinue() {
    if (name.trim().length < 2) {
      setError(t('instantForms.nameRequired'));
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const label =
        showTikTokSelect && selectedIntegration
          ? accountLabel(selectedIntegration)
          : adAccountLabel.trim() || undefined;
      const form = await createInstantForm({
        name: name.trim(),
        adPlatform,
        adAccountLabel: label,
        pixelIntegrationId:
          showTikTokSelect && pixelIntegrationId ? pixelIntegrationId : null,
        templateKey,
      });
      router.push(`/tiktok/integration/forms/${form.id}/builder`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
      setSubmitting(false);
    }
  }

  return (
    <TikTokIntegrationShell>
      <PageHeader title={t('instantForms.create')} description={t('instantForms.wizardDesc')} />
      {error ? <AlertBanner className="mt-4" variant="error">{error}</AlertBanner> : null}

      <Card className="mt-6 border-0 shadow-card">
        <CardContent className="space-y-6 p-6">
          <div className="space-y-2">
            <Label>{t('instantForms.formName')}</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('instantForms.formNamePlaceholder')}
            />
          </div>

          <div className="space-y-2">
            <Label>{t('instantForms.adPlatform')}</Label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {AD_PLATFORM_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    setAdPlatform(opt.value);
                    if (opt.value !== 'TIKTOK') {
                      setManualAccount(true);
                      setPixelIntegrationId('');
                    } else {
                      setManualAccount(false);
                    }
                  }}
                  className={cn(
                    'rounded-xl border px-3 py-3 text-sm font-medium transition',
                    adPlatform === opt.value
                      ? 'border-violet-500 bg-violet-50 text-violet-800'
                      : 'hover:bg-muted',
                  )}
                >
                  {locale === 'ar' ? opt.labelAr : opt.labelEn}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Label>{t('instantForms.adAccount')}</Label>
              {adPlatform === 'TIKTOK' ? (
                <button
                  type="button"
                  className="text-[11px] font-medium text-violet-700 hover:underline"
                  onClick={() => {
                    setManualAccount((v) => !v);
                    if (!manualAccount) setPixelIntegrationId('');
                  }}
                >
                  {manualAccount ? t('instantForms.adAccountSelect') : t('instantForms.adAccountManual')}
                </button>
              ) : null}
            </div>

            {showTikTokSelect ? (
              loadingAccounts ? (
                <div className="flex items-center gap-2 rounded-xl border px-3 py-3 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  …
                </div>
              ) : integrations.length === 0 ? (
                <div className="space-y-2 rounded-xl border border-dashed border-amber-300 bg-amber-50/60 p-3">
                  <p className="text-sm font-medium text-amber-900">{t('instantForms.adAccountEmpty')}</p>
                  <p className="text-xs text-amber-800/80">{t('instantForms.adAccountEmptyHint')}</p>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button asChild size="sm" variant="outline">
                      <Link href="/tiktok/integration">{t('instantForms.adAccountLinkSetup')}</Link>
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => setManualAccount(true)}
                    >
                      {t('instantForms.adAccountManual')}
                    </Button>
                  </div>
                </div>
              ) : (
                <select
                  className="h-11 w-full rounded-xl border bg-background px-3 text-sm outline-none focus:border-violet-400"
                  value={pixelIntegrationId}
                  onChange={(e) => {
                    const id = e.target.value;
                    setPixelIntegrationId(id);
                    const found = integrations.find((item) => item.id === id);
                    setAdAccountLabel(found ? accountLabel(found) : '');
                  }}
                >
                  <option value="">{t('instantForms.adAccountNone')}</option>
                  {integrations.map((item) => (
                    <option key={item.id} value={item.id}>
                      {accountLabel(item)}
                    </option>
                  ))}
                </select>
              )
            ) : (
              <Input
                value={adAccountLabel}
                onChange={(e) => setAdAccountLabel(e.target.value)}
                placeholder={t('instantForms.adAccountPlaceholder')}
              />
            )}

            {showTikTokSelect && selectedIntegration ? (
              <p className="text-[11px] text-muted-foreground">
                {[
                  selectedIntegration.advertiserName,
                  selectedIntegration.pixelCode,
                  selectedIntegration.whatsappNumber,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            ) : null}
          </div>

            <div className="space-y-2">
              <Label>{t('instantForms.template')}</Label>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                <button
                  type="button"
                  onClick={() => setTemplateKey(undefined)}
                  className={cn(
                    'rounded-xl border px-3 py-3 text-start text-sm',
                    !templateKey ? 'border-violet-500 bg-violet-50' : 'hover:bg-muted',
                  )}
                >
                  <div className="font-medium">{t('instantForms.blankTemplate')}</div>
                  <div className="text-xs text-muted-foreground">{t('instantForms.blankTemplateDesc')}</div>
                </button>
                {templates.map((tpl) => (
                  <button
                    key={tpl.key}
                    type="button"
                    onClick={() => setTemplateKey(tpl.key)}
                    className={cn(
                      'rounded-xl border px-3 py-3 text-start text-sm',
                      templateKey === tpl.key ? 'border-violet-500 bg-violet-50' : 'hover:bg-muted',
                    )}
                  >
                    <div className="font-medium">{locale === 'ar' ? tpl.nameAr : tpl.nameEn}</div>
                    <div className="text-xs text-muted-foreground">{tpl.descriptionAr}</div>
                  </button>
                ))}
              </div>
            </div>

          <Button disabled={submitting} onClick={() => void onContinue()}>
            {submitting ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : null}
            {t('instantForms.continue')}
          </Button>
        </CardContent>
      </Card>
    </TikTokIntegrationShell>
  );
}
