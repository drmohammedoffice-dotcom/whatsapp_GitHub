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
  PlugZap,
} from 'lucide-react';
import { TikTokIntegrationShell } from '@/components/tiktok/tiktok-integration-shell';
import { PixelEditDialog } from '@/components/tiktok/pixel-edit-dialog';
import { useTranslation } from '@/components/providers/locale-provider';
import { AlertBanner } from '@/components/shared/alert-banner';
import { PageHeader } from '@/components/shared/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  deleteTikTokIntegration,
  fetchTikTokIntegrationDashboard,
  saveTikTokEventsApiCredentials,
  testTikTokEventsApiConnection,
  type TikTokIntegrationDashboard,
  type TikTokIntegrationDashboardItem,
  type TikTokIntegrationView,
} from '@/lib/tiktok-integration';
import { createSocket } from '@/lib/socket';
import { parseApiError } from '@/lib/utils';
import { runTikTokSetupAutomation } from '@/lib/tiktok-pixel-setup';

const DASHBOARD_POLL_MS = 5000;

function formatTs(value?: string | null, neverLabel = 'Never') {
  if (!value) return neverLabel;
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

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
  const [copiedBuilder, setCopiedBuilder] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [activating, setActivating] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [activateError, setActivateError] = useState<string | null>(null);
  const [activateSuccess, setActivateSuccess] = useState(false);
  const [pixelCode, setPixelCode] = useState(item.integration.pixelCode ?? '');
  const [accessToken, setAccessToken] = useState('');
  const [eventsBusy, setEventsBusy] = useState(false);
  const [eventsMsg, setEventsMsg] = useState<string | null>(null);
  const [eventsErr, setEventsErr] = useState<string | null>(null);

  useEffect(() => {
    setPixelCode(item.integration.pixelCode ?? '');
  }, [item.integration.pixelCode, item.integration.id]);

  async function copyUrl() {
    await navigator.clipboard.writeText(item.integration.trackingUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function copyBuilderUrl() {
    const url = item.integration.eventBuilderUrl;
    if (!url) return;
    await navigator.clipboard.writeText(url);
    setCopiedBuilder(true);
    setTimeout(() => setCopiedBuilder(false), 2000);
  }

  async function handleActivate() {
    setActivating(true);
    setActivateError(null);
    setActivateSuccess(false);
    try {
      const result = await runTikTokSetupAutomation(item.integration);
      setActivateSuccess(result.activated);
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
    ['waiting_for_activity', 'pending', 'unknown'].includes(item.integration.pixelStatus);

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

  async function handleSaveEventsApi() {
    setEventsBusy(true);
    setEventsErr(null);
    setEventsMsg(null);
    try {
      const result = await saveTikTokEventsApiCredentials(item.integration.id, {
        pixelCode: pixelCode.trim(),
        accessToken: accessToken.trim(),
        pixelId: item.integration.pixelId ?? undefined,
        pixelName: item.integration.pixelName ?? undefined,
      });
      setEventsMsg(result.message || t('tiktokIntegration.eventsApi.connectedSuccess'));
      setAccessToken('');
      onDelete();
    } catch (err) {
      setEventsErr(parseApiError(err));
    } finally {
      setEventsBusy(false);
    }
  }

  async function handleTestConnection() {
    setEventsBusy(true);
    setEventsErr(null);
    setEventsMsg(null);
    try {
      const result = await testTikTokEventsApiConnection(item.integration.id);
      if (result.ok) {
        setEventsMsg(result.message || t('tiktokIntegration.eventsApi.connectedSuccess'));
      } else {
        setEventsErr(result.message);
      }
      onDelete();
    } catch (err) {
      setEventsErr(parseApiError(err));
    } finally {
      setEventsBusy(false);
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
    <Card className="border-0 shadow-card">
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div>
          <CardTitle className="text-base">{displayName}</CardTitle>
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
      <CardContent className="space-y-4">
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

        {needsActivation && (
          <AlertBanner variant="info" className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <span>{t('tiktokIntegration.pixelActivationHint')}</span>
            <Button size="sm" onClick={() => void handleActivate()} disabled={activating}>
              {activating ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : null}
              {t('tiktokIntegration.activatePixel')}
            </Button>
          </AlertBanner>
        )}

        {activateSuccess && (
          <AlertBanner variant="success">{t('tiktokIntegration.autoSetupSuccess')}</AlertBanner>
        )}

        <div className="space-y-3 rounded-lg border p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium">{t('tiktokIntegration.eventsApi.title')}</p>
            <Badge variant={eventsConnected ? 'success' : 'secondary'}>
              {item.integration.eventsApiStatusMessage ||
                (eventsConnected
                  ? t('tiktokIntegration.eventsApi.connected')
                  : t('tiktokIntegration.eventsApi.disconnected'))}
            </Badge>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <p className="text-xs text-muted-foreground">{t('tiktokIntegration.eventsApi.pixelCode')}</p>
              <p className="font-mono text-sm">{item.integration.pixelCode ?? item.integration.pixelId ?? '—'}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t('tiktokIntegration.pixelName')}</p>
              <p className="text-sm">{item.integration.pixelName ?? '—'}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t('tiktokIntegration.eventsApi.creationDate')}</p>
              <p className="text-sm">
                {formatTs(item.integration.createdAt, t('tiktokIntegration.eventsApi.never'))}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t('tiktokIntegration.eventsApi.lastVerification')}</p>
              <p className="text-sm">
                {formatTs(
                  item.integration.lastEventsApiVerificationAt,
                  t('tiktokIntegration.eventsApi.never'),
                )}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t('tiktokIntegration.eventsApi.lastEventSent')}</p>
              <p className="text-sm">
                {item.integration.lastEventName
                  ? `${item.integration.lastEventName} · ${formatTs(item.integration.lastEventSentAt, t('tiktokIntegration.eventsApi.never'))}`
                  : formatTs(
                      item.stats.lastEventSent ?? item.integration.lastEventSentAt,
                      t('tiktokIntegration.eventsApi.never'),
                    )}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t('tiktokIntegration.eventsApi.lastError')}</p>
              <p className="text-sm text-destructive">
                {item.integration.lastApiError || item.stats.lastError || '—'}
              </p>
            </div>
            {item.stats.lastApiResponse ? (
              <div className="md:col-span-2">
                <p className="text-xs text-muted-foreground">{t('tiktokIntegration.eventsApi.lastApiResponse')}</p>
                <pre className="mt-1 max-h-28 overflow-auto rounded bg-muted px-2 py-1 text-[11px]">
                  {typeof item.stats.lastApiResponse === 'string'
                    ? item.stats.lastApiResponse
                    : JSON.stringify(item.stats.lastApiResponse, null, 2)}
                </pre>
              </div>
            ) : item.integration.lastApiHttpStatus != null ? (
              <div>
                <p className="text-xs text-muted-foreground">{t('tiktokIntegration.eventsApi.lastApiResponse')}</p>
                <p className="text-sm">HTTP {item.integration.lastApiHttpStatus}</p>
              </div>
            ) : null}
            {item.integration.hasEventsApiToken && item.integration.eventsApiTokenHint ? (
              <div className="md:col-span-2">
                <p className="text-xs text-muted-foreground">{t('tiktokIntegration.eventsApi.tokenHint')}</p>
                <p className="font-mono text-sm">{item.integration.eventsApiTokenHint}</p>
              </div>
            ) : null}
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor={`pixel-${item.integration.id}`}>
                {t('tiktokIntegration.eventsApi.pixelCode')}
              </Label>
              <Input
                id={`pixel-${item.integration.id}`}
                value={pixelCode}
                onChange={(e) => setPixelCode(e.target.value)}
                placeholder="XXXXXXXXXXXXXXXXX"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`token-${item.integration.id}`}>
                {t('tiktokIntegration.eventsApi.accessToken')}
              </Label>
              <Input
                id={`token-${item.integration.id}`}
                type="password"
                autoComplete="off"
                value={accessToken}
                onChange={(e) => setAccessToken(e.target.value)}
                placeholder={t('tiktokIntegration.eventsApi.accessTokenPlaceholder')}
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              onClick={() => void handleSaveEventsApi()}
              disabled={eventsBusy || !pixelCode.trim() || accessToken.trim().length < 20}
            >
              {eventsBusy ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : null}
              {t('tiktokIntegration.eventsApi.save')}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => void handleTestConnection()}
              disabled={eventsBusy || !item.integration.hasEventsApiToken}
            >
              {eventsBusy ? (
                <Loader2 className="me-2 h-4 w-4 animate-spin" />
              ) : (
                <PlugZap className="me-2 h-4 w-4" />
              )}
              {eventsBusy
                ? t('tiktokIntegration.eventsApi.testing')
                : t('tiktokIntegration.eventsApi.testConnection')}
            </Button>
          </div>
          {eventsMsg && <AlertBanner variant="success">{eventsMsg}</AlertBanner>}
          {eventsErr && <AlertBanner variant="error">{eventsErr}</AlertBanner>}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <p className="text-xs text-muted-foreground">{t('tiktokIntegration.pixelId')}</p>
            <p className="font-mono text-sm">{item.integration.pixelId ?? '—'}</p>
          </div>
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
          <div className="md:col-span-2">
            <p className="text-xs text-muted-foreground">{t('tiktokIntegration.trackingUrl')}</p>
            <div className="mt-1 flex gap-2">
              <code className="flex-1 truncate rounded bg-muted px-2 py-1 text-xs">
                {item.integration.trackingUrl}
              </code>
              <Button variant="outline" size="icon" onClick={() => void copyUrl()}>
                {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
              </Button>
              <Button variant="outline" size="icon" asChild>
                <a href={item.integration.trackingUrl} target="_blank" rel="noreferrer">
                  <ExternalLink className="h-4 w-4" />
                </a>
              </Button>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{t('tiktokIntegration.trackingUrlHint')}</p>
          </div>
          {item.integration.eventBuilderUrl ? (
            <div className="md:col-span-2">
              <p className="text-xs text-muted-foreground">{t('tiktokIntegration.eventBuilderUrl')}</p>
              <div className="mt-1 flex gap-2">
                <code className="flex-1 truncate rounded bg-muted px-2 py-1 text-xs">
                  {item.integration.eventBuilderUrl}
                </code>
                <Button variant="outline" size="icon" onClick={() => void copyBuilderUrl()}>
                  {copiedBuilder ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                </Button>
                <Button variant="outline" size="icon" asChild>
                  <a href={item.integration.eventBuilderUrl} target="_blank" rel="noreferrer">
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </Button>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{t('tiktokIntegration.eventBuilderUrlHint')}</p>
            </div>
          ) : null}
        </div>

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
  const items = data?.integrations ?? [];

  return (
    <TikTokIntegrationShell>
      <PageHeader
        title={t('tiktokIntegration.nav.dashboard')}
        description={t('tiktokIntegration.dashboardDesc')}
        actions={
          <div className="flex items-center gap-3">
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
