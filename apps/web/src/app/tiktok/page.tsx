'use client';

import { FormEvent, Suspense, useEffect, useMemo, useState } from 'react';
import { Copy, Loader2, RefreshCw, Share2, Unplug } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { AppShell } from '@/components/layout/app-shell';
import { useTranslation } from '@/components/providers/locale-provider';
import { AlertBanner } from '@/components/shared/alert-banner';
import { PageHeader } from '@/components/shared/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { api, getTeamId, parseApiError } from '@/lib/utils';

type TikTokStatus = {
  configured: boolean;
  connected: boolean;
  status: string;
  businessName: string | null;
  advertiserId: string | null;
  businessCenterId: string | null;
  connectedAt: string | null;
  lastSync: string | null;
  tokenExpiration: string | null;
  partnerFeatures: { messagingManagement: boolean; eventsApi: boolean };
  settings: {
    eventsApiEnabled: boolean;
    autoSyncEnabled: boolean;
    defaultWhatsAppNumber: string | null;
    trackingRedirectMessage: string | null;
  } | null;
};

type EventStats = {
  counts: Record<string, number>;
  conversionRate: number;
  saleConversionRate: number;
};

type Campaign = {
  id: string;
  name: string;
  externalCampaignId: string | null;
  adGroupId: string | null;
  adId: string | null;
  _count: { clicks: number; events: number };
};

type LogRow = { id: string; level: string; action: string; message: string | null; createdAt: string };

function fmtDate(value?: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleString();
}

