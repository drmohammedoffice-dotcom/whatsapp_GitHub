'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  ClipboardList,
  Download,
  FileSpreadsheet,
  Loader2,
  Pencil,
  Search,
  Trash2,
} from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { useTranslation } from '@/components/providers/locale-provider';
import { EmptyState } from '@/components/shared/empty-state';
import { PageHeader } from '@/components/shared/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { api, downloadAuthedFile, fetchAuthedBlobUrl, parseApiError } from '@/lib/utils';

type OrderLine = {
  productId?: string | null;
  name: string;
  quantity: number;
  unitPrice: number;
  mediaId?: string | null;
};

type OrderItems = {
  lines?: OrderLine[];
  subtotal?: number;
  delivery?: number;
  total?: number;
  currency?: string;
  customerName?: string | null;
  source?: string;
  discount?: number;
};

type Booking = {
  id: string;
  orderNumber: string;
  phoneNumber: string;
  address: string;
  orderType: string;
  totalAmount: number;
  currency: string;
  status: string;
  usedWhatsappPhone: boolean;
  notes?: string | null;
  items?: OrderItems | OrderLine[] | null;
  createdAt: string;
  contact?: { displayName: string } | null;
};

type ExportMeta = {
  lastExportSeq: number;
  maxSeq: number;
  suggestedFrom: number;
  suggestedTo: number;
  hasNewOrders: boolean;
};

function orderSeq(orderNumber: string) {
  const match = /ORD-0*(\d+)/i.exec(orderNumber);
  return match ? Number(match[1]) : 0;
}

function parseOrderItems(raw: Booking['items']): {
  lines: OrderLine[];
  subtotal?: number;
  delivery?: number;
  customerName?: string | null;
  source?: string;
} {
  if (!raw) return { lines: [] };
  if (Array.isArray(raw)) return { lines: raw };
  return {
    lines: Array.isArray(raw.lines) ? raw.lines : [],
    subtotal: raw.subtotal,
    delivery: raw.delivery,
    customerName: raw.customerName,
    source: raw.source,
  };
}

function bookingCustomer(item: Booking) {
  return parseOrderItems(item.items).customerName || item.contact?.displayName || '—';
}

const BOOKING_STATUSES = [
  { id: 'PENDING', label: 'جديد / قيد الانتظار' },
  { id: 'CONFIRMED', label: 'مؤكد' },
  { id: 'CANCELLED', label: 'ملغى' },
  { id: 'COMPLETED', label: 'مكتمل' },
] as const;

