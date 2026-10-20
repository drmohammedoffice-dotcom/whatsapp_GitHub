'use client';

import { SOCKET_EVENTS } from '@watsapp/shared';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  Copy,
  Loader2,
  Check,
  MousePointerClick,
  Users,
  Percent,
  Plus,
  ExternalLink,
  Pencil,
  Trash2,
} from 'lucide-react';
import { TikTokIntegrationShell } from '@/components/tiktok/tiktok-integration-shell';
import { PixelEditDialog } from '@/components/tiktok/pixel-edit-dialog';
import { useTranslation } from '@/components/providers/locale-provider';
import { AlertBanner } from '@/components/shared/alert-banner';
import { PageHeader } from '@/components/shared/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  deleteTikTokIntegration,
  fetchTikTokIntegrationDashboard,
  resyncTikTokEcommerceEvents,
  updateTikTokIntegration,
  type TikTokIntegrationDashboard,
  type TikTokIntegrationDashboardItem,
  type TikTokIntegrationView,
} from '@/lib/tiktok-integration';
import { listInstantForms } from '@/lib/instant-forms/api';
import { createSocket } from '@/lib/socket';
import { parseApiError } from '@/lib/utils';
import { runTikTokSetupAutomation } from '@/lib/tiktok-pixel-setup';

const DASHBOARD_POLL_MS = 5000;

