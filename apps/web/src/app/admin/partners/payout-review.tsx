'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  fetchAdminPayout,
  fetchAdminPayoutImageUrl,
  payAdminPayout,
  setAdminPayoutStatus,
  type AdminPayoutRow,
} from '@/lib/admin-api';
import { formatIqd } from '@/lib/partner-api';

export function PayoutReview({ id, onClose, onSaved }: { id: string; onClose: () => void; onSaved: () => void }) {
  const [row, setRow] = useState<AdminPayoutRow | null>(null);
  const [note, setNote] = useState('');
  const [file, setFile] = useState<File | undefined>();
  const [receipt, setReceipt] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAdminPayout(id)
      .then((data) => {
        setRow(data);
        setNote(data.adminNote ?? '');
      })
      .catch((err: Error) => setError(err.message));
  }, [id]);

  useEffect(() => {
    if (!row?.hasReceiptImage) return;
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
  }, [id, row?.hasReceiptImage]);

  async function act(status: 'APPROVED' | 'REJECTED') {
    setBusy(true);
    setError(null);
    try {
      await setAdminPayoutStatus(id, status, note);
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر حفظ الطلب');
    } finally {
      setBusy(false);
    }
  }

  async function sendTransfer() {
    setBusy(true);
    setError(null);
    try {
      await payAdminPayout(id, file, note);
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر إرسال صورة التحويل');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-lg space-y-3 overflow-auto rounded-2xl bg-background p-5" onClick={(event) => event.stopPropagation()}>
        <h2 className="text-lg font-semibold">تفاصيل طلب السحب</h2>
        {error && <p className="text-sm text-destructive">{error}</p>}
        {!row ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <>
            <p className="text-sm">{row.partner?.name} · {row.partner?.email}</p>
            <p className="text-sm text-muted-foreground">{row.partner?.phone} · {row.partner?.city || row.partner?.country} · العمر {row.partner?.age ?? '—'}</p>
            <p className="text-sm">المطلوب {formatIqd(row.amountCents)} · الرسوم {formatIqd(row.feeCents ?? 0)} · يصل للشريك {formatIqd(row.netCents ?? row.amountCents)}</p>
            <p className="text-sm">{row.method === 'MASTERCARD' ? 'ماستركارد' : row.method === 'ZAIN_CASH' ? 'زين كاش' : 'حساب'} {row.accountName ? `· ${row.accountName}` : ''} · {row.accountNumber}</p>
            <p className="text-sm">الحالة: {row.status}</p>
            {receipt && <img src={receipt} alt="" className="max-h-48 rounded-lg border object-contain" />}
            <Textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="ملاحظة للشريك" />
            <Input type="file" accept="image/*" onChange={(event) => setFile(event.target.files?.[0])} />
            <div className="flex flex-wrap gap-2">
              <Button type="button" disabled={busy} onClick={() => void act('APPROVED')}>موافقة</Button>
              <Button type="button" variant="outline" disabled={busy} onClick={() => void act('REJECTED')}>رفض</Button>
              <Button type="button" variant="secondary" disabled={busy || !file} onClick={() => void sendTransfer()}>إرسال صورة التحويل</Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
