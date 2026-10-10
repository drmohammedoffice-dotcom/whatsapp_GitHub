'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { fetchAdminPayments } from '@/lib/admin-api';

export default function AdminPaymentsPage() {
  const [rows, setRows] = useState<unknown[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAdminPayments().then(setRows).finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <PageHeader title="Payments" description="Payment history and manual adjustments" />
      {loading ? (
        <div className="mt-4 flex gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading...</div>
      ) : (
        <div className="mt-4 rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Provider</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => {
                const p = r as { id: string; amountCents: number; status: string; provider: string | null; createdAt: string };
                return (
                  <TableRow key={p.id}>
                    <TableCell>${(p.amountCents / 100).toFixed(2)}</TableCell>
                    <TableCell>{p.status}</TableCell>
                    <TableCell>{p.provider ?? '—'}</TableCell>
                    <TableCell>{new Date(p.createdAt).toLocaleString()}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
