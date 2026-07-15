'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Check, ChevronLeft, ChevronRight, Copy, ExternalLink, Loader2, PartyPopper, Search } from 'lucide-react';
import { TikTokIntegrationShell } from '@/components/tiktok/tiktok-integration-shell';
import { useTranslation } from '@/components/providers/locale-provider';
import { AlertBanner } from '@/components/shared/alert-banner';
import { PageHeader } from '@/components/shared/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  OPTIMIZATION_EVENT_OPTIONS,
  createTikTokIntegrationPixel,
  fetchTikTokIntegrationWizard,
  saveTikTokIntegrationAdvertiser,
  saveTikTokIntegrationOptimizationEvent,
  saveTikTokIntegrationWhatsapp,
  startTikTokIntegrationOAuth,
  type TikTokIntegrationView,
  type TikTokIntegrationWizardState,
  type TikTokOptimizationEvent,
} from '@/lib/tiktok-integration';
import { cn, parseApiError } from '@/lib/utils';
import { runTikTokSetupAutomation } from '@/lib/tiktok-pixel-setup';

const STEPS = [1, 2, 3, 4, 5, 6] as const;

function WizardInner() {
  const { t } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [state, setState] = useState<TikTokIntegrationWizardState | null>(null);
  const [step, setStep] = useState(1);

  const [selectedAdvertiser, setSelectedAdvertiser] = useState('');
  const [advertiserSearch, setAdvertiserSearch] = useState('');
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [pixelName, setPixelName] = useState('');
  const [optimizationEvent, setOptimizationEvent] = useState<TikTokOptimizationEvent>('Lead');
  const [customEventName, setCustomEventName] = useState('');
  const [enabledEvents, setEnabledEvents] = useState<Set<TikTokOptimizationEvent>>(new Set(['Lead']));
  const [copied, setCopied] = useState(false);
  const [setupCopied, setSetupCopied] = useState(false);
  const [setupActivated, setSetupActivated] = useState(false);
  const [setupRunning, setSetupRunning] = useState(false);
  const createdNewRef = useRef(false);

  const integrationIdParam = searchParams.get('id') ?? searchParams.get('integrationId') ?? undefined;
  const isNewPixel = searchParams.get('new') === '1' || searchParams.get('new') === 'true';

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const shouldCreateNew = isNewPixel && !integrationIdParam && !createdNewRef.current;
      if (shouldCreateNew) createdNewRef.current = true;

      const wizard = await fetchTikTokIntegrationWizard(
        integrationIdParam,
        shouldCreateNew,
      );

      if (
        wizard.integration.wizardCompleted &&
        !shouldCreateNew &&
        !integrationIdParam
      ) {
        router.replace('/tiktok/integration');
        return;
      }

      setState(wizard);
      setStep(
        shouldCreateNew
          ? 1
          : wizard.integration.wizardCompleted
            ? 6
            : Math.min(wizard.integration.wizardStep, 5),
      );
      setSelectedAdvertiser(wizard.integration.advertiserId ?? '');
      setWhatsappNumber(wizard.integration.whatsappNumber ?? '');
      setOptimizationEvent(wizard.integration.defaultOptimizationEvent ?? 'Lead');
      setCustomEventName(wizard.integration.customEventName ?? '');
      const enabled = new Set(
        wizard.optimizationEvents.filter((e) => e.enabled).map((e) => e.eventName),
      );
      if (enabled.size === 0) {
        enabled.add(wizard.integration.defaultOptimizationEvent ?? 'Lead');
      }
      setEnabledEvents(enabled);
      if (shouldCreateNew && wizard.integration.id) {
        router.replace(`/tiktok/integration/wizard?id=${wizard.integration.id}`);
      }
    } catch (err) {
      setError(parseApiError(err));
    } finally {
      setLoading(false);
    }
  }, [integrationIdParam, isNewPixel, router]);

  useEffect(() => {
    load().catch(console.error);
    if (searchParams.get('connected') === '1' || searchParams.get('connected') === 'true') {
      setNotice(t('tiktokIntegration.connectedSuccess'));
      setStep(2);
    }
  }, [load, searchParams, t]);

  const integrationId = state?.integration.id;

  const filteredAdvertisers = useMemo(() => {
    const list = state?.advertisers ?? [];
    const q = advertiserSearch.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (a) =>
        a.advertiserId.toLowerCase().includes(q) ||
        (a.name?.toLowerCase().includes(q) ?? false),
    );
  }, [state?.advertisers, advertiserSearch]);

  const integration = state?.integration;

  function applyIntegration(integration: TikTokIntegrationView) {
    setState((prev) => (prev ? { ...prev, integration } : prev));
    if (integration.wizardCompleted) setStep(6);
    else setStep(Math.min(integration.wizardStep, 5));
  }

  async function connectTikTok() {
    setBusy(true);
    setError(null);
    try {
      const { authUrl } = await startTikTokIntegrationOAuth(integrationId);
      window.location.href = authUrl;
    } catch (err) {
      setError(parseApiError(err));
      setBusy(false);
    }
  }

  async function saveAdvertiser() {
    if (!selectedAdvertiser) return;
    setBusy(true);
    setError(null);
    try {
      const adv = state?.advertisers.find((a) => a.advertiserId === selectedAdvertiser);
      const integration = await saveTikTokIntegrationAdvertiser(selectedAdvertiser, {
        advertiserName: adv?.name ?? undefined,
        integrationId,
        createNewPixel: false,
      });
      applyIntegration(integration);
      setStep(3);
      setNotice(t('tiktokIntegration.advertiserSaved'));
    } catch (err) {
      setError(parseApiError(err));
    } finally {
      setBusy(false);
    }
  }

  async function saveWhatsapp() {
    setBusy(true);
    setError(null);
    try {
      const integration = await saveTikTokIntegrationWhatsapp(whatsappNumber, integrationId);
      applyIntegration(integration);
      setStep(integration.pixelId ? 5 : 4);
      setNotice(t('tiktokIntegration.whatsappSaved'));
    } catch (err) {
      setError(parseApiError(err));
    } finally {
      setBusy(false);
    }
  }

  async function createPixel() {
    if (integration?.pixelId) {
      setStep(5);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const integration = await createTikTokIntegrationPixel(pixelName || undefined, integrationId);
      applyIntegration(integration);
      setStep(5);
      setNotice(t('tiktokIntegration.pixelCreated'));
    } catch (err) {
      setError(parseApiError(err));
    } finally {
      setBusy(false);
    }
  }

  function selectDefaultEvent(event: TikTokOptimizationEvent) {
    setOptimizationEvent(event);
    setEnabledEvents((prev) => new Set([...prev, event]));
  }

  function toggleEnabledEvent(event: TikTokOptimizationEvent) {
    if (event === optimizationEvent) return;
    setEnabledEvents((prev) => {
      const next = new Set(prev);
      if (next.has(event)) next.delete(event);
      else next.add(event);
      return next;
    });
  }

  const runAutoSetup = useCallback(async (target?: TikTokIntegrationView) => {
    const current = target ?? integration;
    if (!current?.id) return;
    setSetupRunning(true);
    setSetupActivated(false);
    try {
      const result = await runTikTokSetupAutomation(current);
      setSetupActivated(result.activated);
      if (result.activated && current.id) {
        const wizard = await fetchTikTokIntegrationWizard(current.id);
        setState(wizard);
      }
    } finally {
      setSetupRunning(false);
    }
  }, [integration]);

  async function finishWizard() {
    setBusy(true);
    setError(null);
    try {
      const integration = await saveTikTokIntegrationOptimizationEvent({
        defaultOptimizationEvent: optimizationEvent,
        customEventName: optimizationEvent === 'Custom' ? customEventName : undefined,
        enabledEvents: Array.from(enabledEvents),
        integrationId,
      });
      applyIntegration(integration);
      setStep(6);
      setNotice(t('tiktokIntegration.wizardComplete'));
      void runAutoSetup(integration);
    } catch (err) {
      setError(parseApiError(err));
    } finally {
      setBusy(false);
    }
  }

  async function copyTrackingUrl() {
    if (!integration?.trackingUrl) return;
    await navigator.clipboard.writeText(integration.trackingUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function copySetupPageUrl() {
    if (!integration?.setupPageUrl) return;
    await navigator.clipboard.writeText(integration.setupPageUrl);
    setSetupCopied(true);
    setTimeout(() => setSetupCopied(false), 2000);
  }

  function goBack() {
    setError(null);
    setNotice(null);
    setStep((current) => Math.max(1, current - 1));
  }

  function WizardActions({
    onContinue,
    continueDisabled,
    continueLabel,
    showBack = true,
  }: {
    onContinue: () => void;
    continueDisabled?: boolean;
    continueLabel?: string;
    showBack?: boolean;
  }) {
    return (
      <div className="flex flex-wrap gap-2 pt-2">
        {showBack && step > 1 && (
          <Button type="button" variant="outline" onClick={goBack} disabled={busy}>
            <ChevronLeft className="me-2 h-4 w-4" />
            {t('common.back')}
          </Button>
        )}
        <Button type="button" onClick={onContinue} disabled={busy || continueDisabled}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : (continueLabel ?? t('tiktokIntegration.continue'))}
        </Button>
      </div>
    );
  }

  return (
    <>
      <PageHeader title={t('tiktokIntegration.nav.wizard')} description={t('tiktokIntegration.wizardDesc')} />
      {isNewPixel && <AlertBanner className="mt-4" variant="info">{t('tiktokIntegration.newPixelSetup')}</AlertBanner>}
      {notice && <AlertBanner className="mt-4" variant="success">{notice}</AlertBanner>}
      {error && <AlertBanner className="mt-4" variant="error">{error}</AlertBanner>}

      <div className="mt-6 flex flex-wrap gap-2">
        {STEPS.map((s) => (
          <Badge
            key={s}
            variant={step === s ? 'default' : step > s ? 'success' : 'secondary'}
            className="gap-1"
          >
            {step > s && <Check className="h-3 w-3" />}
            {t(`tiktokIntegration.wizard.step${s}`)}
          </Badge>
        ))}
      </div>

      {loading ? (
        <div className="mt-8 flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t('common.loading')}
        </div>
      ) : (
        <Card className="mt-6 border-0 shadow-card">
          <CardContent className="pt-6">
            {step === 1 && (
              <div className="space-y-4">
                <CardHeader className="p-0">
                  <CardTitle>{t('tiktokIntegration.wizard.step1Title')}</CardTitle>
                  <CardDescription>{t('tiktokIntegration.wizard.step1Desc')}</CardDescription>
                </CardHeader>
                {state?.marketingConnected ? (
                  <AlertBanner variant="success">{t('tiktokIntegration.alreadyConnected')}</AlertBanner>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  {!state?.marketingConnected && (
                    <Button onClick={() => void connectTikTok()} disabled={busy}>
                      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : t('tiktokIntegration.connectTikTok')}
                    </Button>
                  )}
                  {state?.marketingConnected && (
                    <Button onClick={() => setStep(2)}>
                      {t('tiktokIntegration.continue')} <ChevronRight className="ms-2 h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4">
                <CardHeader className="p-0">
                  <CardTitle>{t('tiktokIntegration.wizard.step2Title')}</CardTitle>
                  <CardDescription>{t('tiktokIntegration.wizard.step2Desc')}</CardDescription>
                </CardHeader>
                <div className="relative">
                  <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    className="ps-9"
                    placeholder={t('tiktokIntegration.searchAdvertisers')}
                    value={advertiserSearch}
                    onChange={(e) => setAdvertiserSearch(e.target.value)}
                  />
                </div>
                <div className="max-h-64 space-y-2 overflow-y-auto rounded-md border p-2">
                  {filteredAdvertisers.length === 0 ? (
                    <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                      {advertiserSearch.trim()
                        ? t('tiktokIntegration.noAdvertiserSearchResults')
                        : t('tiktokIntegration.noAdvertisers')}
                    </p>
                  ) : (
                    filteredAdvertisers.map((a) => (
                      <button
                        key={a.advertiserId}
                        type="button"
                        className={cn(
                          'flex w-full cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-left text-sm hover:bg-muted',
                          selectedAdvertiser === a.advertiserId && 'bg-primary/10 font-medium ring-1 ring-primary',
                        )}
                        onClick={() => setSelectedAdvertiser(a.advertiserId)}
                      >
                        {a.name ? `${a.name} — ${a.advertiserId}` : a.advertiserId}
                      </button>
                    ))
                  )}
                </div>
                <WizardActions
                  onContinue={() => void saveAdvertiser()}
                  continueDisabled={!selectedAdvertiser}
                />
              </div>
            )}

            {step === 3 && (
              <div className="space-y-4">
                <CardHeader className="p-0">
                  <CardTitle>{t('tiktokIntegration.wizard.step3Title')}</CardTitle>
                  <CardDescription>{t('tiktokIntegration.wizard.step3Desc')}</CardDescription>
                </CardHeader>
                <div className="space-y-2">
                  <Label>{t('tiktokIntegration.whatsappNumber')}</Label>
                  <Input
                    inputMode="tel"
                    placeholder="9647xxxxxxxxx"
                    value={whatsappNumber}
                    onChange={(e) => setWhatsappNumber(e.target.value)}
                  />
                </div>
                <WizardActions
                  onContinue={() => void saveWhatsapp()}
                  continueDisabled={whatsappNumber.length < 8}
                />
              </div>
            )}

            {step === 4 && (
              <div className="space-y-4">
                <CardHeader className="p-0">
                  <CardTitle>{t('tiktokIntegration.wizard.step4Title')}</CardTitle>
                  <CardDescription>{t('tiktokIntegration.wizard.step4Desc')}</CardDescription>
                </CardHeader>
                {integration?.pixelId ? (
                  <AlertBanner variant="success">
                    {t('tiktokIntegration.pixelExists')}: {integration.pixelId}
                    {integration.pixelName ? ` (${integration.pixelName})` : ''}
                  </AlertBanner>
                ) : (
                  <div className="space-y-2">
                    <Label>{t('tiktokIntegration.pixelName')}</Label>
                    <Input
                      placeholder={t('tiktokIntegration.pixelNamePlaceholder')}
                      value={pixelName}
                      onChange={(e) => setPixelName(e.target.value)}
                    />
                  </div>
                )}
                {integration?.manualSetupRequired && (
                  <AlertBanner variant="warning">{t('tiktokIntegration.manualSetupRequired')}</AlertBanner>
                )}
                <WizardActions
                  onContinue={() => void createPixel()}
                  continueLabel={integration?.pixelId ? t('tiktokIntegration.continue') : t('tiktokIntegration.createPixel')}
                />
              </div>
            )}

            {step === 5 && (
              <div className="space-y-4">
                <CardHeader className="p-0">
                  <CardTitle>{t('tiktokIntegration.wizard.step5Title')}</CardTitle>
                  <CardDescription>{t('tiktokIntegration.wizard.step5Desc')}</CardDescription>
                </CardHeader>

                <AlertBanner variant="info">{t('tiktokIntegration.adsManagerDisclaimer')}</AlertBanner>

                <p className="text-sm text-muted-foreground">{t('tiktokIntegration.enabledEventsHint')}</p>

                <div className="space-y-2">
                  {OPTIMIZATION_EVENT_OPTIONS.map((event) => {
                    const isDefault = optimizationEvent === event;
                    const isEnabled = enabledEvents.has(event);
                    const desc = t(`tiktokIntegration.eventDesc.${event}`);
                    return (
                      <div
                        key={event}
                        className={cn(
                          'flex gap-3 rounded-lg border p-3 transition-colors',
                          isDefault && 'border-primary bg-primary/5',
                        )}
                      >
                        <div className="flex shrink-0 flex-col items-center gap-2 pt-0.5">
                          <button
                            type="button"
                            title={t('tiktokIntegration.defaultEvent')}
                            className={cn(
                              'h-4 w-4 rounded-full border-2',
                              isDefault ? 'border-primary bg-primary' : 'border-muted-foreground',
                            )}
                            onClick={() => selectDefaultEvent(event)}
                          />
                          <input
                            type="checkbox"
                            className="h-4 w-4 rounded border-muted-foreground"
                            checked={isEnabled}
                            disabled={isDefault}
                            onChange={() => toggleEnabledEvent(event)}
                            title={t('tiktokIntegration.enableEvent')}
                          />
                        </div>
                        <button
                          type="button"
                          className="min-w-0 flex-1 text-left"
                          onClick={() => selectDefaultEvent(event)}
                        >
                          <p className="font-medium">{t(`tiktokIntegration.events.${event}`)}</p>
                          {desc && (
                            <p className="text-xs text-muted-foreground">{desc}</p>
                          )}
                          {isDefault && (
                            <p className="mt-1 text-xs font-medium text-primary">
                              {t('tiktokIntegration.defaultEventBadge')}
                            </p>
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>

                {optimizationEvent === 'Custom' && (
                  <div className="space-y-2">
                    <Label>{t('tiktokIntegration.customEventName')}</Label>
                    <Input
                      value={customEventName}
                      onChange={(e) => setCustomEventName(e.target.value)}
                      placeholder="MyCustomEvent"
                    />
                  </div>
                )}

                {integration?.trackingUrl && (
                  <div className="rounded-lg border bg-muted/30 p-3 text-sm">
                    <p className="font-medium">{t('tiktokIntegration.trackingUrl')}</p>
                    <code className="mt-1 block break-all text-xs">{integration.trackingUrl}</code>
                    <p className="mt-2 text-muted-foreground">
                      {t('tiktokIntegration.selectedEvent')}:{' '}
                      <strong>
                        {optimizationEvent === 'Custom'
                          ? customEventName || 'Custom'
                          : t(`tiktokIntegration.events.${optimizationEvent}`)}
                      </strong>
                    </p>
                  </div>
                )}

                <WizardActions
                  onContinue={() => void finishWizard()}
                  continueLabel={t('tiktokIntegration.finishWizard')}
                />
              </div>
            )}

            {step === 6 && integration && (
              <div className="space-y-4">
                <CardHeader className="p-0">
                  <CardTitle className="flex items-center gap-2">
                    <PartyPopper className="h-5 w-5 text-primary" />
                    {t('tiktokIntegration.wizard.step6Title')}
                  </CardTitle>
                  <CardDescription>{t('tiktokIntegration.wizard.step6Desc')}</CardDescription>
                </CardHeader>

                <div className="rounded-lg border-2 border-primary/30 bg-primary/5 p-4">
                  <p className="text-sm font-medium">{t('tiktokIntegration.trackingUrl')}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <code className="min-w-0 flex-1 break-all rounded bg-background px-3 py-2 text-sm">
                      {integration.trackingUrl}
                    </code>
                    <Button variant="outline" size="icon" onClick={() => void copyTrackingUrl()}>
                      {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                    </Button>
                    <Button variant="outline" size="icon" asChild>
                      <a href={integration.trackingUrl} target="_blank" rel="noreferrer">
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </Button>
                  </div>
                </div>

                {integration.setupPageUrl && (
                  <div className="rounded-lg border-2 border-amber-500/30 bg-amber-500/5 p-4">
                    <p className="text-sm font-medium">{t('tiktokIntegration.setupPageUrl')}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{t('tiktokIntegration.setupPageUrlHint')}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <code className="min-w-0 flex-1 break-all rounded bg-background px-3 py-2 text-sm">
                        {integration.setupPageUrl}
                      </code>
                      <Button variant="outline" size="icon" onClick={() => void copySetupPageUrl()}>
                        {setupCopied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                      </Button>
                      <Button variant="outline" size="icon" asChild>
                        <a href={integration.setupPageUrl} target="_blank" rel="noreferrer">
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </Button>
                    </div>
                  </div>
                )}

                {setupRunning && (
                  <AlertBanner variant="info" className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
                    {t('tiktokIntegration.autoSetupRunning')}
                  </AlertBanner>
                )}
                {!setupRunning && setupActivated && (
                  <AlertBanner variant="success">{t('tiktokIntegration.autoSetupSuccess')}</AlertBanner>
                )}

                <div className="grid gap-4 rounded-lg border p-4 sm:grid-cols-2">
                  <div>
                    <p className="text-xs text-muted-foreground">{t('tiktokIntegration.pixelId')}</p>
                    <p className="font-mono text-sm">{integration.pixelId ?? '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{t('tiktokIntegration.selectedEvent')}</p>
                    <p className="text-sm font-medium">
                      {integration.defaultOptimizationEvent === 'Custom'
                        ? integration.customEventName ?? 'Custom'
                        : t(`tiktokIntegration.events.${integration.defaultOptimizationEvent}`)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{t('tiktokIntegration.whatsappNumber')}</p>
                    <p className="font-mono text-sm">{integration.whatsappNumber ?? '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{t('tiktokIntegration.enabledEvents')}</p>
                    <p className="text-sm">
                      {integration.eventConfigurations
                        .filter((c) => c.enabled)
                        .map((c) => t(`tiktokIntegration.events.${c.eventName}`))
                        .join(' · ') || '—'}
                    </p>
                  </div>
                </div>

                <AlertBanner variant="info">{t('tiktokIntegration.pixelActivationHint')}</AlertBanner>
                {integration.manualSetupRequired && (
                  <AlertBanner variant="warning">{t('tiktokIntegration.manualSetupRequired')}</AlertBanner>
                )}
                <AlertBanner variant="info">{t('tiktokIntegration.adsManagerDisclaimer')}</AlertBanner>

                <div className="flex flex-wrap gap-2">
                  {integration.setupPageUrl && (
                    <Button variant="outline" onClick={() => void runAutoSetup()} disabled={setupRunning}>
                      {setupRunning ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : null}
                      {t('tiktokIntegration.autoSetupRetry')}
                    </Button>
                  )}
                  <Button asChild>
                    <Link href="/tiktok/integration">{t('tiktokIntegration.nav.dashboard')}</Link>
                  </Button>
                  <Button variant="outline" onClick={() => setStep(5)}>
                    {t('tiktokIntegration.editEvents')}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </>
  );
}

export default function TikTokIntegrationWizardPage() {
  return (
    <TikTokIntegrationShell>
      <Suspense
        fallback={
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
          </div>
        }
      >
        <WizardInner />
      </Suspense>
    </TikTokIntegrationShell>
  );
}
