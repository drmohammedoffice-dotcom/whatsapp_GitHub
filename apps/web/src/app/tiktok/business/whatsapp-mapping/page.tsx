'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ChevronDown, ExternalLink, Loader2, Pencil, RefreshCw, Trash2 } from 'lucide-react';
import { TikTokBusinessShell } from '@/components/tiktok/tiktok-business-shell';
import { useTranslation } from '@/components/providers/locale-provider';
import { AlertBanner } from '@/components/shared/alert-banner';
import { PageHeader } from '@/components/shared/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  createTikTokEventSet,
  deleteTikTokMessagingMapping,
  fetchTikTokAdvertiserOptions,
  fetchTikTokEventSets,
  fetchTikTokWhatsAppMappings,
  fetchTikTokWhatsAppNumbers,
  reconnectTikTokBusinessForEvents,
  saveTikTokMessagingMapping,
  syncTikTokEventSet,
  type MessageEventSetStatus,
  type TikTokEventSet,
  type TikTokWhatsAppMapping,
  type TikTokWhatsAppNumber,
} from '@/lib/tiktok-business';
import { cn, parseApiError } from '@/lib/utils';

type AdvertiserOption = { advertiserId: string; name: string | null; currency: string | null; status: string | null };

function formatAdvertiserLabel(a: AdvertiserOption) {
  return a.name ? `${a.name} — ${a.advertiserId}` : a.advertiserId;
}

function statusBadge(status: MessageEventSetStatus | null, t: (k: string) => string) {
  switch (status) {
    case 'CREATED':
      return <Badge variant="success">{t('tiktokBusiness.eventSet.statusCreated')}</Badge>;
    case 'CREATING':
      return <Badge variant="secondary">{t('tiktokBusiness.eventSet.statusCreating')}</Badge>;
    case 'FAILED':
      return <Badge variant="destructive">{t('tiktokBusiness.eventSet.statusFailed')}</Badge>;
    case 'PERMISSION_ERROR':
      return <Badge variant="destructive">{t('tiktokBusiness.eventSet.statusPermissionError')}</Badge>;
    case 'TOKEN_EXPIRED':
      return <Badge variant="destructive">{t('tiktokBusiness.eventSet.statusTokenExpired')}</Badge>;
    case 'UNSUPPORTED_ADVERTISER':
      return <Badge variant="destructive">{t('tiktokBusiness.eventSet.statusUnsupported')}</Badge>;
  }
  return <Badge variant="secondary">{t('tiktokBusiness.eventSet.statusPending')}</Badge>;
}

