'use client';

import { SOCKET_EVENTS } from '@watsapp/shared';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  CheckCircle2,
  Loader2,
  Phone,
  QrCode,
  RefreshCw,
  Smartphone,
  Trash2,
  Wifi,
  WifiOff,
} from 'lucide-react';
import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { AppShell } from '@/components/layout/app-shell';
import { PlanGate } from '@/components/billing/plan-gate';
import { useTranslation } from '@/components/providers/locale-provider';
import { AlertBanner } from '@/components/shared/alert-banner';
import { LoadingBlock } from '@/components/shared/loading-block';
import { PageHeader } from '@/components/shared/page-header';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { WhatsAppEmbeddedSignupButton } from '@/components/whatsapp/whatsapp-embedded-signup-button';
import { api, cn, parseApiError } from '@/lib/utils';
import { createSocket } from '@/lib/socket';

type SessionStatus = {
  sessionId: string;
  status: string;
  displayName?: string | null;
  phoneNumber?: string | null;
  profilePhotoUrl?: string | null;
  connectedAt?: string | null;
  lastSeenAt?: string | null;
  failureReason?: string | null;
  isLive?: boolean;
};

type QrResponse = { sessionId: string; qrCode: string; status: string; expiresAt?: string };

type CloudAccount = {
  id: string;
  name: string;
  phoneNumber: string;
  phoneNumberId: string;
  wabaId?: string;
  status: string;
  connectedAt?: string | null;
  webhookStatus?: string;
};

const stepKeys = [
  { titleKey: 'whatsapp.step1Title', descKey: 'whatsapp.step1Desc' },
  { titleKey: 'whatsapp.step2Title', descKey: 'whatsapp.step2Desc' },
  { titleKey: 'whatsapp.step3Title', descKey: 'whatsapp.step3Desc' },
] as const;

function statusBadge(status: string | undefined, t: (key: string) => string) {
  if (status === 'CONNECTED') return { variant: 'success' as const, label: t('whatsapp.statusConnected'), icon: Wifi };
  if (status === 'PENDING_QR' || status === 'CONNECTING') return { variant: 'warning' as const, label: t('whatsapp.statusWaiting'), icon: QrCode };
  if (status === 'FAILED') return { variant: 'destructive' as const, label: t('whatsapp.statusFailed'), icon: WifiOff };
  return { variant: 'secondary' as const, label: status ?? t('whatsapp.statusNotConnected'), icon: WifiOff };
}

