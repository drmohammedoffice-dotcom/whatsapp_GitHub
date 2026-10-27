'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Copy, Download, Loader2, MessageCircle, Trash2 } from 'lucide-react';
import { TikTokIntegrationShell } from '@/components/tiktok/tiktok-integration-shell';
import { PageHeader } from '@/components/shared/page-header';
import { AlertBanner } from '@/components/shared/alert-banner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useTranslation } from '@/components/providers/locale-provider';
import {
  deleteInstantFormOrder,
  listInstantFormOrders,
  updateInstantFormOrder,
  type InstantFormOrder,
  type InstantFormOrderStatus,
} from '@/lib/instant-forms/api';
import { downloadFile } from '@/lib/native-bridge';
import { API_URL, authedFetch } from '@/lib/utils';
import { buildOrderDisplay, formatMoney } from '@/lib/instant-forms/order-summary';

const STATUSES: InstantFormOrderStatus[] = [
  'NEW',
  'CONTACTED',
  'CONFIRMED',
  'SHIPPED',
  'DELIVERED',
  'CANCELLED',
  'SPAM',
];

const EXPORT_CURSOR_KEY = 'instant-forms-export-cursor';

function readExportCursor(formId?: string | null) {
  try {
    const raw = localStorage.getItem(EXPORT_CURSOR_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Record<string, string>;
    const key = formId || '__all__';
    return parsed[key] || null;
  } catch {
    return null;
  }
}

function writeExportCursor(cursor: string, formId?: string | null) {
  try {
    const raw = localStorage.getItem(EXPORT_CURSOR_KEY);
    const parsed = raw ? (JSON.parse(raw) as Record<string, string>) : {};
    parsed[formId || '__all__'] = cursor;
    localStorage.setItem(EXPORT_CURSOR_KEY, JSON.stringify(parsed));
  } catch {
    /* ignore */
  }
}

export function InstantFormOrdersPageClient() {
  const { t } = useTranslation();
  const searchParams = useSearchParams();
  const formId = searchParams.get('formId');
  const [items, setItems] = useState<InstantFormOrder[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<InstantFormOrderStatus | ''>('');
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [selected, setSelected] = useState<InstantFormOrder | null>(null);
  const [lastExportAt, setLastExportAt] = useState<string | null>(null);

  useEffect(() => {
    setLastExportAt(readExportCursor(formId));
  }, [formId]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listInstantFormOrders({
        q: q || undefined,
        status: status || undefined,
        formId: formId || undefined,
        page,
      });
      setItems(data.items);
      setTotal(data.total);
      setPageSize(data.pageSize);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setLoading(false);
    }
  }, [q, status, formId, page]);

  useEffect(() => {
    const timer = setTimeout(() => void load(), 250);
    return () => clearTimeout(timer);
  }, [load]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  async function exportCsv(mode: 'new' | 'all') {
    setExporting(true);
    setError(null);
    setInfo(null);
    try {
      const qs = new URLSearchParams({ mode });
      if (formId) qs.set('formId', formId);
      if (mode === 'new') {
        const since = readExportCursor(formId);
        if (since) qs.set('since', since);
      }
      const res = await authedFetch(`${API_URL}/api/v1/instant-forms/orders/export.csv?${qs}`);
      if (!res.ok) {
        throw new Error(await res.text());
      }
      const count = Number(res.headers.get('X-Export-Count') || '0');
      const cursor = res.headers.get('X-Export-Cursor');
      const blob = await res.blob();
      if (count === 0) {
        setInfo(mode === 'new' ? t('instantForms.exportNoNew') : t('instantForms.noOrders'));
        if (cursor) {
          writeExportCursor(cursor, formId);
          setLastExportAt(cursor);
        }
        return;
      }
      const fileName = mode === 'new' ? 'instant-form-orders-new.csv' : 'instant-form-orders-all.csv';
      const saved = await downloadFile(fileName, blob.type || 'text/csv;charset=utf-8', blob);
      if (!saved) {
        // Do NOT advance the "new orders since last export" marker: nothing reached the user.
        setError(t('instantForms.exportDownloadFailed'));
        return;
      }
      if (cursor) {
        writeExportCursor(cursor, formId);
        setLastExportAt(cursor);
      }
      setInfo(
        mode === 'new'
          ? t('instantForms.exportNewDone').replace('{count}', String(count))
          : t('instantForms.exportAllDone').replace('{count}', String(count)),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Export failed');
    } finally {
      setExporting(false);
    }
  }

  const lastExportLabel = useMemo(() => {
    if (!lastExportAt) return t('instantForms.exportNever');
    try {
      return new Date(lastExportAt).toLocaleString();
    } catch {
      return lastExportAt;
    }
  }, [lastExportAt, t]);

  return (
    <TikTokIntegrationShell>
      <PageHeader
        title={t('instantForms.orders')}
        description={t('instantForms.ordersDesc')}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={exporting}
              onClick={() => void exportCsv('new')}
              title={t('instantForms.exportNewHint')}
            >
              {exporting ? (
                <Loader2 className="me-1 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Download className="me-1 h-3.5 w-3.5" />
              )}
              {t('instantForms.exportNew')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={exporting}
              onClick={() => void exportCsv('all')}
            >
              {t('instantForms.exportAll')}
            </Button>
            <Link href="/tiktok/integration/forms">
              <Button size="sm" variant="outline">
                {t('instantForms.backToForms')}
              </Button>
            </Link>
          </div>
        }
      />

      <p className="mt-2 text-xs text-muted-foreground">
        {t('instantForms.lastExport')}: {lastExportLabel}
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        <Input
          className="max-w-xs"
          placeholder={t('instantForms.searchOrders')}
          value={q}
          onChange={(e) => {
            setPage(1);
            setQ(e.target.value);
          }}
        />
        <select
          className="rounded-md border px-3 py-2 text-sm"
          value={status}
          onChange={(e) => {
            setPage(1);
            setStatus(e.target.value as InstantFormOrderStatus | '');
          }}
        >
          <option value="">{t('instantForms.allStatuses')}</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      {error ? <AlertBanner className="mt-4" variant="error">{error}</AlertBanner> : null}
      {info ? <AlertBanner className="mt-4" variant="success">{info}</AlertBanner> : null}

      {loading ? (
        <div className="mt-8 flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t('common.loading')}
        </div>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-xl border">
          <table className="min-w-full text-sm">
            <thead className="bg-muted/50 text-start">
              <tr>
                <th className="px-3 py-2 font-medium">{t('instantForms.colIndex')}</th>
                <th className="px-3 py-2 font-medium">{t('instantForms.colOrder')}</th>
                <th className="px-3 py-2 font-medium">{t('instantForms.colCustomer')}</th>
                <th className="px-3 py-2 font-medium">{t('instantForms.colPhone')}</th>
                <th className="px-3 py-2 font-medium">{t('instantForms.colCity')}</th>
                <th className="px-3 py-2 font-medium">{t('instantForms.colProduct')}</th>
                <th className="px-3 py-2 font-medium">{t('instantForms.colSelections')}</th>
                <th className="px-3 py-2 font-medium">{t('instantForms.colQty')}</th>
                <th className="px-3 py-2 font-medium">{t('instantForms.colPrice')}</th>
                <th className="px-3 py-2 font-medium">{t('instantForms.colStatus')}</th>
                <th className="px-3 py-2 font-medium">{t('instantForms.colTime')}</th>
                <th className="px-3 py-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {items.map((o, index) => {
                const seq = total - ((page - 1) * pageSize + index);
                const display = buildOrderDisplay(o.answers, null, {
                  productName: o.productName,
                  quantity: o.quantity,
                  unitPrice: o.unitPrice,
                  totalPrice: o.totalPrice,
                  currency: o.currency,
                });
                return (
                  <tr key={o.id} className="border-t hover:bg-muted/30">
                    <td className="px-3 py-2 font-semibold text-violet-700">#{seq}</td>
                    <td className="px-3 py-2 font-mono text-xs">{o.orderNumber}</td>
                    <td className="px-3 py-2">{o.customerName || '—'}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1">
                        <span>{o.customerPhone || '—'}</span>
                        {o.customerPhone ? (
                          <button
                            type="button"
                            onClick={() => void navigator.clipboard.writeText(o.customerPhone!)}
                            className="text-muted-foreground hover:text-foreground"
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </button>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-3 py-2">{o.city || '—'}</td>
                    <td className="px-3 py-2">{o.productName || '—'}</td>
                    <td className="max-w-[220px] px-3 py-2 text-xs leading-5">
                      {display.summary ? (
                        <span className="line-clamp-3" title={display.summary}>
                          {display.summary}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-3 py-2 font-medium">{o.quantity}</td>
                    <td className="px-3 py-2 font-semibold text-emerald-700">
                      {formatMoney(o.totalPrice, o.currency)}
                    </td>
                    <td className="px-3 py-2">
                      <select
                        className="rounded border px-2 py-1 text-xs"
                        value={o.status}
                        onChange={(e) =>
                          void updateInstantFormOrder(o.id, {
                            status: e.target.value as InstantFormOrderStatus,
                          }).then(load)
                        }
                      >
                        {STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {new Date(o.submittedAt).toLocaleString()}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" onClick={() => setSelected(o)}>
                          {t('instantForms.details')}
                        </Button>
                        {o.customerPhone || o.customerWhatsapp ? (
                          <a
                            href={`https://wa.me/${String(o.customerWhatsapp || o.customerPhone).replace(/\D/g, '')}`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <Button size="sm" variant="ghost">
                              <MessageCircle className="h-4 w-4 text-emerald-600" />
                            </Button>
                          </a>
                        ) : null}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive"
                          onClick={() => {
                            if (confirm(t('instantForms.deleteOrderConfirm'))) {
                              void deleteInstantFormOrder(o.id).then(load);
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {items.length === 0 ? (
                <tr>
                  <td colSpan={12} className="px-3 py-10 text-center text-muted-foreground">
                    {t('instantForms.noOrders')} ({total})
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      )}

      {total > pageSize ? (
        <div className="mt-4 flex items-center justify-between gap-2 text-sm">
          <span className="text-muted-foreground">
            {t('instantForms.pageOf')
              .replace('{page}', String(page))
              .replace('{total}', String(totalPages))
              .replace('{count}', String(total))}
          </span>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              {t('instantForms.prevPage')}
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              {t('instantForms.nextPage')}
            </Button>
          </div>
        </div>
      ) : null}

      {selected ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-background p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-semibold">{selected.orderNumber}</h3>
              <Button size="sm" variant="outline" onClick={() => setSelected(null)}>
                {t('common.close')}
              </Button>
            </div>
            {(() => {
              const display = buildOrderDisplay(selected.answers, null, {
                productName: selected.productName,
                quantity: selected.quantity,
                unitPrice: selected.unitPrice,
                totalPrice: selected.totalPrice,
                currency: selected.currency,
              });
              return (
                <>
                  <dl className="space-y-2 text-sm">
                    {[
                      ['العميل', selected.customerName],
                      ['الهاتف', selected.customerPhone],
                      ['المدينة', selected.city],
                      ['العنوان', selected.address],
                      ['المنتج', selected.productName],
                      [t('instantForms.unitPriceLabel'), formatMoney(selected.unitPrice, selected.currency)],
                      [t('instantForms.colQty'), selected.quantity],
                      [t('instantForms.totalPriceLabel'), formatMoney(selected.totalPrice, selected.currency)],
                      ['الاستمارة', selected.form?.name],
                      ['المنصة', selected.adPlatform],
                      ['الحساب', selected.adAccountLabel],
                      ['UTM', [selected.utmSource, selected.utmCampaign].filter(Boolean).join(' / ')],
                      ['ttclid', selected.ttclid],
                      ['fbclid', selected.fbclid],
                      ['IP', selected.ipAddress],
                      ['Device', selected.deviceType],
                      ['Browser', selected.browser],
                    ].map(([k, v]) => (
                      <div key={String(k)} className="grid grid-cols-[120px_1fr] gap-2">
                        <dt className="text-muted-foreground">{k}</dt>
                        <dd className="break-all">{v == null || v === '' ? '—' : String(v)}</dd>
                      </div>
                    ))}
                  </dl>
                  {display.lines.length ? (
                    <div className="mt-4 rounded-xl border bg-muted/40 p-3">
                      <div className="mb-2 text-xs font-semibold text-muted-foreground">
                        {t('instantForms.orderSelections')}
                      </div>
                      <ul className="space-y-2 text-sm">
                        {display.lines.map((line) => (
                          <li key={`${line.label}-${line.value}`} className="grid grid-cols-[110px_1fr] gap-2">
                            <span className="text-muted-foreground">{line.label}</span>
                            <span className="font-medium">{line.value}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </>
              );
            })()}
            <div className="mt-4">
              <label className="text-xs text-muted-foreground">{t('instantForms.internalNotes')}</label>
              <textarea
                className="mt-1 min-h-20 w-full rounded-md border px-3 py-2 text-sm"
                defaultValue={selected.internalNotes || ''}
                onBlur={(e) =>
                  void updateInstantFormOrder(selected.id, { internalNotes: e.target.value }).then(load)
                }
              />
            </div>
          </div>
        </div>
      ) : null}
    </TikTokIntegrationShell>
  );
}
