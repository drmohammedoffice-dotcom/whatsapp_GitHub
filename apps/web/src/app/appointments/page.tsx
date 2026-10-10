'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CalendarClock, Loader2, Settings2 } from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { useTranslation } from '@/components/providers/locale-provider';
import { PageHeader } from '@/components/shared/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { api, parseApiError } from '@/lib/utils';

type Dashboard = {
  total: number;
  aiCreated: number;
  cancelled: number;
  upcoming: number;
  confirmed: number;
  successRate: number;
  timezone: string;
  upcomingList: Array<{
    id: string;
    customerName?: string | null;
    customerPhone: string;
    startsAt: string;
    status: string;
    source: string;
    staff?: { name: string } | null;
    service?: { name: string } | null;
  }>;
};

export default function AppointmentsPage() {
  const { t } = useTranslation();
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<Dashboard>('/appointments/dashboard')
      .then(setData)
      .catch((err) => setError(parseApiError(err)))
      .finally(() => setLoading(false));
  }, []);

  return (
    <AppShell>
      <PageHeader
        title={t('appointments.title')}
        description={t('appointments.desc')}
        actions={
          <Button asChild variant="outline">
            <Link href="/settings/google-calendar">
              <Settings2 className="mr-2 h-4 w-4" />
              {t('appointments.settings')}
            </Link>
          </Button>
        }
      />

      {loading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> {t('common.loading')}
        </div>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}

      {data && (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {[
              { label: t('appointments.statTotal'), value: data.total },
              { label: t('appointments.statAi'), value: data.aiCreated },
              { label: t('appointments.statSuccess'), value: `${data.successRate}%` },
              { label: t('appointments.statCancelled'), value: data.cancelled },
              { label: t('appointments.statUpcoming'), value: data.upcoming },
            ].map((stat) => (
              <Card key={stat.label}>
                <CardHeader className="pb-2">
                  <CardDescription>{stat.label}</CardDescription>
                  <CardTitle className="text-2xl">{stat.value}</CardTitle>
                </CardHeader>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarClock className="h-5 w-5" />
                {t('appointments.upcomingTitle')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('appointments.customer')}</TableHead>
                    <TableHead>{t('appointments.service')}</TableHead>
                    <TableHead>{t('appointments.when')}</TableHead>
                    <TableHead>{t('appointments.status')}</TableHead>
                    <TableHead>{t('appointments.source')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.upcomingList.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-muted-foreground">
                        {t('appointments.emptyUpcoming')}
                      </TableCell>
                    </TableRow>
                  )}
                  {data.upcomingList.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>
                        <div className="font-medium">{row.customerName || row.customerPhone}</div>
                        <div className="text-xs text-muted-foreground">{row.customerPhone}</div>
                      </TableCell>
                      <TableCell>{row.service?.name || row.staff?.name || '—'}</TableCell>
                      <TableCell>
                        {new Intl.DateTimeFormat('ar-IQ', {
                          timeZone: data.timezone,
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        }).format(new Date(row.startsAt))}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{row.status}</Badge>
                      </TableCell>
                      <TableCell>{row.source}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}
    </AppShell>
  );
}
