'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { TikTokBusinessShell } from '@/components/tiktok/tiktok-business-shell';
import { useTranslation } from '@/components/providers/locale-provider';
import { AlertBanner } from '@/components/shared/alert-banner';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { fetchTikTokBusinessAds, type TikTokBusinessAd } from '@/lib/tiktok-business';
import { parseApiError } from '@/lib/utils';

export default function TikTokBusinessAdsPage() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ads, setAds] = useState<TikTokBusinessAd[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchTikTokBusinessAds();
      setAds(data.ads);
    } catch (err) {
      setError(parseApiError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load().catch(console.error);
  }, [load]);

  return (
    <TikTokBusinessShell>
      <PageHeader title={t('tiktokBusiness.nav.ads')} description={t('tiktokBusiness.adsDesc')} />
      {error && <AlertBanner className="mt-4" variant="error">{error}</AlertBanner>}

      <Card className="mt-4 border-0 shadow-card">
        <CardContent className="pt-6">
          {loading ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t('common.loading')}
            </div>
          ) : ads.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('tiktokBusiness.noAds')}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('tiktokBusiness.adName')}</TableHead>
                  <TableHead>{t('tiktokBusiness.adgroupId')}</TableHead>
                  <TableHead>{t('tiktokBusiness.campaignId')}</TableHead>
                  <TableHead>{t('tiktokBusiness.status')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ads.map((ad) => (
                  <TableRow key={`${ad.advertiserId}-${ad.adId}`}>
                    <TableCell>{ad.name ?? ad.adId}</TableCell>
                    <TableCell className="font-mono text-xs">{ad.adGroupId ?? '—'}</TableCell>
                    <TableCell className="font-mono text-xs">{ad.campaignId ?? '—'}</TableCell>
                    <TableCell>{ad.status ?? '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </TikTokBusinessShell>
  );
}
