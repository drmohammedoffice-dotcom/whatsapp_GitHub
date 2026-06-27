'use client';

import { useEffect, useState } from 'react';
import { ClipboardList, Download, FileSpreadsheet, Loader2, Search } from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { useTranslation } from '@/components/providers/locale-provider';
import { EmptyState } from '@/components/shared/empty-state';
import { PageHeader } from '@/components/shared/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { api, downloadAuthedFile } from '@/lib/utils';

type Booking = {
  id: string;
  orderNumber: string;
  phoneNumber: string;
  address: string;
  orderType: string;
  totalAmount: number;
  currency: string;
  status: string;
  usedWhatsappPhone: boolean;
  notes?: string | null;
  createdAt: string;
  contact?: { displayName: string } | null;
};

export default function BookingsPage() {
  const { t } = useTranslation();
  const [items, setItems] = useState<Booking[]>([]);
  const [search, setSearch] = useState('');
  const [exporting, setExporting] = useState<'excel' | 'pdf' | null>(null);

  async function load() {
    const query = search ? `?search=${encodeURIComponent(search)}` : '';
    setItems(await api<Booking[]>(`/bookings${query}`));
  }

  useEffect(() => { load().catch(console.error); }, []);

  async function handleExport(format: 'excel' | 'pdf') {
    setExporting(format);
    try {
      const ext = format === 'excel' ? 'xlsx' : 'pdf';
      await downloadAuthedFile(`/bookings/export/${format}`, `bookings.${ext}`);
    } finally {
      setExporting(null);
    }
  }

  return (
    <AppShell>
      <PageHeader title={t('bookings.title')} description={t('bookings.description')} />

      <Card className="mt-6 border-0 shadow-card">
        <CardHeader>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <ClipboardList className="h-5 w-5" />
                {t('bookings.title')}
              </CardTitle>
              <CardDescription>{items.length} {t('bookings.title').toLowerCase()}</CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <form
                onSubmit={(e) => { e.preventDefault(); load().catch(console.error); }}
                className="relative w-full sm:w-64"
              >
                <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t('bookings.search')}
                  className="ps-9"
                />
              </form>
              <Button variant="outline" size="sm" onClick={() => handleExport('excel')} disabled={!!exporting}>
                {exporting === 'excel' ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <FileSpreadsheet className="me-2 h-4 w-4" />}
                {exporting === 'excel' ? t('bookings.exporting') : t('bookings.exportExcel')}
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleExport('pdf')} disabled={!!exporting}>
                {exporting === 'pdf' ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <Download className="me-2 h-4 w-4" />}
                {exporting === 'pdf' ? t('bookings.exporting') : t('bookings.exportPdf')}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <EmptyState icon={ClipboardList} title={t('bookings.emptyTitle')} description={t('bookings.emptyDesc')} />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('bookings.orderNumber')}</TableHead>
                  <TableHead>{t('bookings.customer')}</TableHead>
                  <TableHead>{t('bookings.phone')}</TableHead>
                  <TableHead>{t('bookings.address')}</TableHead>
                  <TableHead>{t('bookings.orderType')}</TableHead>
                  <TableHead>{t('bookings.total')}</TableHead>
                  <TableHead>{t('bookings.date')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.orderNumber}</TableCell>
                    <TableCell>{item.contact?.displayName ?? '—'}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span dir="ltr">{item.phoneNumber}</span>
                        {item.usedWhatsappPhone && <Badge variant="secondary">{t('bookings.whatsappPhone')}</Badge>}
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate">{item.address}</TableCell>
                    <TableCell>{item.orderType}</TableCell>
                    <TableCell>{item.totalAmount.toLocaleString()} {item.currency}</TableCell>
                    <TableCell>{new Date(item.createdAt).toLocaleString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </AppShell>
  );
}
