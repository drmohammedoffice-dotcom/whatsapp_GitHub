'use client';

import { FormEvent, useEffect, useState } from 'react';
import { Building2, Shield, Users } from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { useTranslation } from '@/components/providers/locale-provider';
import { PageHeader } from '@/components/shared/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { api } from '@/lib/utils';

type Agent = { id: string; userId: string; role: string; permissions: string[]; user: { id: string; name: string; email: string } };
type Department = { id: string; name: string; description?: string; members: unknown[] };

export default function AgentsPage() {
  const { t } = useTranslation();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  async function load() { const [a, d] = await Promise.all([api<Agent[]>('/agents'), api<Department[]>('/departments')]); setAgents(a); setDepartments(d); }
  useEffect(() => { load().catch(console.error); }, []);
  async function createDepartment(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const form = new FormData(event.currentTarget); await api('/departments', { method: 'POST', body: JSON.stringify({ name: form.get('name'), description: form.get('description') }) }); event.currentTarget.reset(); await load(); }

  return (
    <AppShell>
      <PageHeader title={t('agents.title')} description={t('agents.description')} />

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card className="border-0 shadow-card">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <CardTitle>{t('agents.title')}</CardTitle>
                <CardDescription>{agents.length} team members</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('agents.name')}</TableHead>
                  <TableHead>{t('agents.role')}</TableHead>
                  <TableHead>{t('agents.presence')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {agents.map((agent) => (
                  <TableRow key={agent.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="bg-primary/10 text-primary text-xs">
                            {agent.user.name.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{agent.user.name}</p>
                          <p className="text-xs text-muted-foreground">{agent.user.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{agent.role}</Badge>
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">
                      {agent.permissions.join(', ') || 'Role defaults'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-card">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Building2 className="h-5 w-5" />
              </div>
              <div>
                <CardTitle>Departments</CardTitle>
                <CardDescription>Organize your team into departments</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <form onSubmit={createDepartment} className="space-y-3 rounded-lg border bg-muted/30 p-4">
              <div className="space-y-2">
                <Label htmlFor="name">Department name</Label>
                <Input id="name" name="name" placeholder="Support, Sales..." required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Input id="description" name="description" placeholder="Optional description" />
              </div>
              <Button type="submit">Create department</Button>
            </form>

            <div className="space-y-3">
              {departments.map((department) => (
                <div key={department.id} className="flex items-center justify-between rounded-lg border p-4">
                  <div>
                    <p className="font-medium">{department.name}</p>
                    <p className="text-sm text-muted-foreground">{department.description || 'No description'}</p>
                  </div>
                  <Badge variant="outline">
                    <Shield className="mr-1 h-3 w-3" />
                    {department.members.length} members
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
