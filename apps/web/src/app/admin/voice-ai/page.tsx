'use client';

import { useCallback, useEffect, useState } from 'react';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  addAdminVoiceNumber,
  fetchAdminVoiceAgent,
  fetchAdminVoiceCalls,
  fetchAdminVoiceSettings,
  fetchAdminVoiceStats,
  updateAdminVoiceAgent,
  updateAdminVoiceSettings,
  type AdminVoiceAgent,
  type AdminVoiceCall,
  type AdminVoiceSettings,
  type AdminVoiceStats,
} from '@/lib/admin-api';

export default function AdminVoiceAiPage() {
  const [settings, setSettings] = useState<AdminVoiceSettings | null>(null);
  const [agent, setAgent] = useState<AdminVoiceAgent | null>(null);
  const [stats, setStats] = useState<AdminVoiceStats | null>(null);
  const [calls, setCalls] = useState<AdminVoiceCall[]>([]);
  const [e164, setE164] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [s, a, st, c] = await Promise.all([
        fetchAdminVoiceSettings(),
        fetchAdminVoiceAgent(),
        fetchAdminVoiceStats(),
        fetchAdminVoiceCalls(),
      ]);
      setSettings(s);
      setAgent(a);
      setStats(st);
      setCalls(c);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function save() {
    if (!settings || !agent) return;
    setBusy(true);
    try {
      setSettings(await updateAdminVoiceSettings(settings));
      setAgent(await updateAdminVoiceAgent(agent));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  }

  async function addNumber() {
    if (!e164.trim()) return;
    setBusy(true);
    try {
      await addAdminVoiceNumber(e164.trim());
      setE164('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Voice AI" description="In-app realtime Voice-to-Voice plus Twilio phone calls, both using Chatloora assistant knowledge." />
      {error && <p className="text-sm text-destructive">{error}</p>}
      {stats && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Total calls" value={stats.totalCalls ?? stats.total} />
          <Stat label="Phone today" value={stats.today} />
          <Stat label="Phone month" value={stats.month} />
          <Stat label="Avg duration (s)" value={stats.averageDurationSec} />
          <Stat label="AI handled" value={stats.aiHandled} />
          <Stat label="Human handoff" value={stats.handedOff + (stats.inAppHandoff ?? 0)} />
          <Stat label="Failed" value={stats.failed + (stats.inAppFailed ?? 0)} />
          <Stat label="In-app minutes" value={stats.inAppMinutes ?? 0} />
        </div>
      )}
      {settings && (
        <section className="space-y-3 rounded-xl border p-4">
          <h2 className="text-sm font-semibold">Platform</h2>
          <div className="flex items-center justify-between">
            <Label>Enable Voice AI</Label>
            <Switch checked={settings.enabled} onCheckedChange={(enabled) => setSettings({ ...settings, enabled })} />
          </div>
          <div className="flex items-center justify-between">
            <Label>Human handoff dial</Label>
            <Switch
              checked={settings.humanHandoffEnabled}
              onCheckedChange={(humanHandoffEnabled) => setSettings({ ...settings, humanHandoffEnabled })}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Handoff number</Label>
              <Input value={settings.humanHandoffNumber} onChange={(e) => setSettings({ ...settings, humanHandoffNumber: e.target.value })} />
            </div>
            <div>
              <Label>Phone provider</Label>
              <Input value={settings.provider} disabled />
            </div>
          </div>
        </section>
      )}
      {settings && (
        <section className="space-y-3 rounded-xl border p-4">
          <h2 className="text-sm font-semibold">In-app Realtime Voice</h2>
          <div className="flex items-center justify-between">
            <Label>Enable in-app Voice-to-Voice</Label>
            <Switch
              checked={settings.inAppRealtimeEnabled !== false}
              onCheckedChange={(inAppRealtimeEnabled) => setSettings({ ...settings, inAppRealtimeEnabled })}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label>Transcript</Label>
            <Switch
              checked={settings.inAppTranscriptEnabled !== false}
              onCheckedChange={(inAppTranscriptEnabled) => setSettings({ ...settings, inAppTranscriptEnabled })}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label>Recording (keep off)</Label>
            <Switch
              checked={settings.inAppRecordingEnabled === true}
              onCheckedChange={(inAppRecordingEnabled) => setSettings({ ...settings, inAppRecordingEnabled })}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Realtime provider</Label>
              <Input value={settings.realtimeProvider || 'openai'} disabled />
            </div>
            <div>
              <Label>Model</Label>
              <Input
                value={settings.realtimeModel || 'gpt-realtime-2.1'}
                onChange={(e) => setSettings({ ...settings, realtimeModel: e.target.value })}
              />
            </div>
            <div>
              <Label>Male voice</Label>
              <Input value={settings.maleVoice || 'cedar'} onChange={(e) => setSettings({ ...settings, maleVoice: e.target.value })} />
            </div>
            <div>
              <Label>Female voice</Label>
              <Input value={settings.femaleVoice || 'marin'} onChange={(e) => setSettings({ ...settings, femaleVoice: e.target.value })} />
            </div>
            <div>
              <Label>Languages</Label>
              <Input value={settings.languages || 'ar,en'} onChange={(e) => setSettings({ ...settings, languages: e.target.value })} />
            </div>
            <div>
              <Label>Max call duration (sec)</Label>
              <Input
                type="number"
                value={settings.maxInAppCallSec || 600}
                onChange={(e) => setSettings({ ...settings, maxInAppCallSec: Number(e.target.value) })}
              />
            </div>
          </div>
        </section>
      )}
      {agent && (
        <section className="space-y-3 rounded-xl border p-4">
          <h2 className="text-sm font-semibold">Platform agent</h2>
          <div className="flex items-center justify-between">
            <Label>Agent enabled</Label>
            <Switch checked={agent.enabled} onCheckedChange={(enabled) => setAgent({ ...agent, enabled })} />
          </div>
          <div className="flex items-center justify-between">
            <Label>Recording (off by default)</Label>
            <Switch checked={agent.recordingEnabled} onCheckedChange={(recordingEnabled) => setAgent({ ...agent, recordingEnabled })} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Name</Label>
              <Input value={agent.name} onChange={(e) => setAgent({ ...agent, name: e.target.value })} />
            </div>
            <div>
              <Label>Voice</Label>
              <Input value={agent.voiceName} onChange={(e) => setAgent({ ...agent, voiceName: e.target.value })} />
            </div>
            <div>
              <Label>Language</Label>
              <Input value={agent.language} onChange={(e) => setAgent({ ...agent, language: e.target.value })} />
            </div>
            <div>
              <Label>Max duration (sec)</Label>
              <Input
                type="number"
                value={agent.maxDurationSec}
                onChange={(e) => setAgent({ ...agent, maxDurationSec: Number(e.target.value) })}
              />
            </div>
          </div>
          <div>
            <Label>Greeting</Label>
            <Textarea value={agent.greeting} onChange={(e) => setAgent({ ...agent, greeting: e.target.value })} />
          </div>
          <div>
            <Label>Unclear</Label>
            <Input value={agent.unclearMessage} onChange={(e) => setAgent({ ...agent, unclearMessage: e.target.value })} />
          </div>
          <div>
            <Label>Handoff message</Label>
            <Input value={agent.handoffMessage} onChange={(e) => setAgent({ ...agent, handoffMessage: e.target.value })} />
          </div>
          <div className="flex gap-2">
            <Input placeholder="+9647..." value={e164} onChange={(e) => setE164(e.target.value)} />
            <Button type="button" variant="outline" onClick={() => void addNumber()} disabled={busy}>
              Bind number
            </Button>
          </div>
          <div className="text-xs text-muted-foreground">
            Numbers: {(agent.phoneNumbers ?? []).map((n) => n.e164).join(', ') || 'none'}
          </div>
          <Button onClick={() => void save()} disabled={busy}>
            Save
          </Button>
        </section>
      )}
      <section className="space-y-2 rounded-xl border p-4">
        <h2 className="text-sm font-semibold">Recent calls</h2>
        <div className="space-y-2 text-sm">
          {calls.length === 0 && <p className="text-muted-foreground">No calls yet.</p>}
          {calls.map((call) => (
            <div key={call.id} className="rounded-lg border px-3 py-2">
              <div className="flex justify-between gap-2">
                <span>
                  {call.callerE164} → {call.calledE164}
                </span>
                <span className="text-muted-foreground">
                  {call.status} · {call.handledBy}
                </span>
              </div>
              {call.summary && <p className="mt-1 text-xs text-muted-foreground">{call.summary}</p>}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-xl font-semibold">{value}</p>
    </div>
  );
}
