'use client';

import { FormEvent, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  disconnectOfficialWhatsApp,
  fetchOfficialWhatsApp,
  fetchOfficialWhatsAppLogs,
  fetchOfficialWhatsAppNotify,
  fetchOfficialWhatsAppOtp,
  fetchOfficialWhatsAppTemplates,
  saveOfficialWhatsAppNotify,
  saveOfficialWhatsAppOtp,
  saveOfficialWhatsAppSender,
  saveOfficialWhatsAppTemplate,
  testOfficialWhatsApp,
} from '@/lib/admin-api';

const TEMPLATE_TYPES = [
  'ACCOUNT_VERIFICATION_OTP',
  'LOGIN_OTP',
  'PASSWORD_RESET_OTP',
  'SUBSCRIPTION_EXPIRING',
  'SUBSCRIPTION_EXPIRING_SOON',
  'SUBSCRIPTION_EXPIRED',
  'PAYMENT_SUCCESSFUL',
  'SUBSCRIPTION_ACTIVATED',
  'SUBSCRIPTION_RENEWAL',
  'SYSTEM_NOTIFICATION',
];

export default function AdminWhatsAppSystemPage() {
  const [sender, setSender] = useState<Record<string, unknown> | null>(null);
  const [otp, setOtp] = useState<Record<string, unknown> | null>(null);
  const [notify, setNotify] = useState<Record<string, unknown> | null>(null);
  const [templates, setTemplates] = useState<Array<Record<string, unknown>>>([]);
  const [logs, setLogs] = useState<Array<Record<string, unknown>>>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function reload() {
    const [s, o, n, t, l] = await Promise.all([
      fetchOfficialWhatsApp(),
      fetchOfficialWhatsAppOtp(),
      fetchOfficialWhatsAppNotify(),
      fetchOfficialWhatsAppTemplates(),
      fetchOfficialWhatsAppLogs(),
    ]);
    setSender(s);
    setOtp(o);
    setNotify(n);
    setTemplates(t);
    setLogs(l.items);
  }

  useEffect(() => {
    reload().catch((err: Error) => setError(err.message));
  }, []);

  async function run(key: string, fn: () => Promise<unknown>) {
    setBusy(key);
    setError(null);
    try {
      await fn();
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setBusy(null);
    }
  }

  async function saveSender(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await run('sender', () =>
      saveOfficialWhatsAppSender({
        wabaId: String(form.get('wabaId') ?? ''),
        phoneNumberId: String(form.get('phoneNumberId') ?? ''),
        displayPhoneNumber: String(form.get('displayPhoneNumber') ?? ''),
        displayName: String(form.get('displayName') ?? ''),
        accessToken: String(form.get('accessToken') ?? '') || undefined,
        enabled: form.get('enabled') === 'on',
      }),
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="WhatsApp System"
        description="Official Chatloora WhatsApp sender, OTP, and subscription notifications. Not visible to customers."
      />
      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <Card>
        <CardHeader>
          <CardTitle>Chatloora Official WhatsApp</CardTitle>
          <CardDescription>Used only for platform OTP and subscription notices. Never mixed with customer inbox numbers.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-3 sm:grid-cols-2" onSubmit={saveSender}>
            <div>
              <Label>Status</Label>
              <p className="text-sm">{String(sender?.status ?? '—')} {sender?.enabled ? '(enabled)' : '(disabled)'}</p>
            </div>
            <div>
              <Label>Webhook</Label>
              <p className="text-sm">{String(sender?.webhookStatus ?? 'unknown')}</p>
            </div>
            <div>
              <Label htmlFor="displayName">Display name</Label>
              <Input id="displayName" name="displayName" defaultValue={String(sender?.displayName ?? '')} />
            </div>
            <div>
              <Label htmlFor="displayPhoneNumber">Official number</Label>
              <Input id="displayPhoneNumber" name="displayPhoneNumber" defaultValue={String(sender?.displayPhoneNumber ?? '')} />
            </div>
            <div>
              <Label htmlFor="wabaId">WABA ID</Label>
              <Input id="wabaId" name="wabaId" defaultValue={String(sender?.wabaId ?? '')} />
            </div>
            <div>
              <Label htmlFor="phoneNumberId">Phone Number ID</Label>
              <Input id="phoneNumberId" name="phoneNumberId" defaultValue={String(sender?.phoneNumberId ?? '')} />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="accessToken">Access token (leave blank to keep current)</Label>
              <Input id="accessToken" name="accessToken" type="password" autoComplete="off" />
              <p className="mt-1 text-xs text-muted-foreground">Stored token preview: {String(sender?.tokenPreview ?? 'none')}</p>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="enabled" defaultChecked={Boolean(sender?.enabled)} /> Enable official sender
            </label>
            <div className="flex flex-wrap gap-2 sm:col-span-2">
              <Button type="submit" disabled={busy === 'sender'}>{busy === 'sender' ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Save</Button>
              <Button type="button" variant="outline" disabled={busy === 'test'} onClick={() => run('test', () => testOfficialWhatsApp())}>API test</Button>
              <Button type="button" variant="destructive" disabled={busy === 'disc'} onClick={() => run('disc', () => disconnectOfficialWhatsApp())}>Disconnect</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>OTP</CardTitle>
          <CardDescription>WhatsApp Authentication templates only. Email verification remains available as fallback.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={Boolean(otp?.enabled)} onChange={(e) => run('otp', () => saveOfficialWhatsAppOtp({ enabled: e.target.checked }))} /> WhatsApp OTP</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={Boolean(otp?.loginEnabled)} onChange={(e) => run('otp', () => saveOfficialWhatsAppOtp({ loginEnabled: e.target.checked }))} /> Login OTP</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={Boolean(otp?.passwordResetEnabled)} onChange={(e) => run('otp', () => saveOfficialWhatsAppOtp({ passwordResetEnabled: e.target.checked }))} /> Password reset OTP</label>
          <div>
            <Label>Template</Label>
            <Input defaultValue={String(otp?.templateName ?? '')} onBlur={(e) => { if (e.target.value !== otp?.templateName) void run('otp', () => saveOfficialWhatsAppOtp({ templateName: e.target.value })); }} />
          </div>
          <div>
            <Label>Language</Label>
            <Input defaultValue={String(otp?.language ?? 'en')} onBlur={(e) => { if (e.target.value !== otp?.language) void run('otp', () => saveOfficialWhatsAppOtp({ language: e.target.value })); }} />
          </div>
          <div>
            <Label>Expiry (seconds)</Label>
            <Input type="number" defaultValue={Number(otp?.expirySeconds ?? 600)} onBlur={(e) => void run('otp', () => saveOfficialWhatsAppOtp({ expirySeconds: Number(e.target.value) }))} />
          </div>
          <div>
            <Label>Resend cooldown (seconds)</Label>
            <Input type="number" defaultValue={Number(otp?.resendCooldownSeconds ?? 60)} onBlur={(e) => void run('otp', () => saveOfficialWhatsAppOtp({ resendCooldownSeconds: Number(e.target.value) }))} />
          </div>
          <div>
            <Label>Max attempts</Label>
            <Input type="number" defaultValue={Number(otp?.maxAttempts ?? 5)} onBlur={(e) => void run('otp', () => saveOfficialWhatsAppOtp({ maxAttempts: Number(e.target.value) }))} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Subscription notifications</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={Boolean(notify?.enabled)} onChange={(e) => run('n', () => saveOfficialWhatsAppNotify({ enabled: e.target.checked }))} /> Enable</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={Boolean(notify?.reminder1Enabled)} onChange={(e) => run('n', () => saveOfficialWhatsAppNotify({ reminder1Enabled: e.target.checked }))} /> Reminder 1</label>
          <div>
            <Label>Reminder 1 days before expiry</Label>
            <Input type="number" defaultValue={Number(notify?.reminder1Days ?? 7)} onBlur={(e) => void run('n', () => saveOfficialWhatsAppNotify({ reminder1Days: Number(e.target.value) }))} />
          </div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={Boolean(notify?.reminder2Enabled)} onChange={(e) => run('n', () => saveOfficialWhatsAppNotify({ reminder2Enabled: e.target.checked }))} /> Reminder 2</label>
          <div>
            <Label>Reminder 2 days before expiry</Label>
            <Input type="number" defaultValue={Number(notify?.reminder2Days ?? 1)} onBlur={(e) => void run('n', () => saveOfficialWhatsAppNotify({ reminder2Days: Number(e.target.value) }))} />
          </div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={Boolean(notify?.expiredEnabled)} onChange={(e) => run('n', () => saveOfficialWhatsAppNotify({ expiredEnabled: e.target.checked }))} /> Expired notice</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={Boolean(notify?.paymentEnabled)} onChange={(e) => run('n', () => saveOfficialWhatsAppNotify({ paymentEnabled: e.target.checked }))} /> Payment successful</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={Boolean(notify?.activatedEnabled)} onChange={(e) => run('n', () => saveOfficialWhatsAppNotify({ activatedEnabled: e.target.checked }))} /> Subscription activated</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={Boolean(notify?.renewalEnabled)} onChange={(e) => run('n', () => saveOfficialWhatsAppNotify({ renewalEnabled: e.target.checked }))} /> Subscription renewal</label>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Message templates</CardTitle>
          <CardDescription>Use Meta-approved template names. Disabled templates are never sent.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {TEMPLATE_TYPES.map((type) => {
            const row = templates.find((t) => t.type === type) ?? { type, name: '', language: 'en', enabled: false };
            return (
              <div key={type} className="grid gap-2 rounded-md border p-3 sm:grid-cols-4">
                <p className="text-sm font-medium sm:col-span-4">{type}</p>
                <Input defaultValue={String(row.name ?? '')} placeholder="Meta template name" onBlur={(e) => void run('tpl', () => saveOfficialWhatsAppTemplate({ type, name: e.target.value, language: String(row.language ?? 'en'), enabled: Boolean(row.enabled) }))} />
                <Input defaultValue={String(row.language ?? 'en')} onBlur={(e) => void run('tpl', () => saveOfficialWhatsAppTemplate({ type, name: String(row.name ?? ''), language: e.target.value, enabled: Boolean(row.enabled) }))} />
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={Boolean(row.enabled)} onChange={(e) => void run('tpl', () => saveOfficialWhatsAppTemplate({ type, name: String(row.name ?? ''), language: String(row.language ?? 'en'), enabled: e.target.checked }))} />
                  Enabled
                </label>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Notification logs</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Template</TableHead>
                <TableHead>Subscription</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Sent</TableHead>
                <TableHead>Provider ID</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((row) => {
                const user = row.user as { email?: string } | undefined;
                return (
                  <TableRow key={String(row.id)}>
                    <TableCell>{user?.email ?? '—'}</TableCell>
                    <TableCell>{String(row.phone ?? '—')}</TableCell>
                    <TableCell>{String(row.notificationType)}</TableCell>
                    <TableCell>{String(row.templateName)}</TableCell>
                    <TableCell className="font-mono text-xs">{String(row.subscriptionId).slice(0, 8)}</TableCell>
                    <TableCell>{String(row.status)}{row.failureReason ? ` (${String(row.failureReason).slice(0, 40)})` : ''}</TableCell>
                    <TableCell>{row.sentAt ? String(row.sentAt) : '—'}</TableCell>
                    <TableCell className="font-mono text-xs">{String(row.providerMessageId ?? '—')}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
