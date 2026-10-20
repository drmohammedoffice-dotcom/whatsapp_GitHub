'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { TikTokBusinessShell } from '@/components/tiktok/tiktok-business-shell';
import { useTranslation } from '@/components/providers/locale-provider';
import { AlertBanner } from '@/components/shared/alert-banner';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { fetchTikTokBusinessCampaigns, type TikTokBusinessCampaign } from '@/lib/tiktok-business';
import { parseApiError } from '@/lib/utils';

export default function TikTokBusinessCampaignsPage() {
  const { t, locale } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [campaigns, setCampaigns] = useState<TikTokBusinessCampaign[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchTikTokBusinessCampaigns();
      setCampaigns(data.campaigns);
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
      <PageHeader title={t('tiktokBusiness.nav.campaigns')} description={t('tiktokBusiness.campaignsDesc')} />
      {error && <AlertBanner className="mt-4" variant="error">{error}</AlertBanner>}

      <Card className="mt-4 border-0 shadow-card">
        <CardContent className="pt-6">
          {loading ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t('common.loading')}
            </div>
          ) : campaigns.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('tiktokBusiness.noCampaigns')}</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('tiktokBusiness.campaignName')}</TableHead>
                    <TableHead>{t('tiktokBusiness.status')}</TableHead>
                    <TableHead>{t('tiktokBusiness.metrics.spend')}</TableHead>
                    <TableHead>{t('tiktokBusiness.metrics.impressions')}</TableHead>
                    <TableHead>{t('tiktokBusiness.metrics.clicks')}</TableHead>
                    <TableHead>{t('tiktokBusiness.metrics.cpc')}</TableHead>
                    <TableHead>{t('tiktokBusiness.metrics.cpm')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {campaigns.map((c) => (
                    <TableRow key={`${c.advertiserId}-${c.campaignId}`}>
                      <TableCell>
                        <div>{c.name ?? c.campaignId}</div>
                        <div className="text-xs text-muted-foreground">{c.objective ?? '—'}</div>
                      </TableCell>
                      <TableCell>{c.status ?? '—'}</TableCell>
                      <TableCell>{fmt(c.spend)}</TableCell>
                      <TableCell>{fmt(c.impressions)}</TableCell>
                      <TableCell>{fmt(c.clicks)}</TableCell>
                      <TableCell>{fmt(c.cpc)}</TableCell>
                      <TableCell>{fmt(c.cpm)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </TikTokBusinessShell>
  );
}