export default function WhatsAppPage() {
  const { t, dir } = useTranslation();
  const [session, setSession] = useState<SessionStatus | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [cloudAccounts, setCloudAccounts] = useState<CloudAccount[]>([]);
  const [showManualCloud, setShowManualCloud] = useState(false);
  const sessionIdRef = useRef<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    sessionIdRef.current = session?.sessionId ?? null;
  }, [session?.sessionId]);

  const stopQrPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const refreshStatus = useCallback(async (sessionId: string) => {
    const status = await api<SessionStatus>(`/whatsapp/status?sessionId=${sessionId}`);
    setSession(status);
    if (status.status === 'CONNECTED') setQr(null);
    return status;
  }, []);

  const startQrPolling = useCallback(
    (sessionId: string) => {
      stopQrPolling();
      let attempts = 0;
      const tick = async () => {
        attempts += 1;
        if (attempts > 30 || sessionIdRef.current !== sessionId) {
          stopQrPolling();
          return;
        }
        try {
          const status = await api<SessionStatus>(`/whatsapp/status?sessionId=${sessionId}`);
          setSession(status);
          if (status.status === 'CONNECTED') {
            setQr(null);
            stopQrPolling();
            return;
          }
          const qrData = await api<QrResponse>(`/whatsapp/qr?sessionId=${sessionId}`);
          if (sessionIdRef.current === sessionId) setQr(qrData.qrCode);
        } catch {
          /* QR not ready yet — keep polling */
        }
      };
      void tick();
      pollRef.current = setInterval(() => void tick(), 2500);
    },
    [stopQrPolling],
  );

  useEffect(() => stopQrPolling, [stopQrPolling]);

  const loadSessions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const sessions = await api<Array<{ id: string; status: string }>>('/whatsapp/sessions');
      try {
        const cloud = await api<CloudAccount[]>('/whatsapp-cloud/connected-accounts');
        setCloudAccounts(cloud.filter((a) => a.status === 'CONNECTED'));
      } catch (cloudErr) {
        setError(parseApiError(cloudErr));
      }
      if (sessions[0]) {
        sessionIdRef.current = sessions[0].id;
        const status = await refreshStatus(sessions[0].id);
        if (status.status !== 'CONNECTED') {
          startQrPolling(sessions[0].id);
        }
      } else {
        setSession(null);
        setQr(null);
      }
    } catch (err) {
      setError(parseApiError(err));
    } finally {
      setLoading(false);
    }
  }, [refreshStatus, startQrPolling]);

  useEffect(() => {
    loadSessions().catch(console.error);
  }, [loadSessions]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('embed_code') !== '1') return;

    let code: string | null = null;
    try {
      code = sessionStorage.getItem('chatloora_wa_embed_code');
      sessionStorage.removeItem('chatloora_wa_embed_code');
      if (!code) {
        const raw = localStorage.getItem('chatloora_wa_embed_code');
        if (raw) {
          localStorage.removeItem('chatloora_wa_embed_code');
          const parsed = JSON.parse(raw) as { code?: string };
          code = parsed.code?.trim() || raw.trim();
        }
      }
    } catch {
      code = null;
    }

    window.history.replaceState({}, '', '/whatsapp');
    if (!code) return;

    setNotice('جاري إكمال ربط واتساب من رمز ميتا…');
    void (async () => {
      try {
        await api('/whatsapp-cloud/embedded-signup', {
          method: 'POST',
          body: JSON.stringify({ code }),
        });
        setNotice(null);
        setError(null);
        setSuccess(t('whatsapp.cloudConnectedSuccess'));
        await loadSessions();
      } catch (err) {
        setNotice(null);
        setError(parseApiError(err));
        setShowManualCloud(true);
      }
    })();
  }, [loadSessions, t]);

  useEffect(() => {
    const socket = createSocket();

    const onQr = (payload: { sessionId: string; qrCode: string }) => {
      const current = sessionIdRef.current;
      if (!current || payload.sessionId === current) {
        setSession((prev) => (prev ? { ...prev, sessionId: payload.sessionId, status: 'PENDING_QR' } : { sessionId: payload.sessionId, status: 'PENDING_QR' }));
        setQr(payload.qrCode);
      }
    };

    const onStatus = (payload: { sessionId: string; status: string; failureReason?: string }) => {
      const current = sessionIdRef.current;
      if (!current || payload.sessionId === current) {
        setSession((prev) =>
          prev
            ? { ...prev, status: payload.status, failureReason: payload.failureReason ?? prev.failureReason }
            : { sessionId: payload.sessionId, status: payload.status, failureReason: payload.failureReason },
        );
        if (payload.status === 'CONNECTED') {
          stopQrPolling();
          setQr(null);
          setSuccess(t('whatsapp.connectedSuccess'));
        }
      }
    };

    const onConnected = (payload: { sessionId: string }) => {
      stopQrPolling();
      setQr(null);
      void refreshStatus(payload.sessionId);
    };

    socket.on(SOCKET_EVENTS.QR_GENERATED, onQr);
    socket.on(SOCKET_EVENTS.QR_UPDATED, onQr);
    socket.on(SOCKET_EVENTS.QR_UPDATED_LEGACY, onQr);
    socket.on(SOCKET_EVENTS.STATUS_CHANGED, onStatus);
    socket.on(SOCKET_EVENTS.SESSION_STATUS_UPDATED, onStatus);
    socket.on(SOCKET_EVENTS.WHATSAPP_CONNECTED, onConnected);

    return () => {
      socket.off(SOCKET_EVENTS.QR_GENERATED, onQr);
      socket.off(SOCKET_EVENTS.QR_UPDATED, onQr);
      socket.off(SOCKET_EVENTS.QR_UPDATED_LEGACY, onQr);
      socket.off(SOCKET_EVENTS.STATUS_CHANGED, onStatus);
      socket.off(SOCKET_EVENTS.SESSION_STATUS_UPDATED, onStatus);
      socket.off(SOCKET_EVENTS.WHATSAPP_CONNECTED, onConnected);
      socket.disconnect();
    };
  }, [refreshStatus, stopQrPolling, t]);

  async function runAction(action: string, fn: () => Promise<void>) {
    setActionLoading(action);
    setError(null);
    setSuccess(null);
    try {
      await fn();
    } catch (err) {
      setError(parseApiError(err));
    } finally {
      setActionLoading(null);
    }
  }

  async function submitManualCloud(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const phoneNumberId = String(form.get('phoneNumberId') || '').trim();
    const wabaId = String(form.get('wabaId') || '').trim();
    if (!/^\d{10,20}$/.test(phoneNumberId) || !/^\d{10,20}$/.test(wabaId)) {
      setError(t('whatsapp.cloudManualInvalidIds'));
      return;
    }
    await runAction('cloud-manual', async () => {
      await api('/whatsapp-cloud/accounts', {
        method: 'POST',
        body: JSON.stringify({
          name: String(form.get('name') || '').trim(),
          phoneNumber: String(form.get('phoneNumber') || '').trim(),
          phoneNumberId,
          wabaId,
          accessToken: String(form.get('accessToken') || '').trim(),
        }),
      });
      setSuccess(t('whatsapp.cloudConnectedSuccess'));
      setShowManualCloud(false);
      (e.target as HTMLFormElement).reset();
      await loadSessions();
    });
  }

  const sessionId = session?.sessionId;
  const isBaileysConnected = session?.status === 'CONNECTED';
  const isCloudConnected = cloudAccounts.length > 0;
  const isConnected = isBaileysConnected || isCloudConnected;
  const displayStatus = isBaileysConnected ? session?.status : isCloudConnected ? 'CONNECTED' : session?.status;
  const badge = statusBadge(displayStatus, t);
  const BadgeIcon = badge.icon;
  const currentStep = isConnected ? 3 : qr ? 2 : sessionId ? 1 : isCloudConnected ? 3 : 0;
  const primaryCloud = cloudAccounts[0];

  return (
    <AppShell>
      <PlanGate feature="whatsapp">
      <PageHeader
        title={t('whatsapp.title')}
        description={t('whatsapp.description')}
        actions={
          <Badge variant={badge.variant} className="gap-1.5 px-3 py-1">
            <BadgeIcon className="h-3.5 w-3.5" />
            {badge.label}
          </Badge>
        }
      />

      <div className="mt-4 space-y-4">
        {error && <AlertBanner message={error} onDismiss={() => setError(null)} />}
        {notice && <AlertBanner variant="info" message={notice} onDismiss={() => setNotice(null)} />}
        {success && <AlertBanner variant="success" message={success} onDismiss={() => setSuccess(null)} />}
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <Card className="border-primary/20 bg-primary/5 shadow-soft">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t('whatsapp.methodQrTitle')}</CardTitle>
            <CardDescription>{t('whatsapp.methodQrDesc')}</CardDescription>
          </CardHeader>
          <CardContent>
            <Badge variant="secondary">{t('whatsapp.methodQrBadge')}</Badge>
          </CardContent>
        </Card>
        <Card className={cn('border-0 shadow-card', isCloudConnected && 'border-primary/20 bg-primary/5')}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t('whatsapp.methodCloudTitle')}</CardTitle>
            <CardDescription>{t('whatsapp.methodCloudDesc')}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <WhatsAppEmbeddedSignupButton
              label={t('whatsapp.connectCloudBtn')}
              busyLabel={t('whatsapp.connectCloudBusy')}
              className="w-full gap-2 sm:w-auto"
              onSuccess={(result) => {
                setNotice(null);
                setError(null);
                setSuccess(t('whatsapp.cloudConnectedSuccess'));
                if (result.account?.id) {
                  setCloudAccounts((prev) => {
                    const next = prev.filter((row) => row.id !== result.account!.id);
                    return [
                      {
                        id: result.account!.id,
                        name: result.account!.name,
                        phoneNumber: result.account!.phoneNumber,
                        phoneNumberId: result.account!.phoneNumberId,
                        status: result.account!.status || 'CONNECTED',
                      },
                      ...next,
                    ];
                  });
                }
                void loadSessions();
              }}
              onNotice={(msg) => {
                setError(null);
                setNotice(msg);
              }}
              onError={(msg) => {
                setNotice(null);
                setError(msg);
              }}
            />
            <p className="text-xs text-muted-foreground">{t('whatsapp.cloudEmbedHint')}</p>
            <p className="text-xs text-amber-700 dark:text-amber-400">{t('whatsapp.cloudBspNote')}</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full sm:w-auto"
              onClick={() => setShowManualCloud((v) => !v)}
            >
              {t('whatsapp.cloudManualTitle')}
            </Button>
            {showManualCloud ? (
              <form onSubmit={submitManualCloud} className="space-y-3 rounded-lg border bg-muted/20 p-3">
                <p className="text-xs text-muted-foreground">{t('whatsapp.cloudManualDesc')}</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="cloud-name">{t('whatsapp.cloudAccountName')}</Label>
                    <Input id="cloud-name" name="name" required />
                  </div>
                  <div>
                    <Label htmlFor="cloud-phone">{t('whatsapp.cloudPhoneNumber')}</Label>
                    <Input id="cloud-phone" name="phoneNumber" required placeholder="+964..." />
                  </div>
                  <div>
                    <Label htmlFor="cloud-pnid">{t('whatsapp.cloudPhoneNumberId')}</Label>
                    <Input
                      id="cloud-pnid"
                      name="phoneNumberId"
                      required
                      inputMode="numeric"
                      pattern="\d{10,20}"
                      placeholder="123456789012345"
                    />
                    <p className="mt-1 text-xs text-muted-foreground">{t('whatsapp.cloudPhoneNumberIdHint')}</p>
                  </div>
                  <div>
                    <Label htmlFor="cloud-waba">{t('whatsapp.cloudWabaId')}</Label>
                    <Input
                      id="cloud-waba"
                      name="wabaId"
                      required
                      inputMode="numeric"
                      pattern="\d{10,20}"
                      placeholder="1265762039957517"
                    />
                    <p className="mt-1 text-xs text-muted-foreground">{t('whatsapp.cloudWabaIdHint')}</p>
                  </div>
                  <div className="sm:col-span-2">
                    <Label htmlFor="cloud-token">{t('whatsapp.cloudAccessToken')}</Label>
                    <Input id="cloud-token" name="accessToken" type="password" required minLength={20} />
                    <p className="mt-1 text-xs text-muted-foreground">{t('whatsapp.cloudAccessTokenHint')}</p>
                  </div>
                </div>
                <Button type="submit" disabled={actionLoading === 'cloud-manual'} className="w-full gap-2 sm:w-auto">
                  {actionLoading === 'cloud-manual' ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {t('whatsapp.cloudSubmit')}
                </Button>
              </form>
            ) : null}
            {cloudAccounts.length > 0 ? (
              <div className="space-y-2 text-sm">
                {cloudAccounts.map((acc) => (
                  <div key={acc.id} className="rounded-lg border bg-muted/30 px-3 py-2">
                    <p className="font-medium">{acc.name}</p>
                    <p className="text-muted-foreground">{acc.phoneNumber}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {t('whatsapp.cloudWebhook')}: {acc.webhookStatus ?? 'unknown'}
                    </p>
                    <Badge variant="success" className="mt-1 gap-1">
                      <CheckCircle2 className="h-3 w-3" /> {t('whatsapp.cloudConnected')}
                    </Badge>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={actionLoading === `cloud-test-${acc.id}`}
                        onClick={() =>
                          runAction(`cloud-test-${acc.id}`, async () => {
                            await api(`/whatsapp-cloud/accounts/${acc.id}/test`, { method: 'POST', body: '{}' });
                            await loadSessions();
                          })
                        }
                      >
                        {t('whatsapp.cloudTest')}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={actionLoading === `cloud-disc-${acc.id}`}
                        onClick={() =>
                          runAction(`cloud-disc-${acc.id}`, async () => {
                            await api(`/whatsapp-cloud/accounts/${acc.id}/disconnect`, { method: 'POST', body: '{}' });
                            await loadSessions();
                          })
                        }
                      >
                        {t('whatsapp.cloudDisconnect')}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
            <Button asChild variant="ghost" size="sm" className="self-start px-0">
              <Link href="/whatsapp-api" target="_blank">{t('whatsapp.methodCloudDemo')}</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        {stepKeys.map((step, index) => (
          <Card key={step.titleKey} className={cnStep(index + 1 <= currentStep)}>
            <CardContent className="flex items-start gap-3 p-4">
              <div
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                  index + 1 <= currentStep ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                }`}
              >
                {index + 1 < currentStep ? '✓' : index + 1}
              </div>
              <div>
                <p className="font-medium">{t(step.titleKey)}</p>
                <p className="text-sm text-muted-foreground">{t(step.descKey)}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card className="border-0 shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Phone className="h-5 w-5 text-primary" />
              {t('whatsapp.connection')}
            </CardTitle>
            <CardDescription>{t('whatsapp.connectionDesc')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {loading ? (
              <LoadingBlock label={t('whatsapp.loadingConnection')} />
            ) : isBaileysConnected && session ? (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                <div className="flex items-center gap-4 rounded-xl border bg-muted/30 p-4">
                  <Avatar className="h-14 w-14">
                    {session.profilePhotoUrl && <AvatarImage src={session.profilePhotoUrl} alt="Profile" />}
                    <AvatarFallback className="bg-primary/10 text-primary">
                      {(session.displayName ?? session.phoneNumber ?? 'WA').slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-lg font-semibold">{session.displayName ?? 'WhatsApp User'}</p>
                    <p className="text-muted-foreground">+{session.phoneNumber}</p>
                    <Badge variant="success" className="mt-2 gap-1">
                      <CheckCircle2 className="h-3 w-3" /> {t('whatsapp.live')}
                    </Badge>
                  </div>
                </div>
                <dl className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <dt className="text-muted-foreground">{t('whatsapp.connectedAt')}</dt>
                    <dd className="font-medium">{session.connectedAt ? new Date(session.connectedAt).toLocaleString() : '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">{t('whatsapp.lastActivity')}</dt>
                    <dd className="font-medium">{session.lastSeenAt ? new Date(session.lastSeenAt).toLocaleString() : '—'}</dd>
                  </div>
                </dl>
                <Button asChild className="w-full">
                  <Link href="/inbox/whatsapp">
                    {t('whatsapp.openInbox')} <ArrowRight className={cn('h-4 w-4', dir === 'rtl' && 'rotate-180')} />
                  </Link>
                </Button>
              </motion.div>
            ) : isCloudConnected && primaryCloud ? (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                <div className="flex items-center gap-4 rounded-xl border bg-muted/30 p-4">
                  <Avatar className="h-14 w-14">
                    <AvatarFallback className="bg-primary/10 text-primary">
                      {primaryCloud.name.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-lg font-semibold">{primaryCloud.name}</p>
                    <p className="text-muted-foreground">{primaryCloud.phoneNumber}</p>
                    <Badge variant="success" className="mt-2 gap-1">
                      <CheckCircle2 className="h-3 w-3" /> {t('whatsapp.cloudConnected')}
                    </Badge>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">{t('whatsapp.cloudOnlyConnectedDesc')}</p>
                <Button asChild className="w-full">
                  <Link href="/inbox/whatsapp">
                    {t('whatsapp.openInbox')} <ArrowRight className={cn('h-4 w-4', dir === 'rtl' && 'rotate-180')} />
                  </Link>
                </Button>
              </motion.div>
            ) : (
              <div className="rounded-xl border border-dashed bg-muted/20 p-8 text-center">
                <Smartphone className="mx-auto h-10 w-10 text-muted-foreground" />
                <p className="mt-3 font-medium">{t('whatsapp.notConnected')}</p>
                <p className="mt-1 text-sm text-muted-foreground">{t('whatsapp.notConnectedDesc')}</p>
                {session?.failureReason && <p className="mt-3 text-sm text-destructive">{session.failureReason}</p>}
              </div>
            )}

            <Separator />

            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              {!isBaileysConnected && (
                <Button className="flex-1 sm:flex-none" disabled={!!actionLoading} onClick={() => runAction('connect', async () => {
                  const result = await api<SessionStatus>('/whatsapp/connect', { method: 'POST', body: JSON.stringify({}) });
                  setSession(result);
                  sessionIdRef.current = result.sessionId;
                  setQr(null);
                  startQrPolling(result.sessionId);
                })}>
                  {actionLoading === 'connect' ? <Loader2 className="h-4 w-4 animate-spin" /> : <QrCode className="h-4 w-4" />}
                  {t('whatsapp.connectBtn')}
                </Button>
              )}
              {sessionId && (
                <>
                  <Button variant="outline" disabled={!!actionLoading} onClick={() => runAction('reconnect', async () => {
                    const result = await api<SessionStatus>('/whatsapp/reconnect', { method: 'POST', body: JSON.stringify({ sessionId }) });
                    setSession(result);
                    setQr(null);
                    if (result.status !== 'CONNECTED') startQrPolling(result.sessionId);
                  })}>
                    <RefreshCw className="h-4 w-4" /> {t('whatsapp.reconnect')}
                  </Button>
                  {isBaileysConnected ? (
                    <Button variant="outline" disabled={!!actionLoading} onClick={() => runAction('disconnect', async () => {
                      stopQrPolling();
                      setSession(await api('/whatsapp/disconnect', { method: 'POST', body: JSON.stringify({ sessionId }) }));
                      setQr(null);
                    })}>
                      {t('common.disconnect')}
                    </Button>
                  ) : (
                    <Button variant="outline" disabled={!!actionLoading} onClick={() => runAction('refresh-qr', async () => {
                      startQrPolling(sessionId);
                    })}>
                      <QrCode className="h-4 w-4" /> {t('whatsapp.refreshQr')}
                    </Button>
                  )}
                  <Button variant="destructive" disabled={!!actionLoading} onClick={() => runAction('delete', async () => {
                    stopQrPolling();
                    await api('/whatsapp/session', { method: 'DELETE', body: JSON.stringify({ sessionId }) });
                    setSession(null);
                    setQr(null);
                    sessionIdRef.current = null;
                    setSuccess(t('whatsapp.sessionDeleted'));
                  })}>
                    <Trash2 className="h-4 w-4" /> {t('whatsapp.deleteSession')}
                  </Button>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <QrCode className="h-5 w-5 text-primary" />
              {t('whatsapp.scanQr')}
            </CardTitle>
            <CardDescription>
              {isConnected ? t('whatsapp.connectionActiveDesc') : t('whatsapp.scanQrDesc')}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex min-h-[340px] flex-col items-center justify-center">
            {qr && !isBaileysConnected ? (
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center">
                <img src={qr} alt="WhatsApp QR Code" className="mx-auto h-56 w-56 rounded-xl border bg-white p-3 shadow-card sm:h-64 sm:w-64" />
                <p className="mt-4 text-sm text-muted-foreground">{t('whatsapp.qrExpires')}</p>
              </motion.div>
            ) : isConnected ? (
              <div className="text-center">
                <CheckCircle2 className="mx-auto h-16 w-16 text-emerald-500" />
                <p className="mt-4 text-lg font-medium text-emerald-600 dark:text-emerald-400">{t('whatsapp.connected')}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {isCloudConnected && !isBaileysConnected
                    ? t('whatsapp.cloudOnlyConnectedDesc')
                    : t('whatsapp.connectedDesc')}
                </p>
              </div>
            ) : (
              <div className="max-w-xs text-center text-muted-foreground">
                <QrCode className="mx-auto h-14 w-14 opacity-25" />
                <p className="mt-4 font-medium text-foreground">{t('whatsapp.qrPlaceholder')}</p>
                <p className="mt-1 text-sm">{t('whatsapp.qrPlaceholderDesc')}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      </PlanGate>
    </AppShell>
  );
}

function cnStep(active: boolean) {
  return active ? 'border-primary/30 bg-primary/5 shadow-soft' : 'border-0 shadow-card opacity-80';
}
