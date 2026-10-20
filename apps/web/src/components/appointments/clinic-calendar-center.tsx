'use client';

import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import {
  BookOpen,
  Bot,
  CalendarDays,
  Clock3,
  FileText,
  Loader2,
  Mic2,
  Plus,
  Save,
  Settings2,
  Stethoscope,
  Trash2,
  Unplug,
  Upload,
  Volume2,
} from 'lucide-react';
import { AlertBanner } from '@/components/shared/alert-banner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { api, apiUpload, parseApiError } from '@/lib/utils';

type Staff = {
  id: string;
  name: string;
  title?: string | null;
  specialty?: string | null;
  bio?: string | null;
  phone?: string | null;
  email?: string | null;
  isActive: boolean;
};
type Service = {
  id: string;
  name: string;
  description?: string | null;
  durationMin: number;
  priceCents?: number | null;
  currency: string;
  isActive: boolean;
};
type Hours = { day: number; open: string; close: string };
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
  bufferBeforeMin: number;
  bufferAfterMin: number;
  breakMin: number;
  maxDailyAppointments?: number | null;
  bookingWindowDays: number;
  instructions?: string | null;
  faqJson?: Array<{ q?: string; a?: string }> | null;
  clinicKnowledge?: Record<string, unknown> | null;
  businessHours?: { timezone?: string; schedule?: Hours[] } | null;
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
  calendarTimeZone?: string | null;
  lastSyncAt?: string | null;
  failureReason?: string | null;
} | null;
type KnowledgeDocument = {
  id: string;
  title: string;
  mimeType?: string | null;
  status: string;
  error?: string | null;
  _count?: { chunks: number };
};
type TrainingMedia = {
  id: string;
  title: string;
  description?: string | null;
  tags?: string | null;
  mimeType: string;
  fileName?: string | null;
  sizeBytes?: number | null;
  isVoiceNote: boolean;
  voiceLibraryType?: 'LIBRARY' | 'PROFILE' | null;
  category?: string | null;
  language?: string | null;
  durationSeconds?: number | null;
};

const KNOWLEDGE_FIELDS = [
  ['location', 'الموقع / المنطقة'],
  ['googleMapsUrl', 'رابط Google Maps'],
  ['contactNumbers', 'أرقام الاتصال'],
  ['specialties', 'التخصصات'],
  ['prices', 'الأسعار'],
  ['offers', 'العروض'],
  ['bookingPolicy', 'سياسة الحجز'],
  ['cancellationPolicy', 'سياسة الإلغاء'],
  ['preVisitInstructions', 'تعليمات قبل الزيارة'],
  ['postVisitInstructions', 'تعليمات بعد الزيارة'],
  ['restrictedMedications', 'الأدوية الممنوعة'],
  ['insuranceInfo', 'معلومات التأمين'],
  ['paymentInfo', 'معلومات الدفع'],
  ['additionalNotes', 'ملاحظات إضافية'],
] as const;

const DAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
const TIMEZONES = ['Asia/Baghdad', 'Asia/Riyadh', 'Asia/Dubai', 'Asia/Kuwait', 'Asia/Qatar', 'Asia/Amman', 'Africa/Cairo', 'Europe/Istanbul', 'UTC'];

function SectionCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="border-0 shadow-card">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  );
}

