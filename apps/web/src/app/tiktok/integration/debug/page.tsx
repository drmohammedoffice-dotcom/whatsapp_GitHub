'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
import { TikTokIntegrationShell } from '@/components/tiktok/tiktok-integration-shell';
import { useTranslation } from '@/components/providers/locale-provider';
import { AlertBanner } from '@/components/shared/alert-banner';
import { PageHeader } from '@/components/shared/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  fetchTikTokContactDebug,
  type TikTokContactDebugRow,
  type TikTokContactDiagnosticRow,
} from '@/lib/tiktok-integration';
import { parseApiError } from '@/lib/utils';

function statusVariant(status: string | null | undefined, contactSent: boolean): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (contactSent || status === 'sent') return 'default';
  if (status === 'failed' || status === 'skip') return 'destructive';
  if (status === 'pending') return 'secondary';
  return 'outline';
}

export default function TikTokConversionDebugPage() {
  const { t, locale } = useTranslation();
  const [rows, setRows] = useState<TikTokContactDebugRow[]>([]);
  const [diagnostics, setDiagnostics] = useState<TikTokContactDiagnosticRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchTikTokContactDebug(undefined, 200);
      setRows(data.rows);
      setDiagnostics(data.diagnostics ?? []);
    } catch (err) {
      setError(parseApiError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const dateFmt = (value: string | null | undefined) => {
    if (!value) return '—';
    try {
      return new Date(value).toLocaleString(locale === 'ar' ? 'ar' : 'en');
    } catch {
      return value;
    }
  };

  return (
    <TikTokIntegrationShell>
      <PageHeader
        title={t('tiktokIntegration.debug.title')}
        description={t('tiktokIntegration.debug.desc')}
      />

      <div className="mb-4 flex items-center justify-end">
        <Button type="button" variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          <span className="ms-2">{t('tiktokIntegration.debug.refresh')}</span>
        </Button>
      </div>

      {error ? <AlertBanner variant="error" message={error} className="mb-4" /> : null}

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">{t('tiktokIntegration.debug.pipelineTitle')}</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {loading && diagnostics.length === 0 ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : diagnostics.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">{t('tiktokIntegration.debug.empty')}</p>
          ) : (
            <table className="w-full min-w-[1100px] text-start text-sm">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="px-2 py-2 font-medium">{t('tiktokIntegration.debug.time')}</th>
                  <th className="px-2 py-2 font-medium">{t('tiktokIntegration.debug.workspace')}</th>
                  <th className="px-2 py-2 font-medium">{t('tiktokIntegration.debug.phone')}</th>
                  <th className="px-2 py-2 font-medium">{t('tiktokIntegration.debug.conversation')}</th>
                  <th className="px-2 py-2 font-medium">Pixel</th>
                  <th className="px-2 py-2 font-medium">ttclid</th>
                  <th className="px-2 py-2 font-medium">{t('tiktokIntegration.debug.newConversation')}</th>
                  <th className="px-2 py-2 font-medium">{t('tiktokIntegration.debug.outcome')}</th>
                  <th className="px-2 py-2 font-medium">{t('tiktokIntegration.debug.reason')}</th>
                </tr>
              </thead>
              <tbody>
                {diagnostics.map((row) => (
                  <tr key={row.id} className="border-b align-top last:border-0">
                    <td className="whitespace-nowrap px-2 py-3 text-xs">{dateFmt(row.createdAt)}</td>
                    <td className="px-2 py-3 text-xs">{row.integrationName || row.teamId}</td>
                    <td className="px-2 py-3 font-mono text-xs">{row.whatsappPhone || '—'}</td>
                    <td className="max-w-[120px] truncate px-2 py-3 font-mono text-xs" title={row.conversationId ?? ''}>
                      {row.conversationId || '—'}
                    </td>
                    <td className="px-2 py-3 font-mono text-xs">{row.pixelCode || '—'}</td>
                    <td className="max-w-[120px] truncate px-2 py-3 font-mono text-xs" title={row.ttclid ?? ''}>
                      {row.ttclid || '—'}
                    </td>
                    <td className="px-2 py-3">
                      {row.isNewConversation == null
                        ? '—'
                        : row.isNewConversation
                          ? t('tiktokIntegration.debug.yes')
                          : t('tiktokIntegration.debug.no')}
                    </td>
                    <td className="px-2 py-3">
                      <Badge variant={statusVariant(row.outcome, row.contactSent)}>{row.outcome}</Badge>
                    </td>
                    <td className="px-2 py-3 text-xs text-muted-foreground">
                      {row.reason || row.errorMessage || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('tiktokIntegration.debug.tableTitle')}</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {rows.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">{t('tiktokIntegration.debug.empty')}</p>
          ) : (
            <table className="w-full min-w-[960px] text-start text-sm">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="px-2 py-2 font-medium">{t('tiktokIntegration.debug.phone')}</th>
                  <th className="px-2 py-2 font-medium">{t('tiktokIntegration.debug.event')}</th>
                  <th className="px-2 py-2 font-medium">{t('tiktokIntegration.debug.firstMessage')}</th>
                  <th className="px-2 py-2 font-medium">ttclid</th>
                  <th className="px-2 py-2 font-medium">{t('tiktokIntegration.debug.contactSent')}</th>
                  <th className="px-2 py-2 font-medium">{t('tiktokIntegration.debug.sentAt')}</th>
                  <th className="px-2 py-2 font-medium">{t('tiktokIntegration.debug.status')}</th>
                  <th className="px-2 py-2 font-medium">{t('tiktokIntegration.debug.response')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b align-top last:border-0">
                    <td className="px-2 py-3 font-mono text-xs">{row.whatsappPhone}</td>
                    <td className="px-2 py-3 font-mono text-xs">{row.eventName}</td>
                    <td className="px-2 py-3 whitespace-nowrap">{dateFmt(row.firstMessageAt)}</td>
                    <td className="max-w-[140px] truncate px-2 py-3 font-mono text-xs" title={row.ttclid ?? ''}>
                      {row.ttclid || '—'}
                    </td>
                    <td className="px-2 py-3">
                      {row.contactSent
                        ? t('tiktokIntegration.debug.yes')
                        : t('tiktokIntegration.debug.no')}
                    </td>
                    <td className="px-2 py-3 whitespace-nowrap">{dateFmt(row.sentAt)}</td>
                    <td className="px-2 py-3">
                      <Badge variant={statusVariant(row.tiktokStatus, row.contactSent)}>
                        {row.tiktokStatus}
                      </Badge>
                    </td>
                    <td className="max-w-[220px] truncate px-2 py-3 text-xs text-muted-foreground">
                      {row.tiktokError || (row.tiktokResponse ? JSON.stringify(row.tiktokResponse).slice(0, 80) : '—')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </TikTokIntegrationShell>
  );
}
