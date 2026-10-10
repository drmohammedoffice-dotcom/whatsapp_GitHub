'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Loader2, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  fetchAdminPayout,
  fetchAdminPayoutImageUrl,
  payAdminPayout,
  setAdminPayoutStatus,
  type AdminPayoutRow,
} from '@/lib/admin-api';
import { formatIqd } from '@/lib/partner-api';

function formatDateTime(value?: string | null) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString('en-GB', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  } catch {
    return value;
  }
}

function DetailLine({ label, value, dir }: { label: string; value: ReactNode; dir?: 'ltr' | 'rtl' }) {
  return (
    <div className="grid gap-1 border-b border-border/60 py-2 last:border-0 sm:grid-cols-[140px_1fr] sm:gap-3">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="text-sm font-medium" dir={dir}>
        {value}
      </p>
    </div>
  );
}

export function PayoutReview({ id, onClose, onSaved }: { id: string; onClose: () => void; onSaved: () => void }) {
  const [row, setRow] = useState<AdminPayoutRow | null>(null);
  const [note, setNote] = useState('');
  const [file, setFile] = useState<File | undefined>();
  const [receipt, setReceipt] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const previewUrl = useMemo(() => (file ? URL.createObjectURL(file) : ''), [file]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  useEffect(() => {
    fetchAdminPayout(id)
      .then((data) => {
        setRow(data);
        setNote(data.adminNote ?? '');
      })
      .catch((err: Error) => setError(err.message));
  }, [id]);

  useEffect(() => {
    if (!row?.hasReceiptImage || file) return;
    let url = '';
    fetchAdminPayoutImageUrl(id, 'receipt')
      .then((next) => {
        url = next;
        setReceipt(next);
      })
      .catch(() => undefined);
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [id, row?.hasReceiptImage, file]);

  function clearSelectedImage() {
    setFile(undefined);
    if (!row?.hasReceiptImage) setReceipt('');
  }

  async function reject() {
    setBusy(true);
    setError(null);
    try {
      await setAdminPayoutStatus(id, 'REJECTED', note);
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر رفض الطلب');
    } finally {
      setBusy(false);
    }
  }

  async function approveAndSend() {
    setBusy(true);
    setError(null);
    try {
      if (!file && !row?.hasReceiptImage) {
        throw new Error('اختر صورة التحويل قبل الموافقة');
      }
      await payAdminPayout(id, file, note);
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر إتمام الموافقة وإرسال صورة التحويل');
    } finally {
      setBusy(false);
    }
  }

  const methodLabel =
    row?.method === 'MASTERCARD' ? 'ماستركارد' : row?.method === 'ZAIN_CASH' ? 'زين كاش' : 'حساب';
  const shownImage = previewUrl || receipt;
  const isClosed = row?.status === 'PAID' || row?.status === 'REJECTED' || row?.status === 'CANCELLED';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="relative max-h-[90vh] w-full max-w-lg space-y-4 overflow-auto rounded-2xl bg-background p-5"
        onClick={(event) => event.stopPropagation()}
      >
        <button type="button" className="absolute end-4 top-4 rounded-md p-1 text-muted-foreground hover:bg-muted" onClick={onClose}>
          <X className="h-4 w-4" />
        </button>
        <h2 className="text-lg font-semibold">تفاصيل طلب السحب</h2>
        {error && <p className="text-sm text-destructive">{error}</p>}
        {!row ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <>
            <div className="rounded-xl border px-3">
              <DetailLine label="الاسم" value={row.partner?.name || '—'} />
              <DetailLine label="البريد" value={row.partner?.email || '—'} dir="ltr" />
              <DetailLine label="الهاتف" value={row.partner?.phone || '—'} dir="ltr" />
              <DetailLine label="المدينة / البلد" value={row.partner?.city || row.partner?.country || '—'} />
              <DetailLine label="العمر" value={row.partner?.age != null ? String(row.partner.age) : '—'} dir="ltr" />
              <DetailLine label="المبلغ المطلوب" value={formatIqd(row.amountCents)} dir="ltr" />
              <DetailLine label="رسوم التحويل" value={formatIqd(row.feeCents ?? 0)} dir="ltr" />
              <DetailLine label="يصل للشريك" value={formatIqd(row.netCents ?? row.amountCents)} dir="ltr" />
              <DetailLine label="طريقة التحويل" value={methodLabel} />
              {row.accountName ? <DetailLine label="اسم الحساب" value={row.accountName} /> : null}
              <DetailLine label="رقم الحساب / البطاقة" value={row.accountNumber} dir="ltr" />
              <DetailLine label="الحالة" value={row.status} dir="ltr" />
              <DetailLine label="تاريخ الطلب" value={formatDateTime(row.createdAt)} dir="ltr" />
              {row.paidAt ? <DetailLine label="تاريخ الدفع" value={formatDateTime(row.paidAt)} dir="ltr" /> : null}
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">صورة التحويل</p>
              {shownImage ? (
                <div className="relative overflow-hidden rounded-xl border">
                  <img src={shownImage} alt="معاينة صورة التحويل" className="max-h-56 w-full object-contain bg-muted/30" />
                  {!isClosed && (
                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      className="absolute end-2 top-2"
                      onClick={clearSelectedImage}
                    >
                      <Trash2 className="me-1 h-3.5 w-3.5" />
                      حذف الصورة
                    </Button>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">لم يتم اختيار صورة بعد.</p>
              )}
              {!isClosed && (
                <label className="flex cursor-pointer flex-col gap-2 rounded-xl border border-dashed px-4 py-3 text-sm hover:bg-muted/40">
                  <span>{file ? 'تغيير الصورة' : 'اختيار صورة التحويل'}</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="text-xs"
                    onChange={(event) => {
                      const next = event.target.files?.[0];
                      setFile(next);
                      if (next) setReceipt('');
                    }}
                  />
                </label>
              )}
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">ملاحظة للشريك</p>
              <Textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="تم تحويل المبلغ الى حسابك شكرا لكونك جزء من فريقنا"
                disabled={isClosed}
              />
            </div>

            {!isClosed && (
              <div className="flex flex-wrap gap-2">
                <Button type="button" disabled={busy} onClick={() => void approveAndSend()}>
                  {busy ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : null}
                  موافقة وإرسال صورة التحويل
                </Button>
                <Button type="button" variant="outline" disabled={busy} onClick={() => void reject()}>
                  رفض
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
