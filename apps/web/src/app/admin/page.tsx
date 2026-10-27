'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { fetchAdminDashboard, type AdminDashboardStats } from '@/lib/admin-api';

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <Card className="border-0 shadow-card">
      <CardContent className="pt-6">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="mt-1 text-2xl font-semibold">{value}</p>
      </CardContent>
    </Card>
  );
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<AdminDashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAdminDashboard()
      .then(setStats)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading dashboard...
      </div>
    );
  }

  if (!stats) return <p className="text-destructive">Failed to load dashboard.</p>;

  const mrr = (stats.monthlyRevenueMrrCents / 100).toLocaleString(undefined, { style: 'currency', currency: 'USD' });

  return (
    <div>
      <PageHeader title="Dashboard" description="ChatLoora platform overview" />
      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total users" value={stats.totalUsers} />
        <StatCard label="Active subscriptions" value={stats.activeSubscriptions} />
        <StatCard label="Trial users" value={stats.trialUsers} />
        <StatCard label="Monthly revenue (MRR)" value={mrr} />
        <StatCard label="New users today" value={stats.newUsersToday} />
        <StatCard label="Active workspaces" value={stats.activeWorkspaces} />
        <StatCard label="Connected WhatsApp" value={stats.connectedWhatsAppNumbers} />
        <StatCard label="Connected TikTok" value={stats.connectedTikTokAccounts} />
      </div>
      <Card className="mt-4 border-0 shadow-card">
        <CardContent className="pt-6">
          <p className="text-sm font-medium">System health</p>
          <div className="mt-2 flex flex-wrap gap-4 text-sm text-muted-foreground">
            <span>Database: {stats.systemHealth.database}</span>
            <span>API: {stats.systemHealth.api}</span>
            <span>Checked: {new Date(stats.systemHealth.timestamp).toLocaleString()}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