export default function BookingsPage() {
  const { t } = useTranslation();
  const [items, setItems] = useState<Booking[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState<'excel' | 'pdf' | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState<'excel' | 'pdf'>('pdf');
  const [exportMeta, setExportMeta] = useState<ExportMeta | null>(null);
  const [fromSeq, setFromSeq] = useState('1');
  const [toSeq, setToSeq] = useState('1');
  const [editing, setEditing] = useState<Booking | null>(null);
  const [viewing, setViewing] = useState<Booking | null>(null);
  const [lineThumbs, setLineThumbs] = useState<Record<string, string>>({});
  const [editForm, setEditForm] = useState({
    customerName: '',
    phoneNumber: '',
    address: '',
    orderType: '',
    totalAmount: '',
    notes: '',
    status: 'CONFIRMED',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const query = search ? `?search=${encodeURIComponent(search)}` : '';
      const [list, meta] = await Promise.all([
        api<Booking[]>(`/bookings${query}`),
        api<ExportMeta>('/bookings/export/meta'),
      ]);
      setItems(list);
      setExportMeta(meta);
    } catch (err) {
      setError(parseApiError(err));
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    load().catch(console.error);
  }, [load]);

  useEffect(() => {
    if (!viewing) return;
    const mediaIds = parseOrderItems(viewing.items).lines.map((l) => l.mediaId).filter(Boolean) as string[];
    let cancelled = false;
    (async () => {
      const next: Record<string, string> = {};
      for (const id of mediaIds) {
        try {
          next[id] = await fetchAuthedBlobUrl(`/store/media/${id}`);
        } catch {
          /* skip */
        }
      }
      if (!cancelled) {
        setLineThumbs((prev) => {
          Object.values(prev).forEach((u) => URL.revokeObjectURL(u));
          return next;
        });
      } else {
        Object.values(next).forEach((u) => URL.revokeObjectURL(u));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [viewing]);

  function openExport(format: 'excel' | 'pdf') {
    setExportFormat(format);
    const meta = exportMeta;
    if (meta && meta.maxSeq > 0) {
      setFromSeq(String(meta.suggestedFrom || 1));
      setToSeq(String(meta.suggestedTo || meta.maxSeq));
    } else if (items.length) {
      const seqs = items.map((i) => orderSeq(i.orderNumber)).filter(Boolean);
      setFromSeq(String(Math.min(...seqs)));
      setToSeq(String(Math.max(...seqs)));
    } else {
      setFromSeq('1');
      setToSeq('1');
    }
    setError(null);
    setExportOpen(true);
  }

  async function confirmExport() {
    const from = Number(fromSeq);
    const to = Number(toSeq);
    if (!Number.isFinite(from) || !Number.isFinite(to) || from < 1 || to < from) {
      setError(t('bookings.invalidRange'));
      return;
    }
    setExporting(exportFormat);
    setError(null);
    try {
      const ext = exportFormat === 'excel' ? 'xlsx' : 'pdf';
      await downloadAuthedFile(
        `/bookings/export/${exportFormat}?from=${from}&to=${to}`,
        `orders-${from}-${to}.${ext}`,
      );
      setExportOpen(false);
      await load();
    } catch (err) {
      setError(parseApiError(err));
    } finally {
      setExporting(null);
    }
  }

  function openEdit(item: Booking) {
    setEditing(item);
    setEditForm({
      customerName: bookingCustomer(item) === '—' ? '' : bookingCustomer(item),
      phoneNumber: item.phoneNumber,
      address: item.address,
      orderType: item.orderType,
      totalAmount: String(item.totalAmount),
      notes: item.notes ?? '',
      status: item.status,
    });
    setError(null);
  }

  async function saveEdit() {
    if (!editing) return;
    setBusy(true);
    setError(null);
    try {
      await api(`/bookings/${editing.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          customerName: editForm.customerName.trim() || undefined,
          phoneNumber: editForm.phoneNumber.trim(),
          address: editForm.address.trim(),
          orderType: editForm.orderType.trim(),
          totalAmount: Number(editForm.totalAmount),
          notes: editForm.notes.trim() || null,
          status: editForm.status,
        }),
      });
      setEditing(null);
      await load();
    } catch (err) {
      setError(parseApiError(err));
    } finally {
      setBusy(false);
    }
  }

  async function deleteOrder(item: Booking) {
    if (!window.confirm(t('bookings.deleteConfirm').replace('{order}', item.orderNumber))) return;
    setBusy(true);
    setError(null);
    try {
      await api(`/bookings/${item.id}`, { method: 'DELETE' });
      await load();
    } catch (err) {
      setError(parseApiError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell>
      <PageHeader title={t('bookings.title')} description={t('bookings.description')} />

      <Card className="mt-6 border-0 shadow-card">
        <CardHeader>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <ClipboardList className="h-5 w-5" />
                {t('bookings.title')}
              </CardTitle>
              <CardDescription>
                {items.length} {t('bookings.title').toLowerCase()}
                {exportMeta && exportMeta.lastExportSeq > 0
                  ? ` · ${t('bookings.lastExport').replace('{n}', String(exportMeta.lastExportSeq))}`
                  : ''}
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  load().catch(console.error);
                }}
                className="relative w-full sm:w-64"
              >
                <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t('bookings.search')}
                  className="ps-9"
                />
              </form>
              <Button variant="outline" size="sm" onClick={() => openExport('excel')} disabled={!!exporting || items.length === 0}>
                <FileSpreadsheet className="me-2 h-4 w-4" />
                {t('bookings.exportExcel')}
              </Button>
              <Button variant="outline" size="sm" onClick={() => openExport('pdf')} disabled={!!exporting || items.length === 0}>
                <Download className="me-2 h-4 w-4" />
                {t('bookings.exportPdf')}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {error && !editing && !exportOpen && (
            <p className="mb-4 text-sm text-destructive">{error}</p>
          )}
          {loading ? (
            <div className="flex items-center gap-2 py-12 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t('common.loading')}
            </div>
          ) : items.length === 0 ? (
            <EmptyState icon={ClipboardList} title={t('bookings.emptyTitle')} description={t('bookings.emptyDesc')} />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('bookings.orderNumber')}</TableHead>
                  <TableHead>{t('bookings.customer')}</TableHead>
                  <TableHead>{t('bookings.phone')}</TableHead>
                  <TableHead>{t('bookings.address')}</TableHead>
                  <TableHead>{t('bookings.orderType')}</TableHead>
                  <TableHead>{t('bookings.total')}</TableHead>
                  <TableHead>{t('bookings.date')}</TableHead>
                  <TableHead className="w-[100px]">{t('bookings.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow
                    key={item.id}
                    className="cursor-pointer"
                    onClick={() => setViewing(item)}
                  >
                    <TableCell className="font-medium">{item.orderNumber}</TableCell>
                    <TableCell>{bookingCustomer(item)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span dir="ltr">{item.phoneNumber}</span>
                        {item.usedWhatsappPhone && (
                          <Badge variant="secondary">{t('bookings.whatsappPhone')}</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate" title={item.address}>
                      {item.address}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <span className="line-clamp-2 max-w-[280px]">{item.orderType}</span>
                        {item.status === 'PENDING' && (
                          <Badge variant="secondary">بانتظار التفعيل</Badge>
                        )}
                        {item.status === 'CANCELLED' && <Badge variant="destructive">ملغى</Badge>}
                        {item.status === 'COMPLETED' && <Badge>مكتمل</Badge>}
                        {parseOrderItems(item.items).source === 'store-landing' && (
                          <Badge variant="outline">صفحة الهبوط</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {item.totalAmount.toLocaleString()} {item.currency}
                    </TableCell>
                    <TableCell>{new Date(item.createdAt).toLocaleString()}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" onClick={() => openEdit(item)} disabled={busy}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive"
                          onClick={() => void deleteOrder(item)}
                          disabled={busy}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={exportOpen} onOpenChange={setExportOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {exportFormat === 'pdf' ? t('bookings.exportPdf') : t('bookings.exportExcel')}
            </DialogTitle>
            <DialogDescription>{t('bookings.exportRangeHint')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {exportMeta && (
              <p className="text-sm text-muted-foreground">
                {exportMeta.lastExportSeq > 0
                  ? t('bookings.lastExportDetail')
                      .replace('{n}', String(exportMeta.lastExportSeq))
                      .replace('{from}', String(exportMeta.suggestedFrom))
                      .replace('{to}', String(exportMeta.suggestedTo))
                  : t('bookings.firstExportHint').replace('{max}', String(exportMeta.maxSeq))}
              </p>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="fromSeq">{t('bookings.fromOrder')}</Label>
                <Input
                  id="fromSeq"
                  type="number"
                  min={1}
                  value={fromSeq}
                  onChange={(e) => setFromSeq(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="toSeq">{t('bookings.toOrder')}</Label>
                <Input
                  id="toSeq"
                  type="number"
                  min={1}
                  value={toSeq}
                  onChange={(e) => setToSeq(e.target.value)}
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => {
                  if (!exportMeta) return;
                  setFromSeq(String(exportMeta.suggestedFrom));
                  setToSeq(String(exportMeta.suggestedTo));
                }}
              >
                {t('bookings.useSuggested')}
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => {
                  if (!exportMeta) return;
                  setFromSeq('1');
                  setToSeq(String(exportMeta.maxSeq));
                }}
              >
                {t('bookings.downloadAll')}
              </Button>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExportOpen(false)} disabled={!!exporting}>
              {t('common.cancel')}
            </Button>
            <Button onClick={() => void confirmExport()} disabled={!!exporting}>
              {exporting ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : null}
              {exporting ? t('bookings.exporting') : t('bookings.download')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(viewing)} onOpenChange={(open) => !open && setViewing(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {t('bookings.orderDetails')}
              {viewing ? ` — ${viewing.orderNumber}` : ''}
            </DialogTitle>
            <DialogDescription>{t('bookings.orderDetailsDesc')}</DialogDescription>
          </DialogHeader>
          {viewing && (
            <div className="space-y-5 py-1">
              <div className="grid gap-2 rounded-xl border p-3 text-sm">
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">{t('bookings.customer')}</span>
                  <span>{bookingCustomer(viewing)}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">{t('bookings.phone')}</span>
                  <span dir="ltr">{viewing.phoneNumber}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">{t('bookings.address')}</span>
                  <span className="text-end">{viewing.address}</span>
                </div>
                {viewing.notes ? (
                  <div className="flex justify-between gap-3">
                    <span className="text-muted-foreground">{t('bookings.notes')}</span>
                    <span className="text-end">{viewing.notes}</span>
                  </div>
                ) : null}
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">{t('bookings.date')}</span>
                  <span>{new Date(viewing.createdAt).toLocaleString()}</span>
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium">{t('bookings.products')}</p>
                {parseOrderItems(viewing.items).lines.length === 0 ? (
                  <p className="rounded-xl border p-3 text-sm text-muted-foreground">{viewing.orderType}</p>
                ) : (
                  <ul className="space-y-2">
                    {parseOrderItems(viewing.items).lines.map((line, i) => (
                      <li key={`${line.productId || line.name}-${i}`} className="flex items-center gap-3 rounded-xl border p-2">
                        <div className="h-14 w-14 overflow-hidden rounded-lg bg-muted">
                          {line.mediaId && lineThumbs[line.mediaId] ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={lineThumbs[line.mediaId]} alt="" className="h-full w-full object-cover" />
                          ) : null}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium">{line.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {t('bookings.quantity')}: {line.quantity} · {Number(line.unitPrice || 0).toLocaleString()} {viewing.currency}
                          </p>
                        </div>
                        <p className="text-sm font-semibold">
                          {(Number(line.unitPrice || 0) * Number(line.quantity || 0)).toLocaleString()}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <dl className="space-y-1 rounded-xl border p-3 text-sm">
                <div className="flex justify-between">
                  <dt>{t('bookings.subtotal')}</dt>
                  <dd>
                    {(parseOrderItems(viewing.items).subtotal ?? viewing.totalAmount).toLocaleString()} {viewing.currency}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt>{t('bookings.delivery')}</dt>
                  <dd>
                    {(parseOrderItems(viewing.items).delivery ?? 0).toLocaleString()} {viewing.currency}
                  </dd>
                </div>
                <div className="flex justify-between font-semibold">
                  <dt>{t('bookings.grandTotal')}</dt>
                  <dd>
                    {viewing.totalAmount.toLocaleString()} {viewing.currency}
                  </dd>
                </div>
              </dl>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewing(null)}>
              {t('common.close')}
            </Button>
            {viewing ? (
              <Button
                onClick={() => {
                  const item = viewing;
                  setViewing(null);
                  openEdit(item);
                }}
              >
                {t('bookings.editOrder')}
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(editing)} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {t('bookings.editOrder')}
              {editing ? ` — ${editing.orderNumber}` : ''}
            </DialogTitle>
            <DialogDescription>{t('bookings.editOrderDesc')}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="space-y-2">
              <Label>{t('bookings.customer')}</Label>
              <Input
                value={editForm.customerName}
                onChange={(e) => setEditForm((f) => ({ ...f, customerName: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('bookings.phone')}</Label>
              <Input
                dir="ltr"
                value={editForm.phoneNumber}
                onChange={(e) => setEditForm((f) => ({ ...f, phoneNumber: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('bookings.address')}</Label>
              <Input
                value={editForm.address}
                onChange={(e) => setEditForm((f) => ({ ...f, address: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('bookings.orderType')}</Label>
              <Input
                value={editForm.orderType}
                onChange={(e) => setEditForm((f) => ({ ...f, orderType: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('bookings.total')}</Label>
              <Input
                type="number"
                value={editForm.totalAmount}
                onChange={(e) => setEditForm((f) => ({ ...f, totalAmount: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('bookings.status')}</Label>
              <select
                className="h-10 w-full rounded-lg border bg-background px-3 text-sm"
                value={editForm.status}
                onChange={(e) => setEditForm((f) => ({ ...f, status: e.target.value }))}
              >
                {BOOKING_STATUSES.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>{t('bookings.notes')}</Label>
              <Input
                value={editForm.notes}
                onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)} disabled={busy}>
              {t('common.cancel')}
            </Button>
            <Button onClick={() => void saveEdit()} disabled={busy}>
              {busy ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : null}
              {t('common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
