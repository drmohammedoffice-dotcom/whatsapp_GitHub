'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { fetchAdminAuditLogs } from '@/lib/admin-api';

export default function AdminAuditPage() {
  const [rows, setRows] = useState<unknown[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAdminAuditLogs().then(setRows).finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <PageHeader title="Audit Logs" description="Admin actions and platform changes" />
      {loading ? (
        <div className="mt-4 flex gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading...</div>
      ) : (
        <div className="mt-4 rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Action</TableHead>
                <TableHead>Resource</TableHead>
                <TableHead>Admin</TableHead>
                <TableHead>Time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => {
                const log = r as {
                  id: string;
                  action: string;
                  resource: string;
                  createdAt: string;
                  adminUser?: { user?: { email: string } };
                };
                return (
                  <TableRow key={log.id}>
                    <TableCell>{log.action}</TableCell>
                    <TableCell>{log.resource}</TableCell>
                    <TableCell>{log.adminUser?.user?.email ?? '—'}</TableCell>
                    <TableCell>{new Date(log.createdAt).toLocaleString()}</TableCell>
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
