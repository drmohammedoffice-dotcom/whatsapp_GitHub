'use client';

import { SOCKET_EVENTS } from '@watsapp/shared';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Loader2, Phone, Plus, QrCode, Trash2, Wifi, WifiOff } from 'lucide-react';
import { TikTokIntegrationShell } from '@/components/tiktok/tiktok-integration-shell';
import { useSubscriptionOptional } from '@/components/providers/subscription-provider';
import { useTranslation } from '@/components/providers/locale-provider';
import { AlertBanner } from '@/components/shared/alert-banner';
import { PageHeader } from '@/components/shared/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  connectTikTokTrackingPhone,
  deleteTikTokTrackingPhone,
  disconnectTikTokTrackingPhone,
  fetchTikTokIntegrations,
  fetchTikTokTrackingPhoneQr,
  fetchTikTokTrackingPhoneStatus,
  fetchTikTokTrackingPhones,
  linkTikTokTrackingPhone,
  type TikTokIntegrationView,
  type TikTokTrackingPhone,
  type TikTokTrackingPhoneStatus,
} from '@/lib/tiktok-integration';
import { createSocket } from '@/lib/socket';
import { MOBILE_APP_UNAVAILABLE_MESSAGE } from '@/lib/app-mode';
import { useIsMobileApp } from '@/lib/use-is-mobile-app';
import { parseApiError } from '@/lib/utils';

function phoneLabel(phone: TikTokTrackingPhone, pendingLabel: string) {
  const digits = phone.phoneNumber?.replace(/\D/g, '') ?? '';
  if (digits.length >= 8 && digits.length <= 15) return phone.phoneNumber!;
  return pendingLabel;
}

function statusVariant(status: string) {
  if (status === 'CONNECTED') return 'success' as const;
  if (status === 'PENDING_QR' || status === 'CONNECTING') return 'secondary' as const;
  if (status === 'FAILED') return 'destructive' as const;
  return 'secondary' as const;
}

function pixelLabel(pixel: TikTokIntegrationView) {
  return pixel.pixelName || pixel.name || pixel.pixelCode || pixel.id.slice(0, 8);
}

