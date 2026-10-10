'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { fetchAdminMeta } from '@/lib/admin-api';

export default function AdminMetaPage() {
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAdminMeta().then(setData).finally(() => setLoading(false));
  }, []);

  const connections = (data?.connections as unknown[]) ?? [];

  return (
    <div>
      <PageHeader title="Meta Management" description="Facebook pages and Instagram accounts" />
      {loading ? (
        <div className="mt-4 flex gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading...</div>
      ) : (
        <div className="mt-4 rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Page</TableHead>
                <TableHead>Instagram</TableHead>
                <TableHead>Workspace</TableHead>
                <TableHead>Token expiry</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {connections.map((c) => {
                const row = c as {
                  id: string;
                  pageName: string | null;
                  instagramHandle: string | null;
                  tokenExpiresAt: string | null;
                  team?: { name: string };
                };
                return (
                  <TableRow key={row.id}>
                    <TableCell>{row.pageName ?? '—'}</TableCell>
                    <TableCell>{row.instagramHandle ?? '—'}</TableCell>
                    <TableCell>{row.team?.name ?? '—'}</TableCell>
                    <TableCell>{row.tokenExpiresAt ? new Date(row.tokenExpiresAt).toLocaleString() : '—'}</TableCell>
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
