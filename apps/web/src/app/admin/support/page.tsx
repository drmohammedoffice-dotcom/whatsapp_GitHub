'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { fetchAdminTickets } from '@/lib/admin-api';

export default function AdminSupportPage() {
  const [tickets, setTickets] = useState<unknown[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAdminTickets().then(setTickets).finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <PageHeader title="Support Center" description="Manage customer support tickets" />
      {loading ? (
        <div className="mt-4 flex gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading...</div>
      ) : (
        <div className="mt-4 rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Subject</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Reporter</TableHead>
                <TableHead>Updated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tickets.map((t) => {
                const ticket = t as {
                  id: string;
                  subject: string;
                  status: string;
                  priority: string;
                  updatedAt: string;
                  reporter?: { email: string };
                };
                return (
                  <TableRow key={ticket.id}>
                    <TableCell>{ticket.subject}</TableCell>
                    <TableCell><Badge variant="secondary">{ticket.status}</Badge></TableCell>
                    <TableCell>{ticket.priority}</TableCell>
                    <TableCell>{ticket.reporter?.email ?? '—'}</TableCell>
                    <TableCell>{new Date(ticket.updatedAt).toLocaleString()}</TableCell>
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
