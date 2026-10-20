'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { fetchAdminAnalytics } from '@/lib/admin-api';

export default function AdminAnalyticsPage() {
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAdminAnalytics().then(setData).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading analytics...
      </div>
    );
  }

  if (!data) return <p>Failed to load analytics.</p>;

  const usage = data.usage as { aiCostCents: number; newUsers30: number; aiEvents: number };

  return (
    <div>
      <PageHeader title="Analytics" description="Revenue, growth, and usage metrics" />
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-0 shadow-card">
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">MRR</p>
            <p className="text-2xl font-semibold">${((data.mrrCents as number) / 100).toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-card">
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">Churn rate</p>
            <p className="text-2xl font-semibold">{data.churnRate as number}%</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-card">
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">Conversion rate</p>
            <p className="text-2xl font-semibold">{data.conversionRate as number}%</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-card">
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">New users (30d)</p>
            <p className="text-2xl font-semibold">{usage.newUsers30}</p>
          </CardContent>
        </Card>
      </div>
      <Card className="mt-4 border-0 shadow-card">
        <CardContent className="pt-6">
          <p className="font-medium">Usage</p>
          <p className="mt-2 text-sm text-muted-foreground">AI events: {usage.aiEvents}</p>
          <p className="text-sm text-muted-foreground">AI cost: ${(usage.aiCostCents / 100).toFixed(2)}</p>
        </CardContent>
      </Card>
    </div>
  );
}
