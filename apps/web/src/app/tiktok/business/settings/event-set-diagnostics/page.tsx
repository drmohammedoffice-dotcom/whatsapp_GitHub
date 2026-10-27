'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
import { TikTokBusinessShell } from '@/components/tiktok/tiktok-business-shell';
import { useTranslation } from '@/components/providers/locale-provider';
import { AlertBanner } from '@/components/shared/alert-banner';
import { PageHeader } from '@/components/shared/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  fetchTikTokAdvertiserOptions,
  fetchTikTokEventSetDiagnostics,
  reconnectTikTokBusinessForEvents,
  type TikTokEventSetDiagnostics,
} from '@/lib/tiktok-business';
import { parseApiError } from '@/lib/utils';

export default function EventSetDiagnosticsPage() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [diagnosticsLoading, setDiagnosticsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [advertisers, setAdvertisers] = useState<Array<{ advertiserId: string; name: string | null }>>([]);
  const [advertiserId, setAdvertiserId] = useState('');
  const [data, setData] = useState<TikTokEventSetDiagnostics | null>(null);
  const [reconnecting, setReconnecting] = useState(false);

  const loadAdvertisers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchTikTokAdvertiserOptions();
      setAdvertisers(res.advertisers);
      if (res.advertisers.length > 0 && !advertiserId) {
        setAdvertiserId(res.advertisers[0].advertiserId);
      }
    } catch (err) {
      setError(parseApiError(err));
    } finally {
      setLoading(false);
    }
  }, [advertiserId]);

  const loadDiagnostics = useCallback(async (id: string) => {
    if (!id) return;
    setDiagnosticsLoading(true);
    setError(null);
    try {
      setData(await fetchTikTokEventSetDiagnostics(id));
    } catch (err) {
      setError(parseApiError(err));
      setData(null);
    } finally {
      setDiagnosticsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAdvertisers().catch(console.error);
  }, [loadAdvertisers]);

  useEffect(() => {
    if (advertiserId) loadDiagnostics(advertiserId).catch(console.error);
  }, [advertiserId, loadDiagnostics]);

  async function handleReconnect() {
    setReconnecting(true);
    try {
      const { authUrl } = await reconnectTikTokBusinessForEvents();
      window.location.href = authUrl;
    } catch (err) {
      setError(parseApiError(err));
      setReconnecting(false);
    }
  }

  function apiBadge(available: boolean, reason?: string) {
    return (
      <div className="space-y-1">
        <Badge variant={available ? 'success' : 'destructive'}>
          {available ? 'Available' : 'Unavailable'}
        </Badge>
        {!available && reason && <p className="text-xs text-muted-foreground">{reason}</p>}
      </div>
    );
  }

  return (
    <TikTokBusinessShell>
      <PageHeader
        title={t('tiktokBusiness.eventSet.diagnosticsTitle')}
        description={t('tiktokBusiness.eventSet.diagnosticsDesc')}
      />
      {error && <AlertBanner className="mt-4" variant="error">{error}</AlertBanner>}

      <Card className="mt-4 border-0 shadow-card">
        <CardHeader>
          <CardTitle className="text-base">{t('tiktokBusiness.eventSet.selectAdvertiser')}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <div className="min-w-[280px] flex-1 space-y-2">
              <Label>{t('tiktokBusiness.advertiserName')}</Label>
              <Select value={advertiserId} onValueChange={setAdvertiserId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {advertisers.map((a) => (
                    <SelectItem key={a.advertiserId} value={a.advertiserId}>
                      {a.name ? `${a.name} — ${a.advertiserId}` : a.advertiserId}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <Button
            variant="outline"
            onClick={() => void loadDiagnostics(advertiserId)}
            disabled={diagnosticsLoading || !advertiserId}
          >
            <RefreshCw className={diagnosticsLoading ? 'me-2 h-4 w-4 animate-spin' : 'me-2 h-4 w-4'} />
            {t('tiktokBusiness.eventSet.refreshStatus')}
          </Button>
        </CardContent>
      </Card>

      {diagnosticsLoading && (
        <div className="mt-6 flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t('common.loading')}
        </div>
      )}

      {data && !diagnosticsLoading && (
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <Card className="border-0 shadow-card">
            <CardHeader>
              <CardTitle className="text-base">{t('tiktokBusiness.eventSet.connectionTitle')}</CardTitle>
              <CardDescription>{t('tiktokBusiness.eventSet.advertiserIdLabel')}: <span dir="ltr">{data.advertiserId}</span></CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t('tiktokBusiness.eventSet.connected')}</span>
                <Badge variant={data.connected ? 'success' : 'destructive'}>
                  {data.connected ? t('common.yes') : t('common.no')}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t('tiktokBusiness.eventSet.tokenExpired')}</span>
                <Badge variant={data.tokenExpired ? 'destructive' : 'success'}>
                  {data.tokenExpired ? t('common.yes') : t('common.no')}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t('tiktokBusiness.eventSet.requiresReconnect')}</span>
                <Badge variant={data.requiresReconnect ? 'destructive' : 'success'}>
                  {data.requiresReconnect ? t('common.yes') : t('common.no')}
                </Badge>
              </div>
              {data.reconnectReason && (
                <p className="rounded-md bg-destructive/10 p-2 text-xs text-destructive">{data.reconnectReason}</p>
              )}
              {data.oauthScope && (
                <div>
                  <p className="font-medium">{t('tiktokBusiness.eventSet.tokenScopes')}</p>
                  <p className="font-mono text-xs">{data.oauthScope}</p>
                </div>
              )}
              {data.connectedAt && (
                <div>
                  <p className="font-medium">{t('tiktokBusiness.eventSet.connectedAt')}</p>
                  <p className="text-xs">{new Date(data.connectedAt).toLocaleString()}</p>
                </div>
              )}
              {data.requiresReconnect && (
                <Button onClick={() => void handleReconnect()} disabled={reconnecting} className="w-full">
                  {t('tiktokBusiness.eventSet.reconnect')}
                </Button>
              )}
            </CardContent>
          </Card>

          <Card className="border-0 shadow-card">
            <CardHeader>
              <CardTitle className="text-base">{t('tiktokBusiness.eventSet.permissions')}</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm">
                {data.permissions.map((p) => (
                  <li key={p} className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-primary" />
                    {p}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-card lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">{t('tiktokBusiness.eventSet.availableApis')}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-3">
              <div>
                <p className="mb-2 text-sm font-medium">MESSAGE</p>
                {apiBadge(data.availableApis.message.available, data.availableApis.message.reason)}
                <p className="mt-1 text-xs text-muted-foreground">Count: {data.availableApis.message.count ?? 0}</p>
              </div>
              <div>
                <p className="mb-2 text-sm font-medium">CRM</p>
                {apiBadge(data.availableApis.crm.available, data.availableApis.crm.reason)}
                <p className="mt-1 text-xs text-muted-foreground">Count: {data.availableApis.crm.count ?? 0}</p>
              </div>
              <div>
                <p className="mb-2 text-sm font-medium">CTX</p>
                {apiBadge(data.availableApis.ctx.available, data.availableApis.ctx.reason)}
                <p className="mt-1 text-xs text-muted-foreground">Count: {data.availableApis.ctx.count ?? 0}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-card">
            <CardHeader>
              <CardTitle className="text-base">{t('tiktokBusiness.eventSet.messageSets')}</CardTitle>
            </CardHeader>
            <CardContent>
              {data.messageEventSets.length === 0 ? (
                <p className="text-sm text-muted-foreground">None found in TikTok.</p>
              ) : (
                <pre className="max-h-48 overflow-auto rounded-md bg-muted p-2 text-xs">
                  {JSON.stringify(data.messageEventSets, null, 2)}
                </pre>
              )}
            </CardContent>
          </Card>

          <Card className="border-0 shadow-card">
            <CardHeader>
              <CardTitle className="text-base">{t('tiktokBusiness.eventSet.crmSets')} / {t('tiktokBusiness.eventSet.ctxSets')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <pre className="max-h-24 overflow-auto rounded-md bg-muted p-2 text-xs">
                CRM: {JSON.stringify(data.crmEventSets, null, 2)}
              </pre>
              <pre className="max-h-24 overflow-auto rounded-md bg-muted p-2 text-xs">
                CTX: {JSON.stringify(data.ctxEventSets, null, 2)}
              </pre>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-card lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">{t('tiktokBusiness.eventSet.lastErrors')}</CardTitle>
            </CardHeader>
            <CardContent>
              {data.lastErrors.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('tiktokBusiness.eventSet.noErrors')}</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Endpoint</TableHead>
                      <TableHead>Code</TableHead>
                      <TableHead>Message</TableHead>
                      <TableHead>Time</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.lastErrors.map((e, i) => (
                      <TableRow key={`${e.endpoint}-${i}`}>
                        <TableCell className="font-mono text-xs">{e.endpoint}</TableCell>
                        <TableCell>{e.errorCode ?? '—'}</TableCell>
                        <TableCell className="max-w-md truncate text-xs">{e.errorMessage ?? '—'}</TableCell>
                        <TableCell className="text-xs">{new Date(e.createdAt).toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </TikTokBusinessShell>
  );
}
