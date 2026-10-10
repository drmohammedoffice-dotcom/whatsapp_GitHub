'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { AppShell } from '@/components/layout/app-shell';
import { useTranslation } from '@/components/providers/locale-provider';
import { AlertBanner } from '@/components/shared/alert-banner';
import { LoadingBlock } from '@/components/shared/loading-block';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { MetaOAuthConnect } from '@/components/integrations/meta-oauth-connect';
import { api, parseApiError } from '@/lib/utils';

type PageOption = {
  id: string;
  name: string;
  pictureUrl?: string;
  instagram?: {
    id: string;
    username?: string;
    name?: string;
    profilePictureUrl?: string;
  } | null;
};

function MetaPageSelectContent() {
  const { t } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('session') ?? '';
  const target = searchParams.get('target');
  const isInstagramMode = target === 'instagram';
  const urlError = searchParams.get('error');

  const [pages, setPages] = useState<PageOption[]>([]);
  const [selectedPages, setSelectedPages] = useState<Set<string>>(new Set());
  const [selectedInstagram, setSelectedInstagram] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(urlError ? decodeURIComponent(urlError) : null);
  const [noInstagramLinked, setNoInstagramLinked] = useState(false);

  const pagesWithInstagram = useMemo(
    () => pages.filter((p) => p.instagram?.id),
    [pages],
  );

  const filteredPages = useMemo(() => {
    const q = search.trim().toLowerCase();
    const sorted = isInstagramMode
      ? [...pages].sort((a, b) => Number(Boolean(b.instagram)) - Number(Boolean(a.instagram)))
      : pages;
    if (!q) return sorted;
    return sorted.filter((p) => p.name.toLowerCase().includes(q));
  }, [pages, search, isInstagramMode]);

  const load = useCallback(async () => {
    if (!sessionId) {
      setError(t('integrations.missingOAuthSession'));
      setLoading(false);
      return;
    }
    try {
      const data = await api<{ pages: PageOption[] }>(`/meta/oauth/pages?session=${sessionId}`);
      setPages(data.pages);
      if (isInstagramMode) {
        const igPages = data.pages.filter((p) => p.instagram?.id);
        setSelectedPages(new Set(igPages.map((p) => p.id)));
        setSelectedInstagram(new Set(igPages.map((p) => p.instagram!.id)));
        setNoInstagramLinked(Boolean(data.pages.length && !igPages.length));
      } else {
        setNoInstagramLinked(false);
        setSelectedPages(new Set(data.pages.map((p) => p.id)));
        setSelectedInstagram(new Set(
          data.pages.filter((p) => p.instagram).map((p) => p.instagram!.id),
        ));
      }
      if (!data.pages.length) {
        setError(t('integrations.noPagesFound'));
      }
    } catch (err) {
      setError(parseApiError(err));
    } finally {
      setLoading(false);
    }
  }, [sessionId, t, isInstagramMode]);

  useEffect(() => { load().catch(console.error); }, [load]);

  function togglePage(page: PageOption) {
    setSelectedPages((prev) => {
      const next = new Set(prev);
      if (next.has(page.id)) {
        next.delete(page.id);
        if (page.instagram) {
          setSelectedInstagram((igPrev) => {
            const igNext = new Set(igPrev);
            igNext.delete(page.instagram!.id);
            return igNext;
          });
        }
      } else {
        next.add(page.id);
        if (page.instagram) {
          setSelectedInstagram((igPrev) => new Set(igPrev).add(page.instagram!.id));
        }
      }
      return next;
    });
  }

  function toggleInstagram(page: PageOption, igId: string) {
    if (!selectedPages.has(page.id)) return;
    setSelectedInstagram((prev) => {
      const next = new Set(prev);
      if (next.has(igId)) next.delete(igId);
      else next.add(igId);
      return next;
    });
  }

  function selectAll() {
    if (isInstagramMode) {
      setSelectedPages(new Set(pagesWithInstagram.map((p) => p.id)));
      setSelectedInstagram(new Set(pagesWithInstagram.map((p) => p.instagram!.id)));
      return;
    }
    setSelectedPages(new Set(pages.map((p) => p.id)));
    setSelectedInstagram(new Set(pages.filter((p) => p.instagram).map((p) => p.instagram!.id)));
  }

  function deselectAll() {
    setSelectedPages(new Set());
    setSelectedInstagram(new Set());
  }

  async function complete() {
    setBusy(true);
    setError(null);
    try {
      await api('/meta/oauth/complete', {
        method: 'POST',
        body: JSON.stringify({
          sessionId,
          pageIds: Array.from(selectedPages),
          instagramIds: Array.from(selectedInstagram),
          mode: isInstagramMode ? 'instagram' : 'both',
        }),
      });
      router.push(isInstagramMode ? '/instagram?connected=1' : '/settings/integrations?connected=1');
    } catch (err) {
      setError(parseApiError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {error && <AlertBanner className="mt-4" message={error} onDismiss={() => setError(null)} />}

      {loading ? (
        <LoadingBlock className="mt-6" />
      ) : pages.length > 0 ? (
        <div className="mt-6 space-y-4">
          {isInstagramMode && noInstagramLinked && (
            <AlertBanner variant="warning" message={t('integrations.noInstagramBusinessAccount')} />
          )}
          {isInstagramMode && pagesWithInstagram.length > 0 && (
            <p className="text-sm font-medium text-primary">
              {t('integrations.instagramPagesFoundCount').replace('{count}', String(pagesWithInstagram.length))}
            </p>
          )}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">
                {isInstagramMode ? t('integrations.selectInstagramHint') : t('integrations.selectPagesHint')}
              </p>
              <p className="text-xs font-medium text-foreground">
                {t('integrations.pagesFoundCount').replace('{count}', String(pages.length))}
                {search.trim()
                  ? ` · ${t('integrations.pagesFilteredCount').replace('{count}', String(filteredPages.length))}`
                  : ''}
              </p>
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" onClick={selectAll}>
                {t('integrations.selectAll')}
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={deselectAll}>
                {t('integrations.deselectAll')}
              </Button>
            </div>
          </div>

          {pages.length > 6 && (
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('integrations.searchPages')}
              className="max-w-md"
            />
          )}

          <p className="text-xs text-muted-foreground">
            {isInstagramMode ? t('integrations.selectInstagramPagesDesc') : t('integrations.facebookPagePickerHint')}
          </p>

          {pages.length > 6 && (
            <p className="text-xs font-medium text-primary">{t('integrations.scrollPagesHint')}</p>
          )}

          <div
            className={
              pages.length > 6
                ? 'max-h-[min(58vh,560px)] min-h-[280px] overflow-y-auto overscroll-y-contain rounded-xl border bg-muted/10 p-2 [scrollbar-gutter:stable] [scrollbar-width:thin]'
                : undefined
            }
          >
            <div className="space-y-4 pe-1">
              {filteredPages.map((page) => (
            <Card key={page.id} className="border-0 shadow-card">
              <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
                <div className="flex flex-1 items-center gap-4">
                  <Switch
                    checked={selectedPages.has(page.id)}
                    onCheckedChange={() => togglePage(page)}
                    disabled={isInstagramMode && !page.instagram}
                  />
                  {page.pictureUrl ? (
                    <Image src={page.pictureUrl} alt="" width={48} height={48} className="rounded-full" unoptimized />
                  ) : (
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 font-semibold text-primary">
                      {page.name.charAt(0)}
                    </div>
                  )}
                  <div>
                    <p className="font-medium">{page.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {isInstagramMode ? t('integrations.selectInstagramPages') : t('integrations.messengerChannel')}
                    </p>
                    {isInstagramMode && !page.instagram && (
                      <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                        {t('integrations.pageNoInstagramLinked')}
                      </p>
                    )}
                  </div>
                </div>

                {page.instagram && (
                  <div className="flex items-center gap-3 rounded-lg border bg-muted/20 p-3 sm:min-w-[260px]">
                    <Switch
                      checked={selectedInstagram.has(page.instagram.id)}
                      onCheckedChange={() => toggleInstagram(page, page.instagram!.id)}
                      disabled={!selectedPages.has(page.id)}
                    />
                    {page.instagram.profilePictureUrl ? (
                      <Image
                        src={page.instagram.profilePictureUrl}
                        alt=""
                        width={40}
                        height={40}
                        className="rounded-full"
                        unoptimized
                      />
                    ) : null}
                    <div>
                      <p className="text-sm font-medium">{page.instagram.name ?? page.instagram.username}</p>
                      {page.instagram.username && (
                        <p className="text-xs text-muted-foreground">@{page.instagram.username}</p>
                      )}
                      <p className="text-xs text-muted-foreground">{t('integrations.instagramChannel')}</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
              ))}

              {filteredPages.length === 0 && (
                <p className="py-8 text-center text-sm text-muted-foreground">{t('integrations.noPagesMatchSearch')}</p>
              )}
            </div>
          </div>

          <div className="sticky bottom-0 z-10 flex flex-wrap items-center gap-3 border-t bg-background/95 pt-4 backdrop-blur supports-[backdrop-filter]:bg-background/80">
            <p className="text-sm text-muted-foreground">
              {t('integrations.selectedPagesCount')
                .replace('{count}', String(selectedPages.size))
                .replace('{total}', String(pages.length))}
            </p>
            <Button
              className="sm:min-w-[200px]"
              disabled={
                busy
                || selectedPages.size === 0
                || (isInstagramMode && selectedInstagram.size === 0)
              }
              onClick={() => complete().catch(console.error)}
            >
              {busy ? t('integrations.connecting') : t('integrations.finishConnect')}
            </Button>
            <Button variant="outline" asChild>
              <Link href={isInstagramMode ? '/instagram' : '/integrations'}>{t('common.cancel')}</Link>
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          {!error && <p className="text-sm text-muted-foreground">{t('integrations.noPagesFound')}</p>}
          <div className="flex flex-wrap gap-3">
            <MetaOAuthConnect
              className="gap-2 sm:min-w-[220px]"
              label={isInstagramMode ? t('integrations.connectInstagram') : t('integrations.connectFacebook')}
              target={isInstagramMode ? 'instagram' : 'messenger'}
              onError={setError}
            />
            <Button variant="outline" asChild>
              <Link href={isInstagramMode ? '/instagram' : '/settings/integrations'}>{t('common.back')}</Link>
            </Button>
          </div>
        </div>
      )}
    </>
  );
}

export default function MetaPageSelectPage() {
  const { t } = useTranslation();

  return (
    <AppShell>
      <Suspense fallback={<LoadingBlock className="mt-6" />}>
        <MetaPageSelectHeader />
        <MetaPageSelectContent />
      </Suspense>
    </AppShell>
  );
}

function MetaPageSelectHeader() {
  const { t } = useTranslation();
  const searchParams = useSearchParams();
  const isInstagramMode = searchParams.get('target') === 'instagram';

  return (
    <PageHeader
      title={isInstagramMode ? t('integrations.selectInstagramPages') : t('integrations.selectPages')}
      description={isInstagramMode ? t('integrations.selectInstagramPagesDesc') : t('integrations.selectPagesDesc')}
    />
  );
}