export default function TikTokBusinessMappingPage() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [active, setActive] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [advertisers, setAdvertisers] = useState<AdvertiserOption[]>([]);
  const [numbers, setNumbers] = useState<TikTokWhatsAppNumber[]>([]);
  const [mappings, setMappings] = useState<TikTokWhatsAppMapping[]>([]);
  const [eventSets, setEventSets] = useState<TikTokEventSet[]>([]);

  const [advertiserSearch, setAdvertiserSearch] = useState('');
  const [advertiserPickerOpen, setAdvertiserPickerOpen] = useState(false);
  const [selectedAdvertiser, setSelectedAdvertiser] = useState<string>('');
  const advertiserPickerRef = useRef<HTMLDivElement>(null);
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [eventSetName, setEventSetName] = useState('');
  const [eventSetId, setEventSetId] = useState('');
  const [currentEventSet, setCurrentEventSet] = useState<TikTokEventSet | null>(null);
  const [eventSetBusy, setEventSetBusy] = useState(false);
  const [errorModalOpen, setErrorModalOpen] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [adv, nums, maps, sets] = await Promise.all([
        fetchTikTokAdvertiserOptions().catch(() => ({ advertisers: [] as AdvertiserOption[] })),
        fetchTikTokWhatsAppNumbers().catch(() => ({ numbers: [] as TikTokWhatsAppNumber[] })),
        fetchTikTokWhatsAppMappings().catch(() => [] as TikTokWhatsAppMapping[]),
        fetchTikTokEventSets().catch(() => [] as TikTokEventSet[]),
      ]);
      setAdvertisers(adv.advertisers);
      setNumbers(nums.numbers);
      setMappings(maps);
      setEventSets(sets);
    } catch (err) {
      setError(parseApiError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load().catch(console.error);
    const sp = new URLSearchParams(window.location.search);
    const preset = sp.get('advertiserId');
    if (preset) setSelectedAdvertiser(preset);
  }, [load]);

  const normalizedWhatsapp = whatsappNumber.replace(/\D/g, '');

  useEffect(() => {
    if (!selectedAdvertiser || !normalizedWhatsapp) {
      setCurrentEventSet(null);
      return;
    }
    const existing = eventSets.find(
      (s) => s.advertiserId === selectedAdvertiser && s.whatsappNumber === normalizedWhatsapp,
    );
    setCurrentEventSet(existing ?? null);
    if (existing?.eventSetName && !eventSetName) {
      setEventSetName(existing.eventSetName);
    } else if (!existing && !eventSetName) {
      setEventSetName(`WhatsApp ${normalizedWhatsapp}`);
    }
    if (existing?.eventSetId && !eventSetId) {
      setEventSetId(existing.eventSetId);
    }
  }, [selectedAdvertiser, normalizedWhatsapp, eventSets, eventSetName, eventSetId]);

  const filteredAdvertisers = useMemo(() => {
    const q = advertiserSearch.trim().toLowerCase();
    if (!q) return advertisers;
    return advertisers.filter(
      (a) => (a.name ?? '').toLowerCase().includes(q) || a.advertiserId.includes(q),
    );
  }, [advertisers, advertiserSearch]);

  const selectedAdvertiserOption = useMemo(
    () => advertisers.find((a) => a.advertiserId === selectedAdvertiser) ?? null,
    [advertisers, selectedAdvertiser],
  );

  useEffect(() => {
    if (!advertiserPickerOpen) return;
    function onPointerDown(event: MouseEvent) {
      if (advertiserPickerRef.current && !advertiserPickerRef.current.contains(event.target as Node)) {
        setAdvertiserPickerOpen(false);
      }
    }
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [advertiserPickerOpen]);

  function selectAdvertiser(advertiserId: string) {
    setSelectedAdvertiser(advertiserId);
    setAdvertiserSearch('');
    setAdvertiserPickerOpen(false);
    setEventSetName('');
    setEventSetId('');
  }

  function applyEventSetResult(result: TikTokEventSet) {
    setCurrentEventSet(result);
    setEventSets((prev) => {
      const others = prev.filter((s) => s.id !== result.id);
      return [result, ...others];
    });
  }

  async function createOrSyncEventSet(mode: 'create' | 'sync') {
    if (!selectedAdvertiser || !normalizedWhatsapp) return;
    setEventSetBusy(true);
    setError(null);
    try {
      const name = eventSetName.trim() || `WhatsApp ${normalizedWhatsapp}`;
      const result =
        mode === 'sync'
          ? await syncTikTokEventSet(selectedAdvertiser, normalizedWhatsapp, name)
          : await createTikTokEventSet(selectedAdvertiser, normalizedWhatsapp, name);
      applyEventSetResult(result);
      if (result.status === 'CREATED' && result.eventSetId) {
        setNotice(t('tiktokBusiness.mappingSaved'));
      } else if (result.status === 'PERMISSION_ERROR' || result.status === 'TOKEN_EXPIRED') {
        setError(result.errorMessage ?? result.message ?? 'Permission or token error');
      } else if (result.status !== 'CREATING' && result.status !== 'PENDING') {
        setError(result.errorMessage ?? result.message ?? 'Event set creation failed');
      }
    } catch (err) {
      setError(parseApiError(err));
    } finally {
      setEventSetBusy(false);
    }
  }

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

  async function save() {
    if (!selectedAdvertiser || !normalizedWhatsapp) {
      setError(t('tiktokBusiness.mappingSelectAdvertiserAndPhone'));
      return;
    }
    if (normalizedWhatsapp.length < 8) {
      setError(t('tiktokBusiness.mappingInvalidPhone'));
      return;
    }
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const name = eventSetName.trim() || `WhatsApp ${normalizedWhatsapp} — ${selectedAdvertiser}`;
      const { eventSet } = await saveTikTokMessagingMapping({
        id: editingId ?? undefined,
        advertiserId: selectedAdvertiser,
        whatsappNumber: normalizedWhatsapp,
        eventSetName: name,
        eventSetId: eventSetId.trim() || undefined,
        isActive: active,
      });
      applyEventSetResult(eventSet);
      setNotice(
        editingId
          ? t('tiktokBusiness.mappingUpdated')
          : eventSet.status === 'CREATED' && eventSet.eventSetId
            ? t('tiktokBusiness.mappingSaved')
            : eventSet.status === 'PENDING' || eventSet.status === 'CREATING'
              ? t('tiktokBusiness.mappingSavedPending')
              : `${t('tiktokBusiness.mappingSavedError')} ${eventSet.errorMessage ?? eventSet.message ?? 'unknown error'}`,
      );
      resetForm();
      await load();
    } catch (err) {
      setError(parseApiError(err));
    } finally {
      setSaving(false);
    }
  }

  function resetForm() {
    setEditingId(null);
    setSelectedAdvertiser('');
    setWhatsappNumber('');
    setEventSetName('');
    setEventSetId('');
    setAdvertiserSearch('');
    setAdvertiserPickerOpen(false);
    setActive(true);
    setCurrentEventSet(null);
  }

  function startEdit(row: TikTokWhatsAppMapping) {
    setEditingId(row.id);
    if (row.advertiserId) selectAdvertiser(row.advertiserId);
    else setSelectedAdvertiser('');
    setWhatsappNumber(row.whatsappNumber);
    setEventSetId(row.eventSetId ?? '');
    setActive(row.isActive);
    setError(null);
    setNotice(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function removeMapping(row: TikTokWhatsAppMapping) {
    if (!window.confirm(t('tiktokBusiness.mappingDeleteConfirm'))) return;
    setDeletingId(row.id);
    setError(null);
    setNotice(null);
    try {
      await deleteTikTokMessagingMapping(row.id);
      if (editingId === row.id) resetForm();
      setNotice(t('tiktokBusiness.mappingDeleted'));
      await load();
    } catch (err) {
      setError(parseApiError(err));
    } finally {
      setDeletingId(null);
    }
  }

  const hasErrorDetails =
    currentEventSet?.errorCode || currentEventSet?.errorMessage || currentEventSet?.message;

  return (
    <TikTokBusinessShell>
      <PageHeader
        title={t('tiktokBusiness.nav.whatsappMapping')}
        description={t('tiktokBusiness.whatsappMappingDesc')}
        actions={
          <Link href="/tiktok/business/settings/event-set-diagnostics">
            <Button variant="outline" size="sm" className="gap-2">
              <ExternalLink className="h-4 w-4" />
              {t('tiktokBusiness.nav.eventSetDiagnostics')}
            </Button>
          </Link>
        }
      />
      {notice && <AlertBanner className="mt-4" variant="success">{notice}</AlertBanner>}
      {error && <AlertBanner className="mt-4" variant="error">{error}</AlertBanner>}

      <Card className="mt-4 border-0 shadow-card">
        <CardContent className="pt-6">
          {editingId && (
            <div className="mb-4 flex items-center justify-between rounded-md border border-primary/30 bg-primary/5 px-3 py-2">
              <span className="text-sm font-medium">{t('tiktokBusiness.mappingEditing')}</span>
              <Button variant="ghost" size="sm" onClick={resetForm}>
                {t('common.cancel')}
              </Button>
            </div>
          )}
          {loading ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t('common.loading')}
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {/* Advertiser picker — unchanged structure */}
              <div className="space-y-2 md:col-span-2" ref={advertiserPickerRef}>
                <Label>{t('tiktokBusiness.advertiserName')}</Label>
                <Button
                  type="button"
                  variant="outline"
                  className="h-auto min-h-10 w-full justify-between gap-2 whitespace-normal py-2 text-left font-normal"
                  onClick={() => setAdvertiserPickerOpen((open) => !open)}
                >
                  <span className={cn('line-clamp-2', !selectedAdvertiserOption && 'text-muted-foreground')}>
                    {selectedAdvertiserOption
                      ? formatAdvertiserLabel(selectedAdvertiserOption)
                      : t('tiktokBusiness.selectAdvertiserButton')}
                  </span>
                  <ChevronDown
                    className={cn('h-4 w-4 shrink-0 opacity-50 transition-transform', advertiserPickerOpen && 'rotate-180')}
                  />
                </Button>
                {advertiserPickerOpen && (
                  <div className="rounded-lg border bg-popover p-2 shadow-card">
                    <Input
                      autoFocus
                      placeholder={t('tiktokBusiness.searchAdvertisers')}
                      value={advertiserSearch}
                      onChange={(e) => setAdvertiserSearch(e.target.value)}
                    />
                    <div className="mt-2 max-h-72 overflow-y-auto rounded-md border">
                      {filteredAdvertisers.map((a) => (
                        <button
                          key={a.advertiserId}
                          type="button"
                          className={cn(
                            'flex w-full items-start px-3 py-2.5 text-left text-sm transition-colors hover:bg-accent',
                            selectedAdvertiser === a.advertiserId && 'bg-accent font-medium',
                          )}
                          onClick={() => selectAdvertiser(a.advertiserId)}
                        >
                          {formatAdvertiserLabel(a)}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label>{t('tiktok.defaultWhatsApp')}</Label>
                <Input
                  inputMode="tel"
                  placeholder={t('tiktokBusiness.whatsappNumberPlaceholder')}
                  value={whatsappNumber}
                  onChange={(e) => setWhatsappNumber(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">{t('tiktokBusiness.whatsappNumberHint')}</p>
                {numbers.length > 0 && (
                  <Select
                    value={numbers.some((n) => n.phoneNumber === normalizedWhatsapp) ? normalizedWhatsapp : '__none__'}
                    onValueChange={(v) => { if (v !== '__none__') setWhatsappNumber(v); }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t('tiktokBusiness.whatsappNumberQuickPick')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">{t('tiktokBusiness.whatsappNumberManual')}</SelectItem>
                      {numbers.map((n) => (
                        <SelectItem key={`${n.source}-${n.id}`} value={n.phoneNumber}>
                          {n.label}{!n.connected ? ` — ${t('tiktokBusiness.numberDisconnected')}` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              <div className="space-y-2 md:col-span-2 rounded-lg border border-blue-200 bg-blue-50/60 p-4 dark:border-blue-900 dark:bg-blue-950/30">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium">{t('tiktokBusiness.eventSet.manualStepsTitle')}</p>
                  <a
                    href="https://ads.tiktok.com/i18n/events_manager"
                    target="_blank"
                    rel="noreferrer"
                  >
                    <Button variant="outline" size="sm" className="gap-2">
                      <ExternalLink className="h-4 w-4" />
                      {t('tiktokBusiness.eventSet.openEventsManager')}
                    </Button>
                  </a>
                </div>
                <ol className="ms-4 list-decimal space-y-1 text-xs text-muted-foreground">
                  <li>{t('tiktokBusiness.eventSet.manualStep1')}</li>
                  <li>{t('tiktokBusiness.eventSet.manualStep2')}</li>
                  <li>{t('tiktokBusiness.eventSet.manualStep3')}</li>
                  <li>{t('tiktokBusiness.eventSet.manualStep4')}</li>
                </ol>
              </div>

              <div className="space-y-2">
                <Label>{t('tiktokBusiness.eventSet.name')}</Label>
                <Input
                  placeholder={t('tiktokBusiness.eventSet.namePlaceholder')}
                  value={eventSetName}
                  onChange={(e) => setEventSetName(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>{t('tiktokBusiness.eventSet.idLabel')}</Label>
                <Input
                  className="font-mono"
                  placeholder={t('tiktokBusiness.eventSet.idPlaceholder')}
                  value={eventSetId}
                  onChange={(e) => setEventSetId(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">{t('tiktokBusiness.eventSet.idHint')}</p>
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label>{t('tiktokBusiness.status')}</Label>
                <div className="flex h-10 flex-wrap items-center gap-2">
                  {statusBadge(currentEventSet?.status ?? null, t)}
                  {hasErrorDetails && (
                    <Button variant="link" size="sm" className="h-auto p-0 text-xs" onClick={() => setErrorModalOpen(true)}>
                      {t('tiktokBusiness.eventSet.errorDetails')}
                    </Button>
                  )}
                </div>
                {currentEventSet?.eventSetId && (
                  <p className="text-xs font-mono text-muted-foreground">ID: {currentEventSet.eventSetId}</p>
                )}
              </div>

              <div className="flex items-center justify-between rounded-md border p-3 md:col-span-2">
                <span className="text-sm text-muted-foreground">{t('tiktokBusiness.mappingActive')}</span>
                <Switch checked={active} onCheckedChange={setActive} />
              </div>

              <div className="flex flex-wrap items-end gap-2 md:col-span-2">
                <Button
                  variant="outline"
                  onClick={() => void createOrSyncEventSet('sync')}
                  disabled={eventSetBusy || !selectedAdvertiser || !normalizedWhatsapp}
                >
                  <RefreshCw className={cn('me-2 h-4 w-4', eventSetBusy && 'animate-spin')} />
                  {t('tiktokBusiness.eventSet.refreshStatus')}
                </Button>
                {(currentEventSet?.status === 'PERMISSION_ERROR' || currentEventSet?.status === 'TOKEN_EXPIRED') && (
                  <Button variant="outline" onClick={() => void handleReconnect()} disabled={reconnecting}>
                    {reconnecting ? <Loader2 className="h-4 w-4 animate-spin" /> : t('tiktokBusiness.eventSet.reconnect')}
                  </Button>
                )}
                {editingId && (
                  <Button variant="outline" onClick={resetForm}>{t('common.cancel')}</Button>
                )}
                <Button onClick={() => void save()} disabled={saving || !selectedAdvertiser || !normalizedWhatsapp}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : t('common.save')}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="mt-4 border-0 shadow-card">
        <CardContent className="pt-6">
          {loading ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t('common.loading')}
            </div>
          ) : mappings.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('tiktokBusiness.noMappings')}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Advertiser</TableHead>
                  <TableHead>{t('tiktok.defaultWhatsApp')}</TableHead>
                  <TableHead>{t('tiktokBusiness.eventSet.name')}</TableHead>
                  <TableHead>Event Set ID</TableHead>
                  <TableHead>{t('tiktokBusiness.status')}</TableHead>
                  <TableHead className="w-[120px] text-end">{t('tiktokBusiness.mappingActions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mappings.map((row) => {
                  const advertiser = advertisers.find((a) => a.advertiserId === row.advertiserId);
                  const set = eventSets.find(
                    (s) => s.advertiserId === row.advertiserId && s.whatsappNumber === row.whatsappNumber,
                  );
                  const isEditing = editingId === row.id;
                  const isDeleting = deletingId === row.id;
                  return (
                    <TableRow key={row.id} className={isEditing ? 'bg-primary/5' : undefined}>
                      <TableCell>
                        {advertiser?.name ? `${advertiser.name} — ${row.advertiserId}` : (row.advertiserId ?? '—')}
                      </TableCell>
                      <TableCell>+{row.whatsappNumber}</TableCell>
                      <TableCell className="text-sm">{set?.eventSetName ?? '—'}</TableCell>
                      <TableCell className="font-mono text-xs">
                        {row.eventSetId ?? set?.eventSetId ?? '—'}
                      </TableCell>
                      <TableCell>
                        {row.isActive
                          ? statusBadge(set?.status ?? 'PENDING', t)
                          : <Badge variant="secondary">DISABLED</Badge>}
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => startEdit(row)} disabled={isDeleting}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => void removeMapping(row)} disabled={isDeleting}>
                            {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4 text-destructive" />}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={errorModalOpen} onOpenChange={setErrorModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('tiktokBusiness.eventSet.errorDetails')}</DialogTitle>
            <DialogDescription>
              {currentEventSet?.status && statusBadge(currentEventSet.status, t)}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            {currentEventSet?.errorCode && (
              <div>
                <p className="font-medium text-muted-foreground">Error Code</p>
                <p className="font-mono">{currentEventSet.errorCode}</p>
              </div>
            )}
            {(currentEventSet?.errorMessage || currentEventSet?.message) && (
              <div>
                <p className="font-medium text-muted-foreground">Message</p>
                <p>{currentEventSet.errorMessage ?? currentEventSet.message}</p>
              </div>
            )}
            {currentEventSet?.eventSetId && (
              <div>
                <p className="font-medium text-muted-foreground">Event Set ID</p>
                <p className="font-mono">{currentEventSet.eventSetId}</p>
              </div>
            )}
            {(currentEventSet?.status === 'PERMISSION_ERROR' || currentEventSet?.status === 'TOKEN_EXPIRED') && (
              <Button onClick={() => void handleReconnect()} disabled={reconnecting} className="w-full">
                {t('tiktokBusiness.eventSet.reconnect')}
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </TikTokBusinessShell>
  );
}