function PixelCard({
  item,
  disclaimer,
  onEdit,
  onDelete,
}: {
  item: TikTokIntegrationDashboardItem;
  disclaimer?: string;
  onEdit: (integration: TikTokIntegrationView) => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [activating, setActivating] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [activateError, setActivateError] = useState<string | null>(null);
  const [activateSuccess, setActivateSuccess] = useState(false);
  const [formOptions, setFormOptions] = useState<Array<{ id: string; name: string; status: string }>>([]);
  const [selectedFormId, setSelectedFormId] = useState(item.integration.linkedFormId || '');
  const [linkingForm, setLinkingForm] = useState(false);
  const [linkFormError, setLinkFormError] = useState<string | null>(null);
  const [linkFormSuccess, setLinkFormSuccess] = useState<string | null>(null);

  async function copyUrl() {
    await navigator.clipboard.writeText(item.integration.trackingUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const isEcommercePixel =
    item.integration.destinationType === 'STORE'
    || item.integration.destinationType === 'INSTANT_FORM'
    || Boolean(item.integration.externalRedirectUrl?.includes('/s/'))
    || Boolean(item.integration.externalRedirectUrl?.includes('/f/'));

  const isInstantFormPixel =
    item.integration.destinationType === 'INSTANT_FORM'
    || Boolean(item.integration.externalRedirectUrl?.includes('/f/'));

  useEffect(() => {
    if (!isInstantFormPixel) return;
    setSelectedFormId(item.integration.linkedFormId || '');
    void listInstantForms()
      .then((rows) =>
        setFormOptions(
          rows
            .filter((f) => f.status !== 'ARCHIVED')
            .map((f) => ({ id: f.id, name: f.name, status: f.status })),
        ),
      )
      .catch(() => setFormOptions([]));
  }, [isInstantFormPixel, item.integration.linkedFormId, item.integration.id]);

  async function handleLinkForm() {
    if (!selectedFormId) {
      setLinkFormError('اختر استمارة فورية لربطها برابط التتبع');
      return;
    }
    setLinkingForm(true);
    setLinkFormError(null);
    setLinkFormSuccess(null);
    try {
      await updateTikTokIntegration(item.integration.id, {
        destinationType: 'INSTANT_FORM',
        instantFormId: selectedFormId,
      });
      setLinkFormSuccess('تم ربط الاستمارة برابط التتبع ونشرها إن كانت مسودة');
      onDelete();
    } catch (err) {
      setLinkFormError(parseApiError(err));
    } finally {
      setLinkingForm(false);
    }
  }

  async function handleActivate() {
    setActivating(true);
    setActivateError(null);
    setActivateSuccess(false);
    try {
      if (isEcommercePixel) {
        const result = await resyncTikTokEcommerceEvents(item.integration.id);
        if ((result as { ok?: boolean }).ok === false) {
          throw new Error(
            String((result as { message?: string }).message || 'تعذرت مزامنة الأحداث مع تيك توك'),
          );
        }
        setActivateSuccess(true);
      } else {
        const result = await runTikTokSetupAutomation(item.integration);
        setActivateSuccess(result.activated);
      }
      onDelete();
    } catch (err) {
      setActivateError(parseApiError(err));
    } finally {
      setActivating(false);
    }
  }

  const needsActivation =
    item.integration.wizardCompleted &&
    item.integration.pixelId &&
    (isEcommercePixel
      || ['waiting_for_activity', 'pending', 'unknown'].includes(item.integration.pixelStatus));

  async function handleDelete() {
    if (!window.confirm(t('tiktokIntegration.deletePixelConfirm'))) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteTikTokIntegration(item.integration.id);
      onDelete();
    } catch (err) {
      setDeleteError(parseApiError(err));
    } finally {
      setDeleting(false);
    }
  }

  const displayName =
    item.integration.name ||
    item.integration.pixelName ||
    item.integration.pixelId ||
    t('tiktokIntegration.unnamedPixel');

  const eventsConnected =
    item.integration.eventsApiConnected || item.integration.eventsApiStatus === 'connected';

  return (
    <Card className="min-w-0 overflow-hidden border-0 shadow-card">
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div className="min-w-0 flex-1 overflow-hidden">
          <CardTitle className="truncate text-base">{displayName}</CardTitle>
          {item.integration.advertiserName && (
            <p className="mt-1 text-xs text-muted-foreground">{item.integration.advertiserName}</p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant={eventsConnected ? 'success' : 'secondary'}>
            {eventsConnected
              ? t('tiktokIntegration.eventsApi.connected')
              : t('tiktokIntegration.eventsApi.disconnected')}
          </Badge>
          <Badge
            variant={
              item.integration.pixelStatus === 'active'
                ? 'success'
                : item.integration.pixelStatus === 'waiting_for_activity'
                  ? 'secondary'
                  : item.integration.wizardCompleted
                    ? 'success'
                    : 'secondary'
            }
          >
            {item.integration.pixelStatus === 'active'
              ? t('tiktokIntegration.statusActive')
              : item.integration.pixelStatus === 'waiting_for_activity'
                ? t('tiktokIntegration.statusWaiting')
                : item.integration.manualSetupRequired
                  ? t('tiktokIntegration.statusManualSetup')
                  : item.integration.wizardCompleted
                    ? t('tiktokIntegration.statusActive')
                    : t('tiktokIntegration.statusDraft')}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="min-w-0 space-y-4 overflow-hidden">
        {!item.integration.wizardCompleted && (
          <AlertBanner variant="warning">
            {t('tiktokIntegration.notConfigured')}{' '}
            <Link
              href={`/tiktok/integration/wizard?id=${item.integration.id}`}
              className="font-medium underline"
            >
              {t('tiktokIntegration.completeWizard')}
            </Link>
          </AlertBanner>
        )}

        {item.integration.manualSetupRequired && (
          <AlertBanner variant="warning">{t('tiktokIntegration.manualSetupRequired')}</AlertBanner>
        )}

        {item.integration.whatsappNumber && item.integration.whatsappConnected === false ? (
          <AlertBanner variant="warning" className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <span>
              {t('tiktokIntegration.whatsappNotConnected').replace(
                '{phone}',
                item.integration.whatsappNumber,
              )}
            </span>
            <Link href="/tiktok/integration/phones">
              <Button size="sm" variant="outline">
                {t('tiktokIntegration.connectWhatsapp')}
              </Button>
            </Link>
          </AlertBanner>
        ) : null}

        {needsActivation && (
          <AlertBanner variant="info" className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <span>
              {isEcommercePixel
                ? 'أحداث المتجر/الاستمارة لم تظهر بعد كهدف تحسين في تيك توك؟ اضغط لمزامنة CompletePayment/Lead الآن.'
                : t('tiktokIntegration.pixelActivationHint')}
            </span>
            <Button size="sm" onClick={() => void handleActivate()} disabled={activating}>
              {activating ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : null}
              {isEcommercePixel ? 'مزامنة أحداث تيك توك' : t('tiktokIntegration.activatePixel')}
            </Button>
          </AlertBanner>
        )}

        {activateSuccess && (
          <AlertBanner variant="success">
            {isEcommercePixel
              ? 'تمت مزامنة الأحداث مع تيك توك. افتح Events Manager وحدّث الصفحة خلال دقائق لرؤية CompletePayment/Lead.'
              : t('tiktokIntegration.autoSetupSuccess')}
          </AlertBanner>
        )}

        <div className="grid min-w-0 gap-4 md:grid-cols-2">
          <div>
            <p className="text-xs text-muted-foreground">{t('tiktokIntegration.pixelStatus')}</p>
            <p className="text-sm font-medium">
              {t(`tiktokIntegration.pixelStatuses.${item.integration.pixelStatus}`)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{t('tiktokIntegration.optimizationEvent')}</p>
            <p className="text-sm font-medium">
              {item.integration.defaultOptimizationEvent === 'Custom'
                ? item.integration.customEventName ?? 'Custom'
                : t(`tiktokIntegration.events.${item.integration.defaultOptimizationEvent}`)}
            </p>
          </div>
          {item.integration.eventConfigurations.some((c) => c.enabled) && (
            <div className="md:col-span-2">
              <p className="text-xs text-muted-foreground">{t('tiktokIntegration.enabledEvents')}</p>
              <p className="mt-1 text-sm">
                {item.integration.eventConfigurations
                  .filter((c) => c.enabled)
                  .map((c) => t(`tiktokIntegration.events.${c.eventName}`))
                  .join(' · ')}
              </p>
            </div>
          )}
          <div className="min-w-0 md:col-span-2">
            <p className="text-xs text-muted-foreground">{t('tiktokIntegration.trackingUrl')}</p>
            <div className="mt-1 flex min-w-0 items-start gap-2">
              <code
                dir="ltr"
                className="min-w-0 flex-1 overflow-hidden break-all rounded bg-muted px-2 py-1.5 text-[11px] leading-relaxed sm:text-xs"
              >
                {item.integration.trackingUrl}
              </code>
              <Button variant="outline" size="icon" className="shrink-0" onClick={() => void copyUrl()}>
                {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
              </Button>
              <Button variant="outline" size="icon" className="shrink-0" asChild>
                <a href={item.integration.trackingUrl} target="_blank" rel="noreferrer">
                  <ExternalLink className="h-4 w-4" />
                </a>
              </Button>
            </div>
            <p className="mt-1 break-words text-xs leading-relaxed text-muted-foreground">{t('tiktokIntegration.trackingUrlHint')}</p>
          </div>
        </div>

        {isInstantFormPixel ? (
          <div className="space-y-3 rounded-xl border border-teal-200 bg-teal-50/60 p-4">
            <div>
              <p className="text-sm font-medium text-teal-950">الاستمارة الفورية المرتبطة</p>
              <p className="mt-1 text-xs text-teal-900/80">
                {item.integration.linkedFormName
                  ? `الحالية: ${item.integration.linkedFormName}${item.integration.linkedFormStatus === 'DRAFT' ? ' (مسودة)' : ''}`
                  : 'لم يتم ربط استمارة صحيحة بعد — اختر الاستمارة التي أنشأتها ليعمل رابط التتبع.'}
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <select
                className="h-10 flex-1 rounded-xl border bg-background px-3 text-sm outline-none focus:border-teal-400"
                value={selectedFormId}
                onChange={(e) => setSelectedFormId(e.target.value)}
              >
                <option value="">اختر استمارة فورية…</option>
                {formOptions.map((form) => (
                  <option key={form.id} value={form.id}>
                    {form.name}
                    {form.status === 'DRAFT' ? ' (مسودة)' : ''}
                  </option>
                ))}
              </select>
              <Button size="sm" disabled={linkingForm || !selectedFormId} onClick={() => void handleLinkForm()}>
                {linkingForm ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : null}
                ربط برابط التتبع
              </Button>
              <Button asChild size="sm" variant="outline">
                <Link href="/tiktok/integration/forms/new">إنشاء استمارة</Link>
              </Button>
            </div>
            {item.integration.linkedFormUrl ? (
              <a
                href={item.integration.linkedFormUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs font-medium text-teal-800 underline"
              >
                فتح الاستمارة المرتبطة
                <ExternalLink className="h-3 w-3" />
              </a>
            ) : null}
            {linkFormError ? <p className="text-sm text-destructive">{linkFormError}</p> : null}
            {linkFormSuccess ? <p className="text-sm text-teal-800">{linkFormSuccess}</p> : null}
          </div>
        ) : null}

        {item.integration.wizardCompleted && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="flex items-center gap-3 rounded-lg border p-3">
              <MousePointerClick className="h-5 w-5 text-primary" />
              <div>
                <p className="text-xs text-muted-foreground">{t('tiktokIntegration.stats.clicks')}</p>
                <p className="text-lg font-bold">{item.stats.clicks}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-lg border p-3">
              <Users className="h-5 w-5 text-primary" />
              <div>
                <p className="text-xs text-muted-foreground">{t('tiktokIntegration.stats.contactEvents')}</p>
                <p className="text-lg font-bold">{item.stats.contactEvents ?? item.stats.leads}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-lg border p-3">
              <Users className="h-5 w-5 text-primary" />
              <div>
                <p className="text-xs text-muted-foreground">{t('tiktokIntegration.stats.leadEvents')}</p>
                <p className="text-lg font-bold">{item.stats.leadEvents ?? 0}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-lg border p-3">
              <Percent className="h-5 w-5 text-primary" />
              <div>
                <p className="text-xs text-muted-foreground">{t('tiktokIntegration.stats.conversionRate')}</p>
                <p className="text-lg font-bold">{item.stats.conversionRate}%</p>
              </div>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">{t('tiktokIntegration.stats.purchaseEvents')}</p>
              <p className="text-lg font-bold">{item.stats.purchaseEvents ?? 0}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">{t('tiktokIntegration.stats.registrationEvents')}</p>
              <p className="text-lg font-bold">{item.stats.registrationEvents ?? 0}</p>
            </div>
            {isInstantFormPixel ? (
              <div className="rounded-lg border border-teal-200 bg-teal-50/50 p-3">
                <p className="text-xs text-teal-800">طلبات الاستمارة المرتبطة</p>
                <p className="text-lg font-bold text-teal-950">{item.stats.formOrders ?? 0}</p>
              </div>
            ) : null}
          </div>
        )}

        {disclaimer && item.integration.wizardCompleted && (
          <p className="text-xs text-muted-foreground">{disclaimer}</p>
        )}

        <div className="flex flex-wrap gap-2 border-t pt-4">
          {needsActivation && (
            <Button variant="default" size="sm" onClick={() => void handleActivate()} disabled={activating}>
              {activating ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : null}
              {t('tiktokIntegration.activatePixel')}
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => onEdit(item.integration)}>
            <Pencil className="me-2 h-4 w-4" />
            {t('tiktokIntegration.editPixel')}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-destructive hover:text-destructive"
            onClick={() => void handleDelete()}
            disabled={deleting}
          >
            {deleting ? (
              <Loader2 className="me-2 h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="me-2 h-4 w-4" />
            )}
            {t('tiktokIntegration.deletePixel')}
          </Button>
        </div>
        {deleteError && <p className="text-sm text-destructive">{deleteError}</p>}
        {activateError && <p className="text-sm text-destructive">{activateError}</p>}
      </CardContent>
    </Card>
  );
}

export default function TikTokIntegrationDashboardPage() {
  const { t, locale } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<TikTokIntegrationDashboard | null>(null);
  const [editing, setEditing] = useState<TikTokIntegrationView | null>(null);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async (options?: { silent?: boolean }) => {
    const silent = options?.silent ?? false;
    if (silent) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    try {
      setData(await fetchTikTokIntegrationDashboard(30));
      setError(null);
    } catch (err) {
      if (!silent) {
        setError(parseApiError(err));
      }
    } finally {
      if (silent) {
        setRefreshing(false);
      } else {
        setLoading(false);
      }
    }
  }, []);

  const scheduleRefresh = useCallback(() => {
    if (refreshTimerRef.current) return;
    refreshTimerRef.current = setTimeout(() => {
      refreshTimerRef.current = null;
      void load({ silent: true });
    }, 400);
  }, [load]);

  useEffect(() => {
    void load();
    const socket = createSocket();
    socket.on(SOCKET_EVENTS.TIKTOK_INTEGRATION_UPDATED, scheduleRefresh);

    const poll = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void load({ silent: true });
      }
    }, DASHBOARD_POLL_MS);

    return () => {
      socket.off(SOCKET_EVENTS.TIKTOK_INTEGRATION_UPDATED, scheduleRefresh);
      socket.disconnect();
      window.clearInterval(poll);
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
    };
  }, [load, scheduleRefresh]);

  const disclaimer = locale === 'ar' ? data?.disclaimer.ar : data?.disclaimer.en;
  const items = [...(data?.integrations ?? [])].sort((a, b) => {
    const aTs = a.integration.createdAt ? Date.parse(a.integration.createdAt) : 0;
    const bTs = b.integration.createdAt ? Date.parse(b.integration.createdAt) : 0;
    return bTs - aTs;
  });

  return (
    <TikTokIntegrationShell>
      <PageHeader
        title={t('tiktokIntegration.nav.dashboard')}
        description={t('tiktokIntegration.dashboardDesc')}
        actions={
          <div className="flex flex-wrap items-center gap-3">
            {refreshing ? (
              <span className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                {t('common.loading')}
              </span>
            ) : null}
            <Link href="/tiktok/integration/wizard?new=1">
              <Button size="sm">
                <Plus className="me-2 h-4 w-4" />
                {t('tiktokIntegration.createNewPixel')}
              </Button>
            </Link>
          </div>
        }
      />
      {error && <AlertBanner className="mt-4" variant="error">{error}</AlertBanner>}

      {loading ? (
        <div className="mt-8 flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t('common.loading')}
        </div>
      ) : data ? (
        <div className="mt-6 space-y-6">
          {!data.configured && items.length === 0 && (
            <AlertBanner variant="warning">
              {t('tiktokIntegration.notConfigured')}{' '}
              <Link href="/tiktok/integration/wizard" className="font-medium underline">
                {t('tiktokIntegration.completeWizard')}
              </Link>
            </AlertBanner>
          )}

          {items.length === 0 ? (
            <Card className="border-0 shadow-card">
              <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
                <p className="text-muted-foreground">{t('tiktokIntegration.noPixelsYet')}</p>
                <Link href="/tiktok/integration/wizard?new=1">
                  <Button>
                    <Plus className="me-2 h-4 w-4" />
                    {t('tiktokIntegration.createFirstPixel')}
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                {t('tiktokIntegration.pixelCount').replace('{count}', String(items.length))}
              </p>
              {items.map((item) => (
                <PixelCard
                  key={item.integration.id}
                  item={item}
                  disclaimer={disclaimer}
                  onEdit={setEditing}
                  onDelete={() => void load({ silent: true })}
                />
              ))}
            </>
          )}
        </div>
      ) : null}

      <PixelEditDialog
        integration={editing}
        open={Boolean(editing)}
        onOpenChange={(open) => !open && setEditing(null)}
        onSaved={() => void load({ silent: true })}
      />
    </TikTokIntegrationShell>
  );
}