export function ClinicCalendarCenter() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [google, setGoogle] = useState<GoogleStatus>(null);
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
  const [media, setMedia] = useState<TrainingMedia[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [staffDraft, setStaffDraft] = useState({ name: '', title: '', specialty: '' });
  const [serviceDraft, setServiceDraft] = useState({ name: '', durationMin: '30', price: '', currency: 'IQD' });
  const [voiceDraft, setVoiceDraft] = useState({
    title: '',
    description: '',
    category: 'general',
    language: 'ar',
    durationSeconds: '',
  });

  const load = useCallback(async () => {
    const [p, g, docs, training] = await Promise.all([
      api<Profile>('/appointments/profile'),
      api<GoogleStatus>('/integrations/google/status').catch(() => null),
      api<KnowledgeDocument[]>('/ai/knowledge').catch(() => []),
      api<TrainingMedia[]>('/ai/training-media?platform=WHATSAPP').catch(() => []),
    ]);
    setProfile(p);
    setGoogle(g);
    setDocuments(docs);
    setMedia(training);
  }, []);

  useEffect(() => {
    load().catch((err) => setError(parseApiError(err)));
  }, [load]);

  const patchProfile = useCallback(async (patch: Partial<Profile>, message = 'تم حفظ الإعدادات') => {
    setBusy(true);
    setError(null);
    try {
      const updated = await api<Profile>('/appointments/profile', {
        method: 'POST',
        body: JSON.stringify(patch),
      });
      setProfile(updated);
      setNotice(message);
    } catch (err) {
      setError(parseApiError(err));
    } finally {
      setBusy(false);
    }
  }, []);

  async function saveGeneral(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!profile) return;
    const form = new FormData(event.currentTarget);
    await patchProfile({
      enabled: form.get('enabled') === 'on',
      vertical: 'CLINIC',
      orgName: String(form.get('orgName') || '') || null,
      description: String(form.get('description') || '') || null,
      phone: String(form.get('phone') || '') || null,
      email: String(form.get('email') || '') || null,
      address: String(form.get('address') || '') || null,
      timezone: String(form.get('timezone') || 'Asia/Baghdad'),
    });
  }

  async function saveKnowledge(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!profile) return;
    const form = new FormData(event.currentTarget);
    const clinicKnowledge = Object.fromEntries(
      KNOWLEDGE_FIELDS.map(([key]) => [key, String(form.get(key) || '').trim()]),
    );
    await patchProfile({
      orgName: String(form.get('clinicName') || '') || null,
      description: String(form.get('about') || '') || null,
      address: String(form.get('address') || '') || null,
      clinicKnowledge,
    }, 'تم حفظ معرفة العيادة وربطها بالذكاء الاصطناعي');
  }

  async function connectGoogle(reconnect = false) {
    setBusy(true);
    try {
      const result = await api<{ url: string }>(
        reconnect ? '/integrations/google/reconnect' : '/integrations/google/connect',
        { method: 'POST', body: '{}' },
      );
      window.location.href = result.url;
    } catch (err) {
      setError(parseApiError(err));
      setBusy(false);
    }
  }

  async function googleAction(action: 'disconnect' | 'sync') {
    setBusy(true);
    setError(null);
    try {
      await api(`/integrations/google/${action}`, { method: 'POST', body: '{}' });
      await load();
      setNotice(action === 'sync' ? 'تمت مزامنة Google Calendar' : 'تم قطع اتصال Google Calendar');
    } catch (err) {
      setError(parseApiError(err));
    } finally {
      setBusy(false);
    }
  }

  async function addStaff() {
    if (!staffDraft.name.trim()) return;
    setBusy(true);
    try {
      await api('/appointments/staff', { method: 'POST', body: JSON.stringify(staffDraft) });
      setStaffDraft({ name: '', title: '', specialty: '' });
      await load();
    } catch (err) {
      setError(parseApiError(err));
    } finally {
      setBusy(false);
    }
  }

  async function addService() {
    if (!serviceDraft.name.trim()) return;
    setBusy(true);
    try {
      await api('/appointments/services', {
        method: 'POST',
        body: JSON.stringify({
          name: serviceDraft.name,
          durationMin: Number(serviceDraft.durationMin),
          priceCents: serviceDraft.price ? Math.round(Number(serviceDraft.price) * 100) : null,
          currency: serviceDraft.currency,
        }),
      });
      setServiceDraft({ name: '', durationMin: '30', price: '', currency: 'IQD' });
      await load();
    } catch (err) {
      setError(parseApiError(err));
    } finally {
      setBusy(false);
    }
  }

  async function removeRow(path: string) {
    setBusy(true);
    try {
      await api(path, { method: 'DELETE' });
      await load();
    } catch (err) {
      setError(parseApiError(err));
    } finally {
      setBusy(false);
    }
  }

  async function uploadKnowledge(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.append('file', file);
      await apiUpload('/ai/knowledge/document', form);
      // Also expose the original file to the AI media catalog so it can send
      // the PDF/image itself when the conversation calls for it.
      const mediaForm = new FormData();
      mediaForm.append('file', file);
      mediaForm.append('title', file.name);
      mediaForm.append('productName', 'clinic_file');
      mediaForm.append('description', `ملف عيادة يمكن إرساله للعميل عند طلب معلومات مرتبطة بـ ${file.name}`);
      mediaForm.append('tags', 'clinic,knowledge,file');
      mediaForm.append('platform', 'WHATSAPP');
      mediaForm.append('isVoiceNote', 'false');
      await apiUpload('/ai/training-media', mediaForm);
      await load();
      setNotice('تم رفع الملف وفهرسته بنجاح');
    } catch (err) {
      setError(parseApiError(err));
    } finally {
      setBusy(false);
      event.target.value = '';
    }
  }

  async function uploadMedia(event: ChangeEvent<HTMLInputElement>, libraryType: 'LIBRARY' | 'PROFILE') {
    const file = event.target.files?.[0];
    if (!file || !voiceDraft.title.trim() || !voiceDraft.description.trim()) {
      setError('أدخل الاسم والوصف ثم اختر الملف الصوتي');
      event.target.value = '';
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const detectedDuration = await new Promise<number | null>((resolve) => {
        const audio = document.createElement('audio');
        const objectUrl = URL.createObjectURL(file);
        audio.preload = 'metadata';
        audio.onloadedmetadata = () => {
          const duration = Number.isFinite(audio.duration) ? Math.round(audio.duration) : null;
          URL.revokeObjectURL(objectUrl);
          resolve(duration);
        };
        audio.onerror = () => {
          URL.revokeObjectURL(objectUrl);
          resolve(null);
        };
        audio.src = objectUrl;
      });
      const form = new FormData();
      form.append('file', file);
      form.append('title', voiceDraft.title);
      form.append('description', voiceDraft.description);
      form.append('category', voiceDraft.category);
      form.append('language', voiceDraft.language);
      form.append('durationSeconds', voiceDraft.durationSeconds || String(detectedDuration ?? ''));
      form.append('platform', 'WHATSAPP');
      form.append('isVoiceNote', 'true');
      form.append('voiceLibraryType', libraryType);
      await apiUpload('/ai/training-media', form);
      setVoiceDraft({ title: '', description: '', category: 'general', language: 'ar', durationSeconds: '' });
      await load();
      setNotice(libraryType === 'PROFILE' ? 'تم حفظ التسجيل الأصلي في Voice Profiles' : 'تمت إضافة الرسالة الصوتية');
    } catch (err) {
      setError(parseApiError(err));
    } finally {
      setBusy(false);
      event.target.value = '';
    }
  }

  const schedule = useMemo(() => profile?.businessHours?.schedule ?? [], [profile?.businessHours]);
  function updateSchedule(day: number, patch: Partial<Hours> & { enabled?: boolean }) {
    if (!profile) return;
    const current = [...schedule];
    const index = current.findIndex((row) => row.day === day);
    if (patch.enabled === false) {
      if (index >= 0) current.splice(index, 1);
    } else if (index >= 0) {
      current[index] = { ...current[index], ...patch, day };
    } else {
      current.push({ day, open: patch.open ?? '09:00', close: patch.close ?? '17:00' });
    }
    setProfile({ ...profile, businessHours: { timezone: profile.timezone, schedule: current } });
  }

  function renderVoicePanel(type: 'LIBRARY' | 'PROFILE') {
    const rows = media.filter((item) => item.isVoiceNote && (item.voiceLibraryType ?? 'LIBRARY') === type);
    return (
      <SectionCard
        title={type === 'PROFILE' ? 'Voice Profiles' : 'Voice Library'}
        description={
          type === 'PROFILE'
            ? 'تسجيلات أصلية خاصة بالعيادة. لا يتم استنساخ الصوت أو توليد صوت جديد.'
            : 'يرسل الذكاء الاصطناعي التسجيل المناسب حسب وصف الاستخدام.'
        }
      >
        <div className="grid gap-3 md:grid-cols-2">
          <Input placeholder="اسم التسجيل" value={voiceDraft.title} onChange={(e) => setVoiceDraft({ ...voiceDraft, title: e.target.value })} />
          <Input placeholder="التصنيف: ترحيب، وصول، قبل العملية..." value={voiceDraft.category} onChange={(e) => setVoiceDraft({ ...voiceDraft, category: e.target.value })} />
          <Input placeholder="اللغة" value={voiceDraft.language} onChange={(e) => setVoiceDraft({ ...voiceDraft, language: e.target.value })} />
          <Input type="number" placeholder="المدة بالثواني" value={voiceDraft.durationSeconds} onChange={(e) => setVoiceDraft({ ...voiceDraft, durationSeconds: e.target.value })} />
        </div>
        <Textarea
          placeholder="متى يجب على الذكاء الاصطناعي إرسال هذا التسجيل؟"
          value={voiceDraft.description}
          onChange={(e) => setVoiceDraft({ ...voiceDraft, description: e.target.value })}
        />
        <Label className="inline-flex cursor-pointer items-center gap-2 rounded-md border px-4 py-2">
          <Upload className="h-4 w-4" />
          رفع MP3 / WAV / OGG / M4A
          <input className="hidden" type="file" accept=".mp3,.wav,.ogg,.m4a,audio/*" onChange={(e) => void uploadMedia(e, type)} />
        </Label>
        <div className="space-y-2">
          {rows.map((item) => (
            <div key={item.id} className="flex items-center justify-between gap-3 rounded-xl border p-3">
              <div className="min-w-0">
                <p className="font-medium">{item.title}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {item.category ?? 'general'} · {item.language ?? '—'} · {item.durationSeconds ?? '—'}s · {item.description}
                </p>
              </div>
              <Button size="icon" variant="ghost" onClick={() => void api(`/ai/training-media/${item.id}/delete`, { method: 'POST', body: '{}' }).then(load)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          {!rows.length ? <p className="text-sm text-muted-foreground">لا توجد تسجيلات بعد.</p> : null}
        </div>
      </SectionCard>
    );
  }

  if (!profile) {
    return <div className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> جاري تحميل مركز العيادة...</div>;
  }

  return (
    <div className="space-y-5">
      {notice ? <AlertBanner variant="success">{notice}</AlertBanner> : null}
      {error ? <AlertBanner variant="error">{error}</AlertBanner> : null}
      {busy ? <div className="fixed bottom-5 end-5 z-50 rounded-full bg-primary p-3 text-primary-foreground shadow-xl"><Loader2 className="h-5 w-5 animate-spin" /></div> : null}

      <Tabs defaultValue="general" dir="rtl">
        <TabsList className="h-auto w-full justify-start gap-1 overflow-x-auto rounded-xl bg-muted/60 p-2">
          <TabsTrigger value="general"><Settings2 className="me-1 h-4 w-4" />General</TabsTrigger>
          <TabsTrigger value="google"><CalendarDays className="me-1 h-4 w-4" />Google Calendar</TabsTrigger>
          <TabsTrigger value="knowledge"><Bot className="me-1 h-4 w-4" />AI Knowledge</TabsTrigger>
          <TabsTrigger value="doctors"><Stethoscope className="me-1 h-4 w-4" />Doctors</TabsTrigger>
          <TabsTrigger value="services">Services</TabsTrigger>
          <TabsTrigger value="hours"><Clock3 className="me-1 h-4 w-4" />Working Hours</TabsTrigger>
          <TabsTrigger value="voice"><Volume2 className="me-1 h-4 w-4" />Voice Library</TabsTrigger>
          <TabsTrigger value="profiles"><Mic2 className="me-1 h-4 w-4" />Voice Profiles</TabsTrigger>
          <TabsTrigger value="files"><FileText className="me-1 h-4 w-4" />Files</TabsTrigger>
          <TabsTrigger value="faq"><BookOpen className="me-1 h-4 w-4" />FAQ</TabsTrigger>
          <TabsTrigger value="rules">Appointment Rules</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="advanced">Advanced Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="general">
          <SectionCard title="الإعدادات العامة للعيادة" description="تُحفظ الأوقات كـ UTC وتُعرض حسب Clinic Timezone.">
            <form className="space-y-4" onSubmit={saveGeneral}>
              <label className="flex items-center gap-3"><input type="checkbox" name="enabled" defaultChecked={profile.enabled} /> تفعيل نظام المواعيد</label>
              <div className="grid gap-4 md:grid-cols-2">
                <div><Label>اسم العيادة</Label><Input name="orgName" defaultValue={profile.orgName ?? ''} /></div>
                <div><Label>Clinic Timezone</Label>
                  <select name="timezone" defaultValue={profile.timezone} className="flex h-10 w-full rounded-md border bg-background px-3 text-sm">
                    {TIMEZONES.map((zone) => <option key={zone}>{zone}</option>)}
                  </select>
                </div>
                <div><Label>رقم الاتصال</Label><Input name="phone" defaultValue={profile.phone ?? ''} /></div>
                <div><Label>البريد</Label><Input type="email" name="email" defaultValue={profile.email ?? ''} /></div>
              </div>
              <div><Label>العنوان</Label><Input name="address" defaultValue={profile.address ?? ''} /></div>
              <div><Label>نبذة</Label><Textarea name="description" defaultValue={profile.description ?? ''} /></div>
              <Button type="submit" disabled={busy}><Save className="me-2 h-4 w-4" />حفظ</Button>
            </form>
          </SectionCard>
        </TabsContent>

        <TabsContent value="google">
          <SectionCard title="Google Calendar" description="يتم إرسال timeZone صراحةً، ثم إعادة قراءة الحدث والتحقق من Start/End.">
            <div className="flex flex-wrap items-center gap-3">
              <Badge variant={google?.status === 'CONNECTED' ? 'success' : 'secondary'}>{google?.status ?? 'DISCONNECTED'}</Badge>
              <span>{google?.googleAccountEmail ?? ''}</span>
            </div>
            <div className="grid gap-3 rounded-xl border p-4 md:grid-cols-2">
              <p>Calendar: <strong>{google?.calendarSummary ?? google?.calendarId ?? '—'}</strong></p>
              <p>Google Timezone: <strong>{google?.calendarTimeZone ?? '—'}</strong></p>
              <p>Clinic Timezone: <strong>{profile.timezone}</strong></p>
              <p>Last Sync: <strong>{google?.lastSyncAt ? new Date(google.lastSyncAt).toLocaleString('ar-IQ', { timeZone: profile.timezone }) : '—'}</strong></p>
            </div>
            {google?.calendarTimeZone && google.calendarTimeZone !== profile.timezone ? (
              <AlertBanner variant="warning">Timezone تقويم Google مختلف عن Clinic Timezone. يتم إرسال توقيت العيادة صراحةً لكل حدث لمنع الانحراف.</AlertBanner>
            ) : null}
            {google?.failureReason ? <AlertBanner variant="error">{google.failureReason}</AlertBanner> : null}
            <div className="flex flex-wrap gap-2">
              {google?.status === 'CONNECTED' ? (
                <>
                  <Button onClick={() => void googleAction('sync')}>مزامنة الآن</Button>
                  <Button variant="outline" onClick={() => void connectGoogle(true)}>إعادة الربط</Button>
                  <Button variant="destructive" onClick={() => void googleAction('disconnect')}><Unplug className="me-2 h-4 w-4" />قطع الاتصال</Button>
                </>
              ) : <Button onClick={() => void connectGoogle()}>ربط Google Calendar</Button>}
            </div>
          </SectionCard>
        </TabsContent>

        <TabsContent value="knowledge">
          <SectionCard title="AI Knowledge" description="تدخل هذه المعلومات مباشرة في سياق ردود ذكاء العيادة.">
            <form className="space-y-4" onSubmit={saveKnowledge}>
              <div className="grid gap-4 md:grid-cols-2">
                <div><Label>اسم العيادة</Label><Input name="clinicName" defaultValue={profile.orgName ?? ''} /></div>
                <div><Label>العنوان</Label><Input name="address" defaultValue={profile.address ?? ''} /></div>
              </div>
              <div><Label>نبذة</Label><Textarea name="about" defaultValue={profile.description ?? ''} /></div>
              <div className="grid gap-4 md:grid-cols-2">
                {KNOWLEDGE_FIELDS.map(([key, label]) => (
                  <div key={key} className="space-y-1">
                    <Label>{label}</Label>
                    <Textarea name={key} rows={3} defaultValue={String(profile.clinicKnowledge?.[key] ?? '')} />
                  </div>
                ))}
              </div>
              <Button type="submit" disabled={busy}><Save className="me-2 h-4 w-4" />حفظ معرفة العيادة</Button>
            </form>
          </SectionCard>
        </TabsContent>

        <TabsContent value="doctors">
          <SectionCard title="الأطباء">
            <div className="grid gap-2 md:grid-cols-3">
              <Input placeholder="اسم الطبيب" value={staffDraft.name} onChange={(e) => setStaffDraft({ ...staffDraft, name: e.target.value })} />
              <Input placeholder="اللقب" value={staffDraft.title} onChange={(e) => setStaffDraft({ ...staffDraft, title: e.target.value })} />
              <Input placeholder="التخصص" value={staffDraft.specialty} onChange={(e) => setStaffDraft({ ...staffDraft, specialty: e.target.value })} />
            </div>
            <Button onClick={() => void addStaff()}><Plus className="me-2 h-4 w-4" />إضافة طبيب</Button>
            {profile.staff.map((row) => (
              <div key={row.id} className="flex items-center justify-between rounded-xl border p-3">
                <span>{row.name} {row.title ? `— ${row.title}` : ''} {row.specialty ? `· ${row.specialty}` : ''}</span>
                <Button size="icon" variant="ghost" onClick={() => void removeRow(`/appointments/staff/${row.id}`)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            ))}
          </SectionCard>
        </TabsContent>

        <TabsContent value="services">
          <SectionCard title="الخدمات والأسعار">
            <div className="grid gap-2 md:grid-cols-4">
              <Input placeholder="اسم الخدمة" value={serviceDraft.name} onChange={(e) => setServiceDraft({ ...serviceDraft, name: e.target.value })} />
              <Input type="number" placeholder="المدة" value={serviceDraft.durationMin} onChange={(e) => setServiceDraft({ ...serviceDraft, durationMin: e.target.value })} />
              <Input type="number" placeholder="السعر" value={serviceDraft.price} onChange={(e) => setServiceDraft({ ...serviceDraft, price: e.target.value })} />
              <Input placeholder="العملة" value={serviceDraft.currency} onChange={(e) => setServiceDraft({ ...serviceDraft, currency: e.target.value })} />
            </div>
            <Button onClick={() => void addService()}><Plus className="me-2 h-4 w-4" />إضافة خدمة</Button>
            {profile.services.map((row) => (
              <div key={row.id} className="flex items-center justify-between rounded-xl border p-3">
                <span>{row.name} · {row.durationMin} دقيقة {row.priceCents != null ? `· ${row.priceCents / 100} ${row.currency}` : ''}</span>
                <Button size="icon" variant="ghost" onClick={() => void removeRow(`/appointments/services/${row.id}`)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            ))}
          </SectionCard>
        </TabsContent>

        <TabsContent value="hours">
          <SectionCard title="أوقات الدوام" description={`التوقيت المعتمد: ${profile.timezone}`}>
            {DAYS.map((name, day) => {
              const row = schedule.find((item) => item.day === day);
              return (
                <div key={day} className="grid items-center gap-3 rounded-xl border p-3 sm:grid-cols-[1fr_auto_auto_auto]">
                  <Label>{name}</Label>
                  <Switch checked={Boolean(row)} onCheckedChange={(enabled) => updateSchedule(day, { enabled })} />
                  <Input type="time" value={row?.open ?? '09:00'} disabled={!row} onChange={(e) => updateSchedule(day, { open: e.target.value })} />
                  <Input type="time" value={row?.close ?? '17:00'} disabled={!row} onChange={(e) => updateSchedule(day, { close: e.target.value })} />
                </div>
              );
            })}
            <Button onClick={() => void patchProfile({ businessHours: { timezone: profile.timezone, schedule } })}><Save className="me-2 h-4 w-4" />حفظ الدوام</Button>
          </SectionCard>
        </TabsContent>

        <TabsContent value="voice">{renderVoicePanel('LIBRARY')}</TabsContent>
        <TabsContent value="profiles">{renderVoicePanel('PROFILE')}</TabsContent>

        <TabsContent value="files">
          <SectionCard title="مكتبة الملفات" description="PDF وDOCX وTXT والصور تُحفظ وتُفهرس ليستخدمها الذكاء الاصطناعي.">
            <Label className="inline-flex cursor-pointer items-center gap-2 rounded-md border px-4 py-2">
              <Upload className="h-4 w-4" />رفع ملف
              <input className="hidden" type="file" accept=".pdf,.docx,.txt,image/*" onChange={(e) => void uploadKnowledge(e)} />
            </Label>
            {documents.map((doc) => (
              <div key={doc.id} className="flex items-center justify-between gap-3 rounded-xl border p-3">
                <div><p className="font-medium">{doc.title}</p><p className="text-xs text-muted-foreground">{doc.mimeType} · {doc.status} · {doc._count?.chunks ?? 0} chunks</p></div>
                <Button size="icon" variant="ghost" onClick={() => void removeRow(`/ai/knowledge/${doc.id}`)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            ))}
          </SectionCard>
        </TabsContent>

        <TabsContent value="faq">
          <SectionCard title="الأسئلة الشائعة">
            {(profile.faqJson ?? []).map((item, index) => (
              <div key={index} className="grid gap-2 rounded-xl border p-3 md:grid-cols-2">
                <Input value={item.q ?? ''} placeholder="السؤال" onChange={(e) => {
                  const faq = [...(profile.faqJson ?? [])]; faq[index] = { ...faq[index], q: e.target.value }; setProfile({ ...profile, faqJson: faq });
                }} />
                <Input value={item.a ?? ''} placeholder="الجواب" onChange={(e) => {
                  const faq = [...(profile.faqJson ?? [])]; faq[index] = { ...faq[index], a: e.target.value }; setProfile({ ...profile, faqJson: faq });
                }} />
              </div>
            ))}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setProfile({ ...profile, faqJson: [...(profile.faqJson ?? []), { q: '', a: '' }] })}><Plus className="me-2 h-4 w-4" />إضافة سؤال</Button>
              <Button onClick={() => void patchProfile({ faqJson: profile.faqJson ?? [] })}>حفظ FAQ</Button>
            </div>
          </SectionCard>
        </TabsContent>

        <TabsContent value="rules">
          <SectionCard title="قواعد المواعيد">
            <div className="grid gap-4 md:grid-cols-3">
              {([
                ['defaultDurationMin', 'مدة الموعد الافتراضية'],
                ['bookingWindowDays', 'نافذة الحجز بالأيام'],
                ['maxDailyAppointments', 'الحد اليومي'],
                ['bufferBeforeMin', 'فاصل قبل الموعد'],
                ['bufferAfterMin', 'فاصل بعد الموعد'],
                ['breakMin', 'مدة الاستراحة'],
              ] as const).map(([key, label]) => (
                <div key={key}><Label>{label}</Label><Input type="number" value={profile[key] ?? ''} onChange={(e) => setProfile({ ...profile, [key]: e.target.value ? Number(e.target.value) : null })} /></div>
              ))}
            </div>
            <div><Label>تعليمات وسياسات الحجز</Label><Textarea value={profile.instructions ?? ''} onChange={(e) => setProfile({ ...profile, instructions: e.target.value })} /></div>
            <Button onClick={() => void patchProfile({
              defaultDurationMin: profile.defaultDurationMin,
              bookingWindowDays: profile.bookingWindowDays,
              maxDailyAppointments: profile.maxDailyAppointments,
              bufferBeforeMin: profile.bufferBeforeMin,
              bufferAfterMin: profile.bufferAfterMin,
              breakMin: profile.breakMin,
              instructions: profile.instructions,
            })}>حفظ القواعد</Button>
          </SectionCard>
        </TabsContent>

        <TabsContent value="notifications">
          <SectionCard title="الإشعارات والتذكيرات">
            <div className="flex items-center justify-between rounded-xl border p-4">
              <div><p className="font-medium">تذكيرات المواعيد</p><p className="text-sm text-muted-foreground">السماح للذكاء الاصطناعي بإرسال التذكيرات المجدولة.</p></div>
              <Switch checked={profile.aiCanSendReminders} onCheckedChange={(value) => setProfile({ ...profile, aiCanSendReminders: value })} />
            </div>
            <Button onClick={() => void patchProfile({ aiCanSendReminders: profile.aiCanSendReminders })}>حفظ الإشعارات</Button>
          </SectionCard>
        </TabsContent>

        <TabsContent value="advanced">
          <SectionCard title="إعدادات الذكاء الاصطناعي المتقدمة">
            {([
              ['aiCanReply', 'الرد على العملاء'],
              ['aiCanCreate', 'إنشاء موعد'],
              ['aiCanUpdate', 'تعديل موعد'],
              ['aiCanCancel', 'إلغاء موعد'],
              ['aiCanReadCalendar', 'قراءة Google Calendar'],
            ] as const).map(([key, label]) => (
              <div key={key} className="flex items-center justify-between rounded-xl border p-4">
                <Label>{label}</Label>
                <Switch checked={profile[key]} onCheckedChange={(value) => setProfile({ ...profile, [key]: value })} />
              </div>
            ))}
            <AlertBanner variant="info">الملفات والصور والتسجيلات الأصلية تظهر للذكاء الاصطناعي ككتالوج، ويختار Text أو Image أو PDF أو Voice حسب سياق الرسالة.</AlertBanner>
            <Button onClick={() => void patchProfile({
              aiCanReply: profile.aiCanReply,
              aiCanCreate: profile.aiCanCreate,
              aiCanUpdate: profile.aiCanUpdate,
              aiCanCancel: profile.aiCanCancel,
              aiCanReadCalendar: profile.aiCanReadCalendar,
            })}>حفظ الإعدادات المتقدمة</Button>
          </SectionCard>
        </TabsContent>
      </Tabs>
    </div>
  );
}
