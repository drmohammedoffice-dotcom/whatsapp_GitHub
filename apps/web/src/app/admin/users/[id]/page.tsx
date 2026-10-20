'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { fetchAdminUser, impersonateUser } from '@/lib/admin-api';

export default function AdminUserDetailPage() {
  const params = useParams<{ id: string }>();
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!params.id) return;
    fetchAdminUser(params.id)
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [params.id]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading user...
      </div>
    );
  }

  if (!data) return <p>User not found.</p>;

  const user = data.user as Record<string, unknown>;
  const stats = data.stats as { messageCount: number; aiCostCents: number; aiRuns: number };
  const integrations = data.integrations as Record<string, unknown[]>;

  return (
    <div>
      <div className="mb-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/admin/users">← Back to users</Link>
        </Button>
      </div>
      <PageHeader title={String(user.name)} description={String(user.email)} />
      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <Card className="border-0 shadow-card">
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">Messages</p>
            <p className="text-2xl font-semibold">{stats.messageCount}</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-card">
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">AI usage (cost)</p>
            <p className="text-2xl font-semibold">${(stats.aiCostCents / 100).toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-card">
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">AI runs</p>
            <p className="text-2xl font-semibold">{stats.aiRuns}</p>
          </CardContent>
        </Card>
      </div>
      <Card className="mt-4 border-0 shadow-card">
        <CardContent className="space-y-3 pt-6">
          <p className="font-medium">Profile</p>
          <p className="text-sm text-muted-foreground">Status: {user.suspendedAt ? <Badge variant="destructive">Suspended</Badge> : <Badge variant="success">Active</Badge>}</p>
          <p className="text-sm">Joined: {new Date(String(user.createdAt)).toLocaleString()}</p>
          <Button size="sm" onClick={() => void impersonateUser(String(user.id)).then(() => { window.location.href = '/dashboard'; })}>
            Login as user
          </Button>
        </CardContent>
      </Card>
      <Card className="mt-4 border-0 shadow-card">
        <CardContent className="pt-6">
          <p className="mb-2 font-medium">Connected channels</p>
          <ul className="space-y-1 text-sm text-muted-foreground">
            <li>WhatsApp sessions: {(integrations.whatsappSessions ?? []).length}</li>
            <li>WhatsApp Cloud: {(integrations.whatsappCloud ?? []).length}</li>
            <li>Meta: {(integrations.meta ?? []).length}</li>
            <li>TikTok: {(integrations.tiktok ?? []).length}</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
