'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ImagePlus, Loader2, Sparkles, X } from 'lucide-react';
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
  generateInstantFormDocument,
  listInstantFormTemplates,
  uploadInstantFormMedia,
  type InstantFormAdPlatform,
  type InstantFormTemplateMeta,
} from '@/lib/instant-forms/api';
import { parseMoneyInput } from '@/lib/instant-forms/document';
import {
  fetchTikTokIntegrations,
  type TikTokIntegrationView,
} from '@/lib/tiktok-integration';
import { cn } from '@/lib/utils';

type Mode = 'template' | 'ai';

function accountLabel(item: TikTokIntegrationView) {
  const pixel = item.pixelName || item.name || item.pixelCode || 'Pixel';
  const advertiser = item.advertiserName || item.advertiserId;
  return advertiser ? `${pixel} — ${advertiser}` : String(pixel);
}

function parseFeatures(raw: string): string[] {
  return raw
    .split(/\r?\n|,/)
    .map((line) => line.trim())
    .filter((line) => line.length >= 2)
    .slice(0, 12);
}

export default function NewInstantFormPage() {
  const { t, locale } = useTranslation();
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<Mode>('ai');
  const [name, setName] = useState('');
  const [adAccountLabel, setAdAccountLabel] = useState('');
  const [pixelIntegrationId, setPixelIntegrationId] = useState<string>('');
  const [manualAccount, setManualAccount] = useState(false);
  const [adPlatform, setAdPlatform] = useState<InstantFormAdPlatform>('TIKTOK');
  const [templateKey, setTemplateKey] = useState<string | undefined>();
  const [templates, setTemplates] = useState<InstantFormTemplateMeta[]>([]);
  const [integrations, setIntegrations] = useState<TikTokIntegrationView[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [brief, setBrief] = useState('');
  const [productDescription, setProductDescription] = useState('');
  const [featuresText, setFeaturesText] = useState('');
  const [price, setPrice] = useState('');
  const [compareAtPrice, setCompareAtPrice] = useState('');
  const [offerBadge, setOfferBadge] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
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

  async function onUploadImages(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    setError(null);
    try {
      const room = Math.max(0, 8 - images.length);
      const picked = Array.from(files).slice(0, room);
      const uploaded: string[] = [];
      for (const file of picked) {
        if (!file.type.startsWith('image/')) continue;
        const result = await uploadInstantFormMedia(file);
        if (result.url) uploaded.push(result.url);
      }
      if (uploaded.length) setImages((prev) => [...prev, ...uploaded].slice(0, 8));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function onContinue() {
    if (name.trim().length < 2) {
      setError(t('instantForms.nameRequired'));
      return;
    }
    const detailsBlob = [productDescription, brief, featuresText].map((s) => s.trim()).filter(Boolean).join('\n');
    if (mode === 'ai' && detailsBlob.length < 10) {
      setError(t('instantForms.aiBriefRequired'));
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      let draftDocument = undefined;
      if (mode === 'ai') {
        const features = parseFeatures(featuresText);
        const salePrice = price.trim() ? parseMoneyInput(price) ?? undefined : undefined;
        const wasPrice = compareAtPrice.trim()
          ? parseMoneyInput(compareAtPrice) ?? undefined
          : undefined;
        const composedBrief = [
          productDescription.trim() && `وصف المنتج:\n${productDescription.trim()}`,
          features.length ? `المميزات:\n${features.map((f) => `- ${f}`).join('\n')}` : '',
          brief.trim() && `ملاحظات العرض:\n${brief.trim()}`,
          `المنصة: ${adPlatform}`,
          salePrice != null ? `السعر: ${salePrice}` : '',
          wasPrice != null ? `السعر قبل التخفيض: ${wasPrice}` : '',
        ]
          .filter(Boolean)
          .join('\n\n');

        draftDocument = await generateInstantFormDocument({
          brief: composedBrief || detailsBlob,
          productName: name.trim(),
          productDescription: productDescription.trim() || undefined,
          price: salePrice,
          compareAtPrice: wasPrice,
          currency: 'IQD',
          features,
          images,
          platform: adPlatform,
          offerBadge: offerBadge.trim() || undefined,
          extraNotes: brief.trim() || undefined,
        });
      }
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
        templateKey: mode === 'template' ? templateKey : undefined,
        draftDocument,
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
          <div className="grid grid-cols-2 gap-2 rounded-xl bg-muted p-1">
            <button
              type="button"
              onClick={() => setMode('ai')}
              className={cn(
                'flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition',
                mode === 'ai' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <Sparkles className="h-4 w-4 text-violet-600" />
              {t('instantForms.aiMode')}
            </button>
            <button
              type="button"
              onClick={() => setMode('template')}
              className={cn(
                'rounded-lg px-3 py-2.5 text-sm font-medium transition',
                mode === 'template' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {t('instantForms.templateMode')}
            </button>
          </div>

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

          {mode === 'ai' ? (
            <div className="space-y-4 rounded-2xl border border-violet-200 bg-violet-50/50 p-4">
              <div>
                <p className="font-medium text-violet-900">{t('instantForms.aiTitle')}</p>
                <p className="mt-1 text-sm text-violet-800/80">{t('instantForms.aiDesc')}</p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>{t('instantForms.aiPrice')}</Label>
                  <Input
                    type="text"
                    inputMode="numeric"
                    dir="ltr"
                    lang="en"
                    className="text-start"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="25000"
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t('instantForms.aiCompareAtPrice')}</Label>
                  <Input
                    type="text"
                    inputMode="numeric"
                    dir="ltr"
                    lang="en"
                    className="text-start"
                    value={compareAtPrice}
                    onChange={(e) => setCompareAtPrice(e.target.value)}
                    placeholder="35000"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>{t('instantForms.aiOfferBadge')}</Label>
                <Input
                  value={offerBadge}
                  onChange={(e) => setOfferBadge(e.target.value)}
                  placeholder={t('instantForms.aiOfferBadgePlaceholder')}
                />
              </div>

              <div className="space-y-2">
                <Label>{t('instantForms.aiProductDetails')}</Label>
                <textarea
                  className="min-h-28 w-full rounded-xl border bg-background px-3 py-2 text-sm"
                  value={productDescription}
                  onChange={(e) => setProductDescription(e.target.value)}
                  placeholder={t('instantForms.aiProductDetailsPlaceholder')}
                />
              </div>

              <div className="space-y-2">
                <Label>{t('instantForms.aiFeatures')}</Label>
                <textarea
                  className="min-h-24 w-full rounded-xl border bg-background px-3 py-2 text-sm"
                  value={featuresText}
                  onChange={(e) => setFeaturesText(e.target.value)}
                  placeholder={t('instantForms.aiFeaturesPlaceholder')}
                />
              </div>

              <div className="space-y-2">
                <Label>{t('instantForms.aiImages')}</Label>
                <p className="text-xs text-violet-800/70">{t('instantForms.aiImagesHint')}</p>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => void onUploadImages(e.target.files)}
                />
                <div className="flex flex-wrap gap-2">
                  {images.map((url) => (
                    <div key={url} className="relative h-20 w-20 overflow-hidden rounded-xl border bg-white">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt="" className="h-full w-full object-cover" />
                      <button
                        type="button"
                        className="absolute end-1 top-1 rounded-full bg-black/60 p-0.5 text-white"
                        onClick={() => setImages((prev) => prev.filter((u) => u !== url))}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                  {images.length < 8 ? (
                    <button
                      type="button"
                      disabled={uploading}
                      onClick={() => fileRef.current?.click()}
                      className="flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-violet-300 bg-white text-violet-700 hover:bg-violet-50 disabled:opacity-60"
                    >
                      {uploading ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        <ImagePlus className="h-5 w-5" />
                      )}
                      <span className="text-[10px] font-medium">
                        {uploading ? t('instantForms.aiUploading') : '+'}
                      </span>
                    </button>
                  ) : null}
                </div>
              </div>

              <div className="space-y-2">
                <Label>{t('instantForms.aiBrief')}</Label>
                <textarea
                  className="min-h-24 w-full rounded-xl border bg-background px-3 py-2 text-sm"
                  value={brief}
                  onChange={(e) => setBrief(e.target.value)}
                  placeholder={t('instantForms.aiBriefPlaceholder')}
                />
              </div>
            </div>
          ) : (
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
          )}

          <Button disabled={submitting || uploading} onClick={() => void onContinue()}>
            {submitting ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : null}
            {mode === 'ai' ? t('instantForms.aiContinue') : t('instantForms.continue')}
          </Button>
        </CardContent>
      </Card>
    </TikTokIntegrationShell>
  );
}
