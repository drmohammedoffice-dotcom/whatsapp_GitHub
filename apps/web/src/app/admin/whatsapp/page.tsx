'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { fetchAdminWhatsApp } from '@/lib/admin-api';

export default function AdminWhatsAppPage() {
  const [rows, setRows] = useState<unknown[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAdminWhatsApp().then(setRows).finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <PageHeader title="WhatsApp Management" description="All connected WhatsApp numbers" />
      {loading ? (
        <div className="mt-4 flex gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading...</div>
      ) : (
        <div className="mt-4 rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Number</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Workspace</TableHead>
                <TableHead>Messages</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => {
                const row = r as {
                  id: string;
                  type: string;
                  phoneNumber: string | null;
                  status: string;
                  workspace?: { name: string };
                  messageCount: number | null;
                };
                return (
                  <TableRow key={`${row.type}-${row.id}`}>
                    <TableCell>{row.type}</TableCell>
                    <TableCell>{row.phoneNumber ? `+${row.phoneNumber}` : '—'}</TableCell>
                    <TableCell>{row.status}</TableCell>
                    <TableCell>{row.workspace?.name ?? '—'}</TableCell>
                    <TableCell>{row.messageCount ?? '—'}</TableCell>
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
