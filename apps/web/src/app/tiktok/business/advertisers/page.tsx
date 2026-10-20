'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { TikTokBusinessShell } from '@/components/tiktok/tiktok-business-shell';
import { useTranslation } from '@/components/providers/locale-provider';
import { AlertBanner } from '@/components/shared/alert-banner';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { fetchTikTokBusinessAdvertisers } from '@/lib/tiktok-business';
import { syncTikTokBusiness } from '@/lib/tiktok-business';
import { parseApiError } from '@/lib/utils';
import { useRouter } from 'next/navigation';

export default function TikTokBusinessAdvertisersPage() {
  const { t, locale } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncingAdvertiserId, setSyncingAdvertiserId] = useState<string | null>(null);
  const [advertisers, setAdvertisers] = useState<
    Array<{ advertiserId: string; name: string | null; currency: string | null; status: string | null }>
  >([]);
  const [businessCenter, setBusinessCenter] = useState<{ id: string; name: string | null } | null>(null);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchTikTokBusinessAdvertisers();
      setAdvertisers(data.advertisers);
      setBusinessCenter(data.businessCenter);
      setLastSyncAt(data.lastSyncAt);
    } catch (err) {
      setError(parseApiError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load().catch(console.error);
  }, [load]);

  const router = useRouter();

  async function syncAdvertiser(advertiserId: string) {
    setError(null);
    setSyncingAdvertiserId(advertiserId);
    try {
      await syncTikTokBusiness(advertiserId);
      await load();
      router.push(`/tiktok/business/whatsapp-mapping?advertiserId=${encodeURIComponent(advertiserId)}`);
    } catch (err) {
      setError(parseApiError(err));
    } finally {
      setSyncingAdvertiserId(null);
    }
  }

  return (
    <TikTokBusinessShell>
      <PageHeader title={t('tiktokBusiness.nav.advertisers')} description={t('tiktokBusiness.advertisersDesc')} />
      {error && <AlertBanner className="mt-4" variant="error">{error}</AlertBanner>}

      {businessCenter && (
        <Card className="mt-4 border-0 shadow-card">
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">{t('tiktokBusiness.businessCenter')}</p>
            <p className="font-medium">{businessCenter.name ?? businessCenter.id}</p>
            {lastSyncAt && (
              <p className="mt-2 text-xs text-muted-foreground">
                {t('tiktokBusiness.lastSync')}:{' '}
                {new Date(lastSyncAt).toLocaleString(locale === 'ar' ? 'ar-SA' : 'en-US')}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      <Card className="mt-4 border-0 shadow-card">
        <CardContent className="pt-6">
          {loading ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t('common.loading')}
            </div>
          ) : advertisers.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('tiktokBusiness.noAdvertisers')}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('tiktokBusiness.advertiserName')}</TableHead>
                  <TableHead>{t('tiktokBusiness.advertiserId')}</TableHead>
                  <TableHead>{t('tiktokBusiness.currency')}</TableHead>
                  <TableHead>{t('tiktokBusiness.status')}</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {advertisers.map((a) => (
                  <TableRow key={a.advertiserId}>
                    <TableCell>{a.name ?? '—'}</TableCell>
                    <TableCell className="font-mono text-xs">{a.advertiserId}</TableCell>
                    <TableCell>{a.currency ?? '—'}</TableCell>
                    <TableCell>{a.status ?? '—'}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => void syncAdvertiser(a.advertiserId)}
                        disabled={syncingAdvertiserId === a.advertiserId}
                      >
                        {syncingAdvertiserId === a.advertiserId ? 'Syncing...' : 'Sync'}
                      </Button>
                    </TableCell>
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
