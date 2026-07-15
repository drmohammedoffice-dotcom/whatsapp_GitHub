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
} from '@/lib/tiktok-integration';
import { parseApiError } from '@/lib/utils';

function statusVariant(status: string, contactSent: boolean): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (contactSent || status === 'sent') return 'default';
  if (status === 'failed') return 'destructive';
  if (status === 'pending') return 'secondary';
  return 'outline';
}

export default function TikTokContactDebugPage() {
  const { t, locale } = useTranslation();
  const [rows, setRows] = useState<TikTokContactDebugRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchTikTokContactDebug(undefined, 150);
      setRows(data.rows);
    } catch (err) {
      setError(parseApiError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const dateFmt = (value: string | null) => {
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

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('tiktokIntegration.debug.tableTitle')}</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {loading && rows.length === 0 ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : rows.length === 0 ? (
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
                      {row.retryCount > 0 ? (
                        <span className="mt-1 block text-xs text-muted-foreground">
                          {t('tiktokIntegration.debug.retries')}: {row.retryCount}
                        </span>
                      ) : null}
                    </td>
                    <td className="max-w-[280px] px-2 py-3">
                      {row.tiktokError ? (
                        <p className="text-xs text-destructive">{row.tiktokError}</p>
                      ) : null}
                      {row.tiktokResponse ? (
                        <pre className="max-h-28 overflow-auto rounded bg-muted/60 p-2 text-[10px] leading-relaxed">
                          {JSON.stringify(row.tiktokResponse, null, 2)}
                        </pre>
                      ) : !row.tiktokError ? (
                        <span className="text-muted-foreground">—</span>
                      ) : null}
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
