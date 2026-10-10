'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { fetchAdminTikTok } from '@/lib/admin-api';

export default function AdminTikTokPage() {
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAdminTikTok().then(setData).finally(() => setLoading(false));
  }, []);

  const connections = (data?.connections as unknown[]) ?? [];
  const eventSets = (data?.eventSets as unknown[]) ?? [];

  return (
    <div>
      <PageHeader title="TikTok Management" description="Advertisers, campaigns, and event sets" />
      {loading ? (
        <div className="mt-4 flex gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading...</div>
      ) : (
        <>
          <h2 className="mt-4 text-sm font-semibold">Connections ({connections.length})</h2>
          <div className="mt-2 rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Token expires</TableHead>
                  <TableHead>Advertisers</TableHead>
                  <TableHead>Last sync</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {connections.map((c) => {
                  const row = c as {
                    id: string;
                    marketingExpiresAt: string;
                    lastBusinessSyncAt: string | null;
                    user?: { email: string };
                    advertisers?: unknown[];
                  };
                  return (
                    <TableRow key={row.id}>
                      <TableCell>{row.user?.email ?? '—'}</TableCell>
                      <TableCell>{new Date(row.marketingExpiresAt).toLocaleString()}</TableCell>
                      <TableCell>{row.advertisers?.length ?? 0}</TableCell>
                      <TableCell>{row.lastBusinessSyncAt ? new Date(row.lastBusinessSyncAt).toLocaleString() : '—'}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          <h2 className="mt-8 text-sm font-semibold">Event Sets ({eventSets.length})</h2>
          <div className="mt-2 rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Advertiser</TableHead>
                  <TableHead>WhatsApp</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {eventSets.map((e) => {
                  const row = e as { id: string; advertiserId: string; whatsappNumber: string; status: string };
                  return (
                    <TableRow key={row.id}>
                      <TableCell>{row.advertiserId}</TableCell>
                      <TableCell>+{row.whatsappNumber}</TableCell>
                      <TableCell>{row.status}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  );
}
