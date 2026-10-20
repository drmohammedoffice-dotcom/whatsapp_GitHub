'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ClipboardList, Copy, ExternalLink, Loader2, Plus, Trash2 } from 'lucide-react';
import { TikTokIntegrationShell } from '@/components/tiktok/tiktok-integration-shell';
import { PageHeader } from '@/components/shared/page-header';
import { AlertBanner } from '@/components/shared/alert-banner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useTranslation } from '@/components/providers/locale-provider';
import {
  deleteInstantForm,
  duplicateInstantForm,
  listInstantForms,
  type InstantFormView,
} from '@/lib/instant-forms/api';

export default function InstantFormsListPage() {
  const { t, locale } = useTranslation();
  const [items, setItems] = useState<InstantFormView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setItems(await listInstantForms());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <TikTokIntegrationShell>
      <PageHeader
        title={t('instantForms.title')}
        description={t('instantForms.listDesc')}
        actions={
          <div className="flex gap-2">
            <Link href="/tiktok/integration/forms/orders">
              <Button variant="outline" size="sm">
                <ClipboardList className="me-2 h-4 w-4" />
                {t('instantForms.orders')}
              </Button>
            </Link>
            <Link href="/tiktok/integration/forms/new">
              <Button size="sm">
                <Plus className="me-2 h-4 w-4" />
                {t('instantForms.create')}
              </Button>
            </Link>
          </div>
        }
      />

      {error ? <AlertBanner className="mt-4" variant="error">{error}</AlertBanner> : null}

      {loading ? (
        <div className="mt-8 flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t('common.loading')}
        </div>
      ) : items.length === 0 ? (
        <Card className="mt-6 border-0 shadow-card">
          <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
            <p className="text-muted-foreground">{t('instantForms.empty')}</p>
            <Link href="/tiktok/integration/forms/new">
              <Button>
                <Plus className="me-2 h-4 w-4" />
                {t('instantForms.create')}
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="mt-6 space-y-4">
          {items.map((item) => (
            <Card key={item.id} className="border-0 shadow-card">
              <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold">{item.name}</h3>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium">
                      {item.status}
                    </span>
                    <span className="text-xs text-muted-foreground">{item.adPlatform}</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {item.ordersCount} {locale === 'ar' ? 'طلب' : 'orders'} · {item.publicUrl}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void navigator.clipboard.writeText(item.publicUrl)}
                  >
                    <Copy className="me-1 h-3.5 w-3.5" />
                    {t('instantForms.copyLink')}
                  </Button>
                  <Link href={item.publicUrl} target="_blank">
                    <Button size="sm" variant="outline">
                      <ExternalLink className="me-1 h-3.5 w-3.5" />
                      {t('instantForms.open')}
                    </Button>
                  </Link>
                  <Link href={`/tiktok/integration/forms/${item.id}/builder`}>
                    <Button size="sm">{t('instantForms.edit')}</Button>
                  </Link>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void duplicateInstantForm(item.id).then(load)}
                  >
                    {t('instantForms.duplicate')}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive"
                    onClick={() => {
                      if (confirm(t('instantForms.deleteConfirm'))) {
                        void deleteInstantForm(item.id).then(load);
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </TikTokIntegrationShell>
  );
}
