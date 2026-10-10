'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Loader2, Plus, Trash2 } from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { useTranslation } from '@/components/providers/locale-provider';
import { PageHeader } from '@/components/shared/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { api, parseApiError } from '@/lib/utils';

type Staff = { id: string; name: string; title?: string | null; specialty?: string | null; isActive: boolean };
type Service = {
  id: string;
  name: string;
  durationMin: number;
  priceCents?: number | null;
  currency: string;
  isActive: boolean;
};
type Profile = {
  enabled: boolean;
  vertical: string;
  orgName?: string | null;
  description?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  timezone: string;
  defaultDurationMin: number;
  bufferMin: number;
  bookingWindowDays: number;
  instructions?: string | null;
  aiCanReply: boolean;
  aiCanCreate: boolean;
  aiCanUpdate: boolean;
  aiCanCancel: boolean;
  aiCanReadCalendar: boolean;
  aiCanSendReminders: boolean;
  staff: Staff[];
  services: Service[];
};

type GoogleStatus = {
  status: string;
  googleAccountEmail?: string | null;
  calendarId?: string | null;
  calendarSummary?: string | null;
} | null;

export default function AppointmentSettingsPage() {
  const { t } = useTranslation();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [google, setGoogle] = useState<GoogleStatus>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [staffName, setStaffName] = useState('');
  const [staffTitle, setStaffTitle] = useState('');
  const [serviceName, setServiceName] = useState('');
  const [serviceDuration, setServiceDuration] = useState(30);
  const [servicePrice, setServicePrice] = useState('');

  async function reload() {
    const [p, g] = await Promise.all([
      api<Profile>('/appointments/profile'),
      api<GoogleStatus>('/integrations/google/status').catch(() => null),
    ]);
    setProfile(p);
    setGoogle(g);
  }

  useEffect(() => {
    reload().catch((err) => setNotice(parseApiError(err)));
  }, []);

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!profile) return;
    setBusy(true);
    setNotice(null);
    try {
      const form = new FormData(event.currentTarget);
      const updated = await api<Profile>('/appointments/profile', {
        method: 'POST',
        body: JSON.stringify({
          enabled: form.get('enabled') === 'on',
          orgName: String(form.get('orgName') || '') || null,
          description: String(form.get('description') || '') || null,
          phone: String(form.get('phone') || '') || null,
          email: String(form.get('email') || '') || null,
          address: String(form.get('address') || '') || null,
          timezone: String(form.get('timezone') || profile.timezone),
          defaultDurationMin: Number(form.get('defaultDurationMin') || 30),
          bufferMin: Number(form.get('bufferMin') || 0),
          bookingWindowDays: Number(form.get('bookingWindowDays') || 30),
          instructions: String(form.get('instructions') || '') || null,
          aiCanReply: profile.aiCanReply,
          aiCanCreate: profile.aiCanCreate,
          aiCanUpdate: profile.aiCanUpdate,
          aiCanCancel: profile.aiCanCancel,
          aiCanReadCalendar: profile.aiCanReadCalendar,
          aiCanSendReminders: profile.aiCanSendReminders,
          vertical: profile.vertical || 'CLINIC',
        }),
      });
      setProfile(updated);
      setNotice(t('appointments.saved'));
    } catch (err) {
      setNotice(parseApiError(err));
    } finally {
      setBusy(false);
    }
  }

  async function connectGoogle() {
    setBusy(true);
    try {
      const res = await api<{ url: string }>('/integrations/google/connect', { method: 'POST', body: '{}' });
      window.location.href = res.url;
    } catch (err) {
      setNotice(parseApiError(err));
      setBusy(false);
    }
  }

  async function disconnectGoogle() {
    setBusy(true);
    try {
      await api('/integrations/google/disconnect', { method: 'POST', body: '{}' });
      await reload();
      setNotice(t('appointments.googleDisconnected'));
    } catch (err) {
      setNotice(parseApiError(err));
    } finally {
      setBusy(false);
    }
  }

  async function addStaff() {
    if (!staffName.trim()) return;
    setBusy(true);
    try {
      await api('/appointments/staff', {
        method: 'POST',
        body: JSON.stringify({ name: staffName, title: staffTitle || null }),
      });
      setStaffName('');
      setStaffTitle('');
      await reload();
    } catch (err) {
      setNotice(parseApiError(err));
    } finally {
      setBusy(false);
    }
  }

  async function removeStaff(id: string) {
    setBusy(true);
    try {
      await api(`/appointments/staff/${id}`, { method: 'DELETE' });
      await reload();
    } catch (err) {
      setNotice(parseApiError(err));
    } finally {
      setBusy(false);
    }
  }

  async function addService() {
    if (!serviceName.trim()) return;
    setBusy(true);
    try {
      await api('/appointments/services', {
        method: 'POST',
        body: JSON.stringify({
          name: serviceName,
          durationMin: serviceDuration,
          priceCents: servicePrice ? Math.round(Number(servicePrice) * 100) : null,
        }),
      });
      setServiceName('');
      setServicePrice('');
      await reload();
    } catch (err) {
      setNotice(parseApiError(err));
    } finally {
      setBusy(false);
    }
  }

  async function removeService(id: string) {
    setBusy(true);
    try {
      await api(`/appointments/services/${id}`, { method: 'DELETE' });
      await reload();
    } catch (err) {
      setNotice(parseApiError(err));
    } finally {
      setBusy(false);
    }
  }

  function toggleCapability(key: keyof Profile, value: boolean) {
    if (!profile) return;
    setProfile({ ...profile, [key]: value });
  }

  return (
    <AppShell>
      <PageHeader
        title={t('appointments.settingsTitle')}
        description={t('appointments.settingsDesc')}
        actions={
          <Button asChild variant="ghost">
            <Link href="/appointments">
              <ArrowLeft className="mr-2 h-4 w-4" />
              {t('appointments.back')}
            </Link>
          </Button>
        }
      />

      {notice && <p className="mb-4 text-sm text-muted-foreground">{notice}</p>}
      {!profile && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> {t('common.loading')}
        </div>
      )}

      {profile && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>{t('appointments.orgSection')}</CardTitle>
              <CardDescription>{t('appointments.orgHint')}</CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={saveProfile}>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="enabled" defaultChecked={profile.enabled} />
                  {t('appointments.enableSystem')}
                </label>
                <div className="space-y-2">
                  <Label htmlFor="orgName">{t('appointments.orgName')}</Label>
                  <Input id="orgName" name="orgName" defaultValue={profile.orgName ?? ''} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">{t('appointments.description')}</Label>
                  <Textarea id="description" name="description" defaultValue={profile.description ?? ''} rows={3} />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="phone">{t('appointments.phone')}</Label>
                    <Input id="phone" name="phone" defaultValue={profile.phone ?? ''} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">{t('appointments.email')}</Label>
                    <Input id="email" name="email" type="email" defaultValue={profile.email ?? ''} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="address">{t('appointments.address')}</Label>
                  <Input id="address" name="address" defaultValue={profile.address ?? ''} />
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="timezone">{t('appointments.timezone')}</Label>
                    <Input id="timezone" name="timezone" defaultValue={profile.timezone} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="defaultDurationMin">{t('appointments.duration')}</Label>
                    <Input id="defaultDurationMin" name="defaultDurationMin" type="number" defaultValue={profile.defaultDurationMin} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="bufferMin">{t('appointments.buffer')}</Label>
                    <Input id="bufferMin" name="bufferMin" type="number" defaultValue={profile.bufferMin} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bookingWindowDays">{t('appointments.window')}</Label>
                  <Input id="bookingWindowDays" name="bookingWindowDays" type="number" defaultValue={profile.bookingWindowDays} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="instructions">{t('appointments.instructions')}</Label>
                  <Textarea id="instructions" name="instructions" defaultValue={profile.instructions ?? ''} rows={5} />
                </div>
                <Button type="submit" disabled={busy}>
                  {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  {t('common.save')}
                </Button>
              </form>
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>{t('appointments.googleTitle')}</CardTitle>
                <CardDescription>{t('appointments.googleDesc')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2">
                  <Badge variant={google?.status === 'CONNECTED' ? 'default' : 'secondary'}>
                    {google?.status ?? 'DISCONNECTED'}
                  </Badge>
                  {google?.googleAccountEmail && (
                    <span className="text-sm text-muted-foreground">{google.googleAccountEmail}</span>
                  )}
                </div>
                {google?.calendarSummary && (
                  <p className="text-sm">{t('appointments.calendar')}: {google.calendarSummary}</p>
                )}
                <div className="flex flex-wrap gap-2">
                  {google?.status === 'CONNECTED' ? (
                    <Button variant="outline" onClick={disconnectGoogle} disabled={busy}>
                      {t('appointments.disconnectGoogle')}
                    </Button>
                  ) : (
                    <Button onClick={connectGoogle} disabled={busy}>
                      {t('appointments.connectGoogle')}
                    </Button>
                  )}
                  <Button variant="secondary" asChild>
                    <Link href="/settings/google-calendar">Google Calendar</Link>
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">{t('appointments.knowledgeHint')}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t('appointments.capabilities')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {(
                  [
                    ['aiCanReply', 'appointments.capReply'],
                    ['aiCanCreate', 'appointments.capCreate'],
                    ['aiCanUpdate', 'appointments.capUpdate'],
                    ['aiCanCancel', 'appointments.capCancel'],
                    ['aiCanReadCalendar', 'appointments.capCalendar'],
                    ['aiCanSendReminders', 'appointments.capReminders'],
                  ] as const
                ).map(([key, label]) => (
                  <div key={key} className="flex items-center justify-between gap-3">
                    <Label>{t(label)}</Label>
                    <Switch checked={Boolean(profile[key])} onCheckedChange={(v) => toggleCapability(key, v)} />
                  </div>
                ))}
                <Button
                  variant="secondary"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      const updated = await api<Profile>('/appointments/profile', {
                        method: 'POST',
                        body: JSON.stringify({
                          aiCanReply: profile.aiCanReply,
                          aiCanCreate: profile.aiCanCreate,
                          aiCanUpdate: profile.aiCanUpdate,
                          aiCanCancel: profile.aiCanCancel,
                          aiCanReadCalendar: profile.aiCanReadCalendar,
                          aiCanSendReminders: profile.aiCanSendReminders,
                        }),
                      });
                      setProfile(updated);
                      setNotice(t('appointments.saved'));
                    } catch (err) {
                      setNotice(parseApiError(err));
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  {t('appointments.saveCapabilities')}
                </Button>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>{t('appointments.staff')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input placeholder={t('appointments.staffName')} value={staffName} onChange={(e) => setStaffName(e.target.value)} />
                <Input placeholder={t('appointments.staffTitle')} value={staffTitle} onChange={(e) => setStaffTitle(e.target.value)} />
                <Button type="button" onClick={addStaff} disabled={busy}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <ul className="space-y-2">
                {profile.staff.map((s) => (
                  <li key={s.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                    <span>
                      {s.name}
                      {s.title ? ` — ${s.title}` : ''}
                    </span>
                    <Button size="icon" variant="ghost" onClick={() => removeStaff(s.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('appointments.services')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input placeholder={t('appointments.serviceName')} value={serviceName} onChange={(e) => setServiceName(e.target.value)} />
                <Input type="number" className="w-28" value={serviceDuration} onChange={(e) => setServiceDuration(Number(e.target.value))} />
                <Input placeholder={t('appointments.price')} value={servicePrice} onChange={(e) => setServicePrice(e.target.value)} />
                <Button type="button" onClick={addService} disabled={busy}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <ul className="space-y-2">
                {profile.services.map((s) => (
                  <li key={s.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                    <span>
                      {s.name} · {s.durationMin}m
                      {s.priceCents != null ? ` · ${s.priceCents / 100} ${s.currency}` : ''}
                    </span>
                    <Button size="icon" variant="ghost" onClick={() => removeService(s.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      )}
    </AppShell>
  );
}