function TikTokPageInner() {
  const { t } = useTranslation();
  const searchParams = useSearchParams();
  const teamId = getTeamId();

  const [status, setStatus] = useState<TikTokStatus | null>(null);
  const [stats, setStats] = useState<EventStats | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [eventsApiEnabled, setEventsApiEnabled] = useState(true);
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(true);

  const statusLabel = useMemo(() => {
    const s = status?.status ?? 'DISCONNECTED';
    if (s === 'CONNECTED') return t('tiktok.connected');
    if (s === 'CONNECTING') return t('tiktok.connecting');
    if (s === 'EXPIRED') return t('tiktok.expired');
    return t('tiktok.notConnected');
  }, [status, t]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [statusData, statsData, campaignData, logData] = await Promise.all([
        api<TikTokStatus>('/tiktok/status'),
        api<EventStats>('/tiktok/events/stats'),
        api<Campaign[]>('/tiktok/campaigns'),
        api<LogRow[]>('/tiktok/logs'),
      ]);
      setStatus(statusData);
      setStats(statsData);
      setCampaigns(campaignData);
      setLogs(logData);
      setEventsApiEnabled(statusData.settings?.eventsApiEnabled ?? true);
      setAutoSyncEnabled(statusData.settings?.autoSyncEnabled ?? true);
    } catch (err) {
      setError(parseApiError(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load().catch(console.error);
    if (searchParams.get('connected') === '1') setNotice(t('tiktok.connectSuccess'));
  }, [searchParams, t]);

  async function connect() {
    setBusy(true);
    setError(null);
    try {
      const { authUrl } = await api<{ authUrl: string }>('/tiktok/connect', { method: 'POST', body: '{}' });
      window.location.href = authUrl;
    } catch (err) {
      setError(parseApiError(err));
      setBusy(false);
    }
  }

  async function disconnect() {
    setBusy(true);
    try {
      await api('/tiktok/disconnect', { method: 'POST', body: '{}' });
      await load();
    } catch (err) {
      setError(parseApiError(err));
    } finally {
      setBusy(false);
    }
  }

  async function sync() {
    setBusy(true);
    try {
      await api('/tiktok/sync', { method: 'POST', body: '{}' });
      await load();
      setNotice(t('common.save'));
    } catch (err) {
      setError(parseApiError(err));
    } finally {
      setBusy(false);
    }
  }

  async function createCampaign(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    try {
      await api('/tiktok/campaigns', {
        method: 'POST',
        body: JSON.stringify({
          name: String(form.get('name') ?? ''),
          externalCampaignId: String(form.get('externalCampaignId') ?? '') || undefined,
          adGroupId: String(form.get('adGroupId') ?? '') || undefined,
          adId: String(form.get('adId') ?? '') || undefined,
          whatsappNumber: String(form.get('whatsappNumber') ?? '') || undefined,
        }),
      });
      event.currentTarget.reset();
      await load();
    } catch (err) {
      setError(parseApiError(err));
    } finally {
      setBusy(false);
    }
  }

  async function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    try {
      await api('/tiktok/settings', {
        method: 'POST',
        body: JSON.stringify({
          eventsApiEnabled,
          autoSyncEnabled,
          defaultWhatsAppNumber: String(form.get('defaultWhatsAppNumber') ?? ''),
          trackingRedirectMessage: String(form.get('trackingRedirectMessage') ?? ''),
        }),
      });
      await load();
      setNotice(t('common.save'));
    } catch (err) {
      setError(parseApiError(err));
    } finally {
      setBusy(false);
    }
  }

  async function copyTrackingLink(campaignId: string) {
    const webBase = typeof window !== 'undefined' ? window.location.origin : '';
    const url = teamId ? `${webBase}/t/${teamId}/${campaignId}` : '';
    if (!url) return;
    await navigator.clipboard.writeText(url);
    setCopiedId(campaignId);
    setTimeout(() => setCopiedId(null), 2000);
  }

  return (
    <AppShell>
      <PageHeader title={t('tiktok.title')} description={t('tiktok.description')} />
      {notice && <AlertBanner className="mt-4" variant="success">{notice}</AlertBanner>}
      {error && <AlertBanner className="mt-4" variant="error">{error}</AlertBanner>}

      <Tabs defaultValue="connection" className="mt-6">
        <TabsList>
          <TabsTrigger value="connection">{t('tiktok.tabConnection')}</TabsTrigger>
          <TabsTrigger value="events">{t('tiktok.tabEvents')}</TabsTrigger>
          <TabsTrigger value="campaigns">{t('tiktok.tabCampaigns')}</TabsTrigger>
          <TabsTrigger value="settings">{t('tiktok.tabSettings')}</TabsTrigger>
          <TabsTrigger value="logs">{t('tiktok.tabLogs')}</TabsTrigger>
        </TabsList>

        <TabsContent value="connection">
          <Card className="border-0 shadow-card">
            <CardHeader className="flex flex-row items-start justify-between gap-4">
              <div>
                <CardTitle>{t('tiktok.connectionStatus')}</CardTitle>
                <CardDescription>{statusLabel}</CardDescription>
              </div>
              <Badge variant={status?.connected ? 'success' : 'secondary'}>{status?.status ?? 'DISCONNECTED'}</Badge>
            </CardHeader>
            <CardContent className="space-y-4">
              {loading ? (
                <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />{t('common.loading')}</div>
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  <div><p className="text-xs text-muted-foreground">{t('tiktok.businessName')}</p><p className="font-medium">{status?.businessName ?? '—'}</p></div>
                  <div><p className="text-xs text-muted-foreground">{t('tiktok.advertiserId')}</p><p className="font-medium">{status?.advertiserId ?? '—'}</p></div>
                  <div><p className="text-xs text-muted-foreground">{t('tiktok.businessCenterId')}</p><p className="font-medium">{status?.businessCenterId ?? '—'}</p></div>
                  <div><p className="text-xs text-muted-foreground">{t('tiktok.connectedDate')}</p><p className="font-medium">{fmtDate(status?.connectedAt)}</p></div>
                  <div><p className="text-xs text-muted-foreground">{t('tiktok.lastSync')}</p><p className="font-medium">{fmtDate(status?.lastSync)}</p></div>
                  <div><p className="text-xs text-muted-foreground">{t('tiktok.tokenExpiration')}</p><p className="font-medium">{fmtDate(status?.tokenExpiration)}</p></div>
                </div>
              )}
              {status && !status.configured && (
                <AlertBanner variant="warning">
                  <span className="font-medium">{t('tiktok.notConfigured')}</span>
                  <span className="mt-1 block text-sm">{t('tiktok.notConfiguredHint')}</span>
                </AlertBanner>
              )}
              <div className="flex flex-wrap gap-2 pt-2">
                {!status?.connected ? (
                  <Button onClick={connect} disabled={busy || !status?.configured}><Share2 className="me-2 h-4 w-4" />{t('tiktok.connect')}</Button>
                ) : (
                  <>
                    <Button variant="outline" onClick={sync} disabled={busy}><RefreshCw className="me-2 h-4 w-4" />{t('tiktok.sync')}</Button>
                    <Button variant="outline" onClick={connect} disabled={busy}>{t('tiktok.reconnect')}</Button>
                    <Button variant="destructive" onClick={disconnect} disabled={busy}><Unplug className="me-2 h-4 w-4" />{t('tiktok.disconnect')}</Button>
                  </>
                )}
              </div>
              <p className="text-xs text-muted-foreground">{t('tiktok.partnerNote')}</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="events">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { key: 'clicks', label: t('tiktok.clicks') },
              { key: 'landingViews', label: t('tiktok.landingViews') },
              { key: 'whatsappOpens', label: t('tiktok.whatsappOpens') },
              { key: 'conversationStarted', label: t('tiktok.conversationStarted') },
              { key: 'aiReplies', label: t('tiktok.aiReplies') },
              { key: 'sales', label: t('tiktok.sales') },
            ].map((item) => (
              <Card key={item.key} className="border-0 shadow-card">
                <CardHeader className="pb-2"><CardDescription>{item.label}</CardDescription></CardHeader>
                <CardContent><p className="text-2xl font-semibold">{stats?.counts?.[item.key] ?? 0}</p></CardContent>
              </Card>
            ))}
            <Card className="border-0 shadow-card">
              <CardHeader className="pb-2"><CardDescription>{t('tiktok.conversionRate')}</CardDescription></CardHeader>
              <CardContent><p className="text-2xl font-semibold">{stats?.conversionRate ?? 0}%</p></CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="campaigns" className="space-y-4">
          <Card className="border-0 shadow-card">
            <CardHeader><CardTitle>{t('tiktok.createCampaign')}</CardTitle></CardHeader>
            <CardContent>
              <form onSubmit={createCampaign} className="grid gap-3 md:grid-cols-2">
                <div className="space-y-2"><Label>{t('tiktok.campaignName')}</Label><Input name="name" required /></div>
                <div className="space-y-2"><Label>TikTok Campaign ID</Label><Input name="externalCampaignId" /></div>
                <div className="space-y-2"><Label>Ad Group ID</Label><Input name="adGroupId" /></div>
                <div className="space-y-2"><Label>Ad ID</Label><Input name="adId" /></div>
                <div className="space-y-2 md:col-span-2"><Label>{t('tiktok.defaultWhatsApp')}</Label><Input name="whatsappNumber" placeholder="9647xxxxxxxx" /></div>
                <Button type="submit" className="md:col-span-2" disabled={busy}>{t('tiktok.createCampaign')}</Button>
              </form>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-card">
            <CardContent className="pt-6">
              {campaigns.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('tiktok.noCampaigns')}</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('tiktok.campaignName')}</TableHead>
                      <TableHead>{t('tiktok.clicks')}</TableHead>
                      <TableHead>{t('tiktok.trackingLink')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {campaigns.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell>{c.name}</TableCell>
                        <TableCell>{c._count.clicks}</TableCell>
                        <TableCell>
                          <Button type="button" size="sm" variant="outline" onClick={() => copyTrackingLink(c.id)}>
                            <Copy className="me-2 h-3.5 w-3.5" />
                            {copiedId === c.id ? t('tiktok.copied') : t('tiktok.copyLink')}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings">
          <Card className="border-0 shadow-card">
            <CardContent className="pt-6">
              <form onSubmit={saveSettings} className="space-y-4">
                <div className="flex items-center justify-between"><Label>{t('tiktok.eventsApiEnabled')}</Label><Switch checked={eventsApiEnabled} onCheckedChange={setEventsApiEnabled} /></div>
                <div className="flex items-center justify-between"><Label>{t('tiktok.autoSync')}</Label><Switch checked={autoSyncEnabled} onCheckedChange={setAutoSyncEnabled} /></div>
                <div className="space-y-2"><Label>{t('tiktok.defaultWhatsApp')}</Label><Input name="defaultWhatsAppNumber" defaultValue={status?.settings?.defaultWhatsAppNumber ?? ''} /></div>
                <div className="space-y-2"><Label>{t('tiktok.redirectMessage')}</Label><Input name="trackingRedirectMessage" defaultValue={status?.settings?.trackingRedirectMessage ?? ''} /></div>
                <Button type="submit" disabled={busy}>{t('tiktok.saveSettings')}</Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="logs">
          <Card className="border-0 shadow-card">
            <CardContent className="pt-6">
              {logs.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('tiktok.noLogs')}</p>
              ) : (
                <Table>
                  <TableHeader><TableRow><TableHead>Level</TableHead><TableHead>Action</TableHead><TableHead>Message</TableHead><TableHead>Date</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {logs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell>{log.level}</TableCell>
                        <TableCell>{log.action}</TableCell>
                        <TableCell>{log.message ?? '—'}</TableCell>
                        <TableCell>{fmtDate(log.createdAt)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}

export default function TikTokPage() {
  return (
    <Suspense fallback={null}>
      <TikTokPageInner />
    </Suspense>
  );
}
