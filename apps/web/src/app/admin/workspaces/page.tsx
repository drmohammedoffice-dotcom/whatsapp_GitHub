'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { fetchAdminWorkspaces } from '@/lib/admin-api';

export default function AdminWorkspacesPage() {
  const [workspaces, setWorkspaces] = useState<unknown[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAdminWorkspaces()
      .then((d) => {
        setWorkspaces(d.workspaces);
        setTotal(d.total);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <PageHeader title="Workspaces" description={`${total} workspaces`} />
      {loading ? (
        <div className="mt-4 flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading...
        </div>
      ) : (
        <div className="mt-4 rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>Members</TableHead>
                <TableHead>Conversations</TableHead>
                <TableHead>Plan</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {workspaces.map((w) => {
                const ws = w as {
                  id: string;
                  name: string;
                  slug: string;
                  members: unknown[];
                  _count?: { conversations: number };
                  subscription?: { plan?: { name: string } };
                };
                return (
                  <TableRow key={ws.id}>
                    <TableCell>{ws.name}</TableCell>
                    <TableCell>{ws.slug}</TableCell>
                    <TableCell>{ws.members.length}</TableCell>
                    <TableCell>{ws._count?.conversations ?? 0}</TableCell>
                    <TableCell>{ws.subscription?.plan?.name ?? '—'}</TableCell>
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
