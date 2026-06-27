'use client';

import { FormEvent, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Mail, Phone, Search, User } from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { useTranslation } from '@/components/providers/locale-provider';
import { EmptyState } from '@/components/shared/empty-state';
import { PageHeader } from '@/components/shared/page-header';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { api } from '@/lib/utils';

type Contact = { id: string; displayName: string; email?: string; phone?: string; notes?: string; identities?: Array<{ externalId: string; channel: { name: string } }>; conversations?: Array<{ id: string; status: string; lastMessageAt?: string }> };

export default function CustomersPage() {
  const { t } = useTranslation();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selected, setSelected] = useState<Contact | null>(null);
  const [search, setSearch] = useState('');

  async function load() { setContacts(await api<Contact[]>(`/contacts${search ? `?search=${encodeURIComponent(search)}` : ''}`)); }
  async function detail(id: string) { setSelected(await api<Contact>(`/contacts/${id}`)); }
  useEffect(() => { load().catch(console.error); }, []);

  async function update(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    const form = new FormData(event.currentTarget);
    await api(`/contacts/${selected.id}`, { method: 'PATCH', body: JSON.stringify({ displayName: form.get('displayName'), email: form.get('email'), phone: form.get('phone'), notes: form.get('notes') }) });
    await Promise.all([load(), detail(selected.id)]);
  }

  return (
    <AppShell>
      <PageHeader title={t('customers.title')} description={t('customers.description')} />

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_380px]">
        <Card className="border-0 shadow-card">
          <CardHeader>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle>All customers</CardTitle>
                <CardDescription>{contacts.length} contacts in your workspace</CardDescription>
              </div>
              <form onSubmit={(e) => { e.preventDefault(); load().catch(console.error); }} className="relative w-full sm:w-72">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('customers.search')} className="ps-9" />
              </form>
            </div>
          </CardHeader>
          <CardContent>
            {contacts.length === 0 ? (
              <EmptyState icon={User} title={t('customers.noCustomersYet')} description={t('customers.noCustomersYetDesc')} />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('customers.name')}</TableHead>
                    <TableHead>{t('customers.phone')}</TableHead>
                    <TableHead>{t('customers.email')}</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {contacts.map((contact) => (
                    <TableRow
                      key={contact.id}
                      data-state={selected?.id === contact.id ? 'selected' : undefined}
                      className="cursor-pointer"
                      onClick={() => detail(contact.id)}
                    >
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="bg-primary/10 text-primary text-xs">
                              {contact.displayName.slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <span className="font-medium">{contact.displayName}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{contact.phone || '—'}</TableCell>
                      <TableCell className="text-muted-foreground">{contact.email || '—'}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); detail(contact.id); }}>
                          {t('common.open')}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <motion.div initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.3 }}>
          <Card className="sticky top-24 border-0 shadow-card">
            <CardHeader>
              <CardTitle>{selected?.displayName ?? 'Customer profile'}</CardTitle>
              <CardDescription>
                {selected ? 'Edit contact details and view history' : 'Select a customer to view their profile'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {selected ? (
                <form onSubmit={update} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="displayName">{t('customers.name')}</Label>
                    <Input id="displayName" name="displayName" defaultValue={selected.displayName} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">{t('customers.email')}</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input id="email" name="email" defaultValue={selected.email ?? ''} placeholder="Email" className="pl-9" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">{t('customers.phone')}</Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input id="phone" name="phone" defaultValue={selected.phone ?? ''} placeholder="Phone" className="pl-9" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="notes">Notes</Label>
                    <Textarea id="notes" name="notes" defaultValue={selected.notes ?? ''} placeholder="Internal notes..." rows={3} />
                  </div>
                  <Button className="w-full">{t('common.save')}</Button>

                  <Separator />

                  <div>
                    <h4 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Channel identities</h4>
                    <div className="space-y-2">
                      {selected.identities?.map((identity) => (
                        <div key={identity.externalId} className="rounded-lg bg-muted p-2.5 text-sm">
                          <Badge variant="outline" className="mb-1">{identity.channel.name}</Badge>
                          <p className="text-muted-foreground">{identity.externalId}</p>
                        </div>
                      )) ?? <p className="text-sm text-muted-foreground">No identities</p>}
                    </div>
                  </div>

                  <div>
                    <h4 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Conversation history</h4>
                    <ScrollArea className="max-h-40">
                      {selected.conversations?.map((conversation) => (
                        <div key={conversation.id} className="mb-2 flex items-center justify-between rounded-lg bg-muted p-2.5 text-sm">
                          <Badge variant={conversation.status === 'OPEN' ? 'success' : 'secondary'}>{conversation.status}</Badge>
                          <span className="text-xs text-muted-foreground">{conversation.lastMessageAt}</span>
                        </div>
                      )) ?? <p className="text-sm text-muted-foreground">No conversations</p>}
                    </ScrollArea>
                  </div>
                </form>
              ) : (
                <EmptyState icon={User} title={t('customers.noCustomerSelected')} description={t('customers.noCustomerSelectedDesc')} />
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </AppShell>
  );
}
