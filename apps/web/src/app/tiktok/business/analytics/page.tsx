'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { TikTokBusinessShell } from '@/components/tiktok/tiktok-business-shell';
import { useTranslation } from '@/components/providers/locale-provider';
import { AlertBanner } from '@/components/shared/alert-banner';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { fetchTikTokBusinessAnalytics, type TikTokBusinessAnalytics } from '@/lib/tiktok-business';
import { parseApiError } from '@/lib/utils';

export default function TikTokBusinessAnalyticsPage() {
  const { t, locale } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [analytics, setAnalytics] = useState<TikTokBusinessAnalytics | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setAnalytics(await fetchTikTokBusinessAnalytics());
    } catch (err) {
      setError(parseApiError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load().catch(console.error);
  }, [load]);

  const fmt = (n: number) => new Intl.NumberFormat(locale === 'ar' ? 'ar-SA' : 'en-US').format(n);

  return (
    <TikTokBusinessShell>
      <PageHeader title={t('tiktokBusiness.nav.analytics')} description={t('tiktokBusiness.analyticsDesc')} />
      {error && <AlertBanner className="mt-4" variant="error">{error}</AlertBanner>}

      {loading ? (
        <div className="mt-8 flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t('common.loading')}
        </div>
      ) : (
        <>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: t('tiktokBusiness.metrics.spend'), value: fmt(analytics?.totals.spend ?? 0) },
              { label: t('tiktokBusiness.metrics.ctr'), value: `${analytics?.totals.ctr ?? 0}%` },
              { label: t('tiktokBusiness.metrics.conversations'), value: fmt(analytics?.totals.conversations ?? 0) },
              { label: t('tiktokBusiness.metrics.costPerConversation'), value: fmt(analytics?.totals.costPerConversation ?? 0) },
              { label: t('tiktokBusiness.metrics.avgCpc'), value: fmt(analytics?.totals.avgCpc ?? 0) },
              { label: t('tiktokBusiness.metrics.avgCpm'), value: fmt(analytics?.totals.avgCpm ?? 0) },
            ].map((item) => (
              <Card key={item.label} className="border-0 shadow-card">
                <CardHeader className="pb-2">
                  <CardDescription>{item.label}</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-semibold">{item.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="mt-6 border-0 shadow-card">
            <CardHeader>
              <CardTitle>{t('tiktokBusiness.topCampaigns')}</CardTitle>
              <CardDescription>{t('tiktokBusiness.topCampaignsDesc')}</CardDescription>
            </CardHeader>
            <CardContent>
              {!analytics?.topCampaigns.length ? (
                <p className="text-sm text-muted-foreground">{t('tiktokBusiness.noCampaigns')}</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('tiktokBusiness.campaignName')}</TableHead>
                      <TableHead>{t('tiktokBusiness.metrics.spend')}</TableHead>
                      <TableHead>{t('tiktokBusiness.metrics.impressions')}</TableHead>
                      <TableHead>{t('tiktokBusiness.metrics.clicks')}</TableHead>
                      <TableHead>{t('tiktokBusiness.metrics.conversions')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {analytics.topCampaigns.map((c) => (
                      <TableRow key={`${c.advertiserId}-${c.campaignId}`}>
                        <TableCell>{c.name ?? c.campaignId}</TableCell>
                        <TableCell>{fmt(c.spend)}</TableCell>
                        <TableCell>{fmt(c.impressions)}</TableCell>
                        <TableCell>{fmt(c.clicks)}</TableCell>
                        <TableCell>{fmt(c.conversions)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
          <Card className="mt-6 border-0 shadow-card">
            <CardHeader>
              <CardTitle>Top WhatsApp Numbers</CardTitle>
            </CardHeader>
            <CardContent>
              {!analytics?.topWhatsAppNumbers.length ? (
                <p className="text-sm text-muted-foreground">{t('tiktokBusiness.noMappings')}</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>WhatsApp</TableHead>
                      <TableHead>Mappings</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {analytics.topWhatsAppNumbers.map((row) => (
                      <TableRow key={row.whatsappNumber}>
                        <TableCell>{row.whatsappNumber}</TableCell>
                        <TableCell>{fmt(row.mappings)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </TikTokBusinessShell>
  );
}
