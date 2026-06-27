'use client';

import { useEffect, useState } from 'react';
import { Bot, Clock, MessageSquare, MessagesSquare, Star, TrendingUp, UserRound } from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { useTranslation } from '@/components/providers/locale-provider';
import { PageHeader } from '@/components/shared/page-header';
import { StatCard } from '@/components/shared/stat-card';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { api } from '@/lib/utils';

export default function AnalyticsPage() {
  const { t } = useTranslation();
  const [summary, setSummary] = useState<Record<string, number>>({});
  const [response, setResponse] = useState<{ averageMs: number; samples: number } | null>(null);
  const [volume, setVolume] = useState<Array<{ direction: string; count: number }>>([]);
  const [ai, setAi] = useState<{ transfers: Array<{ reason: string; _count: { _all: number } }> } | null>(null);
  const [products, setProducts] = useState<Array<{ id: string; name: string; viewCount: number }>>([]);

  useEffect(() => {
    Promise.all([
      api<Record<string, number>>('/analytics/summary'),
      api<{ averageMs: number; samples: number }>('/analytics/response-time'),
      api<Array<{ direction: string; count: number }>>('/analytics/volume'),
      api<{ transfers: Array<{ reason: string; _count: { _all: number } }> }>('/analytics/ai'),
      api<Array<{ id: string; name: string; viewCount: number }>>('/analytics/products'),
    ]).then(([s, r, v, a, p]) => {
      setSummary(s);
      setResponse(r);
      setVolume(v);
      setAi(a);
      setProducts(p);
    }).catch(console.error);
  }, []);

  const totalVolume = volume.reduce((sum, row) => sum + row.count, 0);

  return (
    <AppShell>
      <PageHeader title={t('analytics.title')} description={t('analytics.description')} />

      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard title={t('analytics.openConversations')} value={summary.openConversations ?? 0} icon={MessageSquare} delay={0} />
        <StatCard title={t('analytics.aiReplies')} value={summary.successfulAiReplies30d ?? 0} icon={Bot} delay={0.05} />
        <StatCard title={t('analytics.humanTransfers')} value={summary.humanTransfers30d ?? 0} icon={UserRound} delay={0.1} />
        <StatCard
          title={t('analytics.avgSatisfaction')}
          value={(summary.avgSatisfaction ?? 0).toFixed(1)}
          icon={Star}
          trend={`${summary.satisfactionSamples ?? 0} ${t('analytics.ratings')}`}
          delay={0.15}
        />
        <StatCard title={t('analytics.messages30d')} value={summary.messages30d ?? 0} icon={MessagesSquare} delay={0.2} />
        <StatCard title={t('analytics.leads30d')} value={summary.leads30d ?? 0} icon={TrendingUp} delay={0.25} />
        <StatCard
          title={t('analytics.avgResponseTime')}
          value={`${Math.round((response?.averageMs ?? 0) / 60000)}m`}
          icon={Clock}
          trend={`${response?.samples ?? 0} ${t('analytics.samples')}`}
          delay={0.3}
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card className="border-0 shadow-card">
          <CardHeader>
            <CardTitle>{t('analytics.volume')}</CardTitle>
            <CardDescription>{totalVolume} {t('analytics.totalMessages')}</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('analytics.direction')}</TableHead>
                  <TableHead>{t('analytics.count')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {volume.map((row) => (
                  <TableRow key={row.direction}>
                    <TableCell>{row.direction}</TableCell>
                    <TableCell>{row.count}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-card">
          <CardHeader>
            <CardTitle>{t('analytics.transferReasons')}</CardTitle>
            <CardDescription>{t('analytics.transferReasonsDesc')}</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('analytics.reason')}</TableHead>
                  <TableHead>{t('analytics.count')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(ai?.transfers ?? []).map((row) => (
                  <TableRow key={row.reason}>
                    <TableCell>{row.reason}</TableCell>
                    <TableCell>{row._count._all}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6 border-0 shadow-card">
        <CardHeader>
          <CardTitle>{t('analytics.topProducts')}</CardTitle>
          <CardDescription>{t('analytics.topProductsDesc')}</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('analytics.product')}</TableHead>
                <TableHead>{t('analytics.views')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>{p.name}</TableCell>
                  <TableCell>{p.viewCount}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </AppShell>
  );
}