export default function TikTokTrackingPhonesPage() {
  const { t, locale } = useTranslation();
  const isMobileApp = useIsMobileApp();
  const subscription = useSubscriptionOptional();
  const status = subscription?.status;
  const [phones, setPhones] = useState<TikTokTrackingPhone[]>([]);
  const [pixels, setPixels] = useState<TikTokIntegrationView[]>([]);
  const [selectedPixelId, setSelectedPixelId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeSession, setActiveSession] = useState<TikTokTrackingPhoneStatus | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [linkingId, setLinkingId] = useState<string | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [phoneRows, pixelRes] = await Promise.all([
        fetchTikTokTrackingPhones(),
        fetchTikTokIntegrations().catch(() => ({ integrations: [] as TikTokIntegrationView[] })),
      ]);
      setPhones(phoneRows);
      setPixels(pixelRes.integrations ?? []);
      setSelectedPixelId((prev) => {
        if (prev && pixelRes.integrations.some((p) => p.id === prev)) return prev;
        return pixelRes.integrations[0]?.id ?? '';
      });
    } catch (err) {
      setError(parseApiError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const refreshSession = useCallback(async (sessionId: string) => {
    const status = await fetchTikTokTrackingPhoneStatus(sessionId);
    setActiveSession(status);
    if (status.status === 'CONNECTED') {
      setQr(null);
      stopPolling();
      await load();
    }
    return status;
  }, [load, stopPolling]);

  const startPolling = useCallback(
    (sessionId: string) => {
      stopPolling();
      sessionIdRef.current = sessionId;
      let attempts = 0;
      const tick = async () => {
        attempts += 1;
        if (attempts > 40 || sessionIdRef.current !== sessionId) {
          stopPolling();
          return;
        }
        try {
          const status = await fetchTikTokTrackingPhoneStatus(sessionId);
          setActiveSession(status);
          if (status.status === 'CONNECTED') {
            setQr(null);
            stopPolling();
            await load();
            return;
          }
          const qrData = await fetchTikTokTrackingPhoneQr(sessionId);
          if (sessionIdRef.current === sessionId) setQr(qrData.qrCode);
        } catch {
          /* waiting for QR */
        }
      };
      void tick();
      pollRef.current = setInterval(() => void tick(), 2500);
    },
    [load, stopPolling],
  );

  useEffect(() => {
    void load();
    return () => stopPolling();
  }, [load, stopPolling]);

  useEffect(() => {
    const hasPending = phones.some((phone) => phone.status !== 'CONNECTED');
    if (!hasPending) return;
    const timer = setInterval(() => void load(), 5000);
    return () => clearInterval(timer);
  }, [load, phones]);

  useEffect(() => {
    const socket = createSocket();
    const onQr = (payload: { sessionId: string; qrCode: string }) => {
      if (sessionIdRef.current === payload.sessionId) {
        setQr(payload.qrCode);
        setActiveSession((prev) =>
          prev ? { ...prev, status: 'PENDING_QR' } : { sessionId: payload.sessionId, status: 'PENDING_QR' },
        );
      }
    };
    const onStatus = (payload: { sessionId: string; status: string }) => {
      if (sessionIdRef.current === payload.sessionId) {
        setActiveSession((prev) =>
          prev ? { ...prev, status: payload.status } : { sessionId: payload.sessionId, status: payload.status },
        );
        if (payload.status === 'CONNECTED') {
          setQr(null);
          stopPolling();
          void load();
        }
      }
    };
    socket.on(SOCKET_EVENTS.QR_GENERATED, onQr);
    socket.on(SOCKET_EVENTS.QR_UPDATED, onQr);
    socket.on(SOCKET_EVENTS.STATUS_CHANGED, onStatus);
    socket.on(SOCKET_EVENTS.WHATSAPP_CONNECTED, (payload: { sessionId: string }) => {
      void refreshSession(payload.sessionId);
    });
    return () => {
      socket.off(SOCKET_EVENTS.QR_GENERATED, onQr);
      socket.off(SOCKET_EVENTS.QR_UPDATED, onQr);
      socket.off(SOCKET_EVENTS.STATUS_CHANGED, onStatus);
      socket.disconnect();
    };
  }, [load, refreshSession, stopPolling]);

  async function handleAddPhone() {
    if (status && !status.canAddTrackingPhone) return;
    if (!selectedPixelId) {
      setError(t('tiktokIntegration.trackingPhones.selectPixelFirst'));
      return;
    }
    setConnecting(true);
    setError(null);
    try {
      const status = await connectTikTokTrackingPhone({ integrationId: selectedPixelId });
      setActiveSession(status);
      sessionIdRef.current = status.sessionId;
      startPolling(status.sessionId);
    } catch (err) {
      setError(parseApiError(err));
    } finally {
      setConnecting(false);
    }
  }

  async function handleLink(channelId: string, integrationId: string) {
    if (!integrationId) return;
    setLinkingId(channelId);
    setError(null);
    try {
      await linkTikTokTrackingPhone(channelId, integrationId);
      await load();
    } catch (err) {
      setError(parseApiError(err));
    } finally {
      setLinkingId(null);
    }
  }

  async function handleDisconnect(sessionId: string) {
    if (!window.confirm(t('tiktokIntegration.trackingPhones.disconnectConfirm'))) return;
    try {
      await disconnectTikTokTrackingPhone(sessionId);
      if (sessionIdRef.current === sessionId) {
        sessionIdRef.current = null;
        setActiveSession(null);
        setQr(null);
        stopPolling();
      }
      await load();
    } catch (err) {
      setError(parseApiError(err));
    }
  }

  async function handleDelete(sessionId: string) {
    if (!window.confirm(t('tiktokIntegration.trackingPhones.deleteConfirm'))) return;
    try {
      await deleteTikTokTrackingPhone(sessionId);
      if (sessionIdRef.current === sessionId) {
        sessionIdRef.current = null;
        setActiveSession(null);
        setQr(null);
        stopPolling();
      }
      await load();
    } catch (err) {
      setError(parseApiError(err));
    }
  }

  const atPhoneLimit = !!status && !status.canAddTrackingPhone;

  return (
    <TikTokIntegrationShell>
      <PageHeader
        title={t('tiktokIntegration.trackingPhones.title')}
        description={t('tiktokIntegration.trackingPhones.desc')}
        actions={
          <Button onClick={() => void handleAddPhone()} disabled={connecting || atPhoneLimit || !selectedPixelId}>
            {connecting ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <Plus className="me-2 h-4 w-4" />}
            {t('tiktokIntegration.trackingPhones.add')}
          </Button>
        }
      />

      <AlertBanner variant="info" className="mt-4">
        {t('tiktokIntegration.trackingPhones.hint')}
      </AlertBanner>

      <Card className="mt-4 border-0 shadow-card">
        <CardContent className="flex flex-col gap-2 py-4 sm:flex-row sm:items-center">
          <label className="text-sm font-medium whitespace-nowrap">
            {t('tiktokIntegration.trackingPhones.linkToPixel')}
          </label>
          <select
            className="h-10 w-full rounded-md border bg-background px-3 text-sm"
            value={selectedPixelId}
            onChange={(e) => setSelectedPixelId(e.target.value)}
          >
            {pixels.length === 0 ? (
              <option value="">{t('tiktokIntegration.trackingPhones.noPixels')}</option>
            ) : (
              pixels.map((pixel) => (
                <option key={pixel.id} value={pixel.id}>
                  {pixelLabel(pixel)}
                </option>
              ))
            )}
          </select>
        </CardContent>
      </Card>

      {status?.limits && !isMobileApp && (
        <AlertBanner variant="info" className="mt-4">
          {t('billing.trackingPhoneLimit').replace('{count}', String(status.limits.maxTrackingPhones))}
        </AlertBanner>
      )}

      {atPhoneLimit && (
        <AlertBanner variant="warning" className="mt-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            {isMobileApp ? (
              <span>{MOBILE_APP_UNAVAILABLE_MESSAGE[locale === 'ar' ? 'ar' : 'en']}</span>
            ) : (
              <>
                <span>{t('billing.upgradeTrackingBody')}</span>
                <Link
                  href="/pricing?upgrade=1"
                  className="font-medium text-primary underline-offset-4 hover:underline"
                >
                  {t('billing.upgradeViaWhatsApp')}
                </Link>
              </>
            )}
          </div>
        </AlertBanner>
      )}

      {error && <AlertBanner className="mt-4" variant="error">{error}</AlertBanner>}

      {qr && activeSession && (
        <Card className="mt-6 border-primary/30 shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <QrCode className="h-5 w-5" />
              {t('tiktokIntegration.trackingPhones.scanQr')}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-4 pb-8">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qr} alt="WhatsApp QR" className="h-64 w-64 rounded-lg border bg-white p-2" />
            <p className="max-w-md text-center text-sm text-muted-foreground">
              {t('tiktokIntegration.trackingPhones.scanHint')}
            </p>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="mt-8 flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t('common.loading')}
        </div>
      ) : (
        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {phones.length === 0 ? (
            <Card className="border-0 shadow-card md:col-span-2 xl:col-span-3">
              <CardContent className="py-12 text-center text-muted-foreground">
                {t('tiktokIntegration.trackingPhones.empty')}
              </CardContent>
            </Card>
          ) : (
            phones.map((phone) => (
              <Card key={phone.channelId} className="border-0 shadow-card">
                <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Phone className="h-5 w-5" />
                    </div>
                    <div>
                      <CardTitle className="text-base">
                        {phoneLabel(phone, t('tiktokIntegration.trackingPhones.pending'))}
                      </CardTitle>
                      <p className="text-xs text-muted-foreground">
                        {phone.pixelName
                          ? `${t('tiktokIntegration.trackingPhones.linkedPixel')}: ${phone.pixelName}`
                          : t('tiktokIntegration.trackingPhones.trackingOnly')}
                      </p>
                    </div>
                  </div>
                  <Badge variant={statusVariant(phone.status)}>
                    {phone.status === 'CONNECTED' ? (
                      <span className="flex items-center gap-1">
                        <Wifi className="h-3 w-3" />
                        {t('tiktokIntegration.trackingPhones.connected')}
                      </span>
                    ) : (
                      <span className="flex items-center gap-1">
                        <WifiOff className="h-3 w-3" />
                        {phone.status}
                      </span>
                    )}
                  </Badge>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-2">
                    <select
                      className="h-9 flex-1 rounded-md border bg-background px-2 text-xs"
                      value={phone.integrationId ?? ''}
                      disabled={linkingId === phone.channelId || pixels.length === 0}
                      onChange={(e) => void handleLink(phone.channelId, e.target.value)}
                    >
                      <option value="">{t('tiktokIntegration.trackingPhones.selectPixel')}</option>
                      {pixels.map((pixel) => (
                        <option key={pixel.id} value={pixel.id}>
                          {pixelLabel(pixel)}
                        </option>
                      ))}
                    </select>
                    {linkingId === phone.channelId ? (
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {phone.sessionId && phone.status !== 'CONNECTED' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          sessionIdRef.current = phone.sessionId!;
                          void refreshSession(phone.sessionId!).then((s) => {
                            if (s.status !== 'CONNECTED') startPolling(phone.sessionId!);
                          });
                        }}
                      >
                        <QrCode className="me-2 h-4 w-4" />
                        {t('tiktokIntegration.trackingPhones.showQr')}
                      </Button>
                    )}
                    {phone.sessionId && (
                      <>
                        <Button size="sm" variant="outline" onClick={() => void handleDisconnect(phone.sessionId!)}>
                          {t('tiktokIntegration.trackingPhones.disconnect')}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-destructive hover:text-destructive"
                          onClick={() => void handleDelete(phone.sessionId!)}
                        >
                          <Trash2 className="me-2 h-4 w-4" />
                          {t('common.delete')}
                        </Button>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}
    </TikTokIntegrationShell>
  );
}
