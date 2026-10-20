'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  createAdminAssistantArticle,
  deleteAdminAssistantArticle,
  fetchAdminAssistantArticles,
  fetchAdminAssistantSettings,
  fetchAdminAssistantStats,
  updateAdminAssistantArticle,
  updateAdminAssistantSettings,
  type AdminAssistantArticle,
  type AdminAssistantSettings,
} from '@/lib/admin-api';

export default function AdminAssistantPage() {
  const [settings, setSettings] = useState<AdminAssistantSettings | null>(null);
  const [articles, setArticles] = useState<AdminAssistantArticle[]>([]);
  const [stats, setStats] = useState<{ conversations: number; messages: number; unanswered: number; downvotes: number; topQuestions: Array<{ question: string; count: number }> } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newSlug, setNewSlug] = useState('');
  const [newTitleAr, setNewTitleAr] = useState('');
  const [newTitleEn, setNewTitleEn] = useState('');
  const [newBodyAr, setNewBodyAr] = useState('');
  const [newBodyEn, setNewBodyEn] = useState('');

  const load = useCallback(async () => {
    setError(null);
    try {
      const [s, a, st] = await Promise.all([
        fetchAdminAssistantSettings(),
        fetchAdminAssistantArticles(),
        fetchAdminAssistantStats(),
      ]);
      setSettings(s);
      setArticles(a);
      setStats(st);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveSettings() {
    if (!settings) return;
    setBusy(true);
    try {
      const next = await updateAdminAssistantSettings(settings);
      setSettings(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  }

  async function addArticle() {
    if (!newSlug.trim() || !newTitleAr.trim() || !newTitleEn.trim()) return;
    setBusy(true);
    try {
      await createAdminAssistantArticle({
        slug: newSlug,
        category: 'other',
        titleAr: newTitleAr,
        titleEn: newTitleEn,
        bodyAr: newBodyAr,
        bodyEn: newBodyEn,
        keywords: [],
      });
      setNewSlug('');
      setNewTitleAr('');
      setNewTitleEn('');
      setNewBodyAr('');
      setNewBodyEn('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Create failed');
    } finally {
      setBusy(false);
    }
  }

  if (!settings) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader title="AI Assistant" description="Control Chatloora in-app assistant, knowledge base, and WhatsApp support." />
      {error && <p className="text-sm text-destructive">{error}</p>}

      {stats && (
        <div className="grid gap-3 sm:grid-cols-4">
          <div className="rounded-xl border p-4"><p className="text-xs text-muted-foreground">Conversations</p><p className="text-2xl font-semibold">{stats.conversations}</p></div>
          <div className="rounded-xl border p-4"><p className="text-xs text-muted-foreground">Messages</p><p className="text-2xl font-semibold">{stats.messages}</p></div>
          <div className="rounded-xl border p-4"><p className="text-xs text-muted-foreground">Unanswered</p><p className="text-2xl font-semibold">{stats.unanswered}</p></div>
          <div className="rounded-xl border p-4"><p className="text-xs text-muted-foreground">Downvotes</p><p className="text-2xl font-semibold">{stats.downvotes}</p></div>
        </div>
      )}

      <section className="space-y-4 rounded-xl border p-4">
        <h2 className="font-semibold">Settings</h2>
        <div className="flex items-center gap-2">
          <Switch checked={settings.enabled} onCheckedChange={(enabled) => setSettings({ ...settings, enabled })} />
          <Label>Enabled</Label>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1"><Label>Model</Label><Input value={settings.model} onChange={(e) => setSettings({ ...settings, model: e.target.value })} /></div>
          <div className="space-y-1"><Label>Daily message limit</Label><Input type="number" min={1} value={settings.dailyLimit} onChange={(e) => setSettings({ ...settings, dailyLimit: Number(e.target.value) })} /></div>
          <div className="space-y-1"><Label>Support phone</Label><Input value={settings.supportPhone} onChange={(e) => setSettings({ ...settings, supportPhone: e.target.value })} /></div>
          <div className="space-y-1"><Label>WhatsApp (international)</Label><Input value={settings.supportWhatsApp} onChange={(e) => setSettings({ ...settings, supportWhatsApp: e.target.value })} /></div>
          <div className="space-y-1"><Label>Welcome AR</Label><Input value={settings.welcomeAr} onChange={(e) => setSettings({ ...settings, welcomeAr: e.target.value })} /></div>
          <div className="space-y-1"><Label>Welcome EN</Label><Input value={settings.welcomeEn} onChange={(e) => setSettings({ ...settings, welcomeEn: e.target.value })} /></div>
        </div>
        <div className="space-y-1">
          <Label>System prompt</Label>
          <Textarea rows={8} value={settings.systemPrompt} onChange={(e) => setSettings({ ...settings, systemPrompt: e.target.value })} />
        </div>
        <Button onClick={() => void saveSettings()} disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save settings'}</Button>
      </section>

      <section className="space-y-4 rounded-xl border p-4">
        <h2 className="font-semibold">Knowledge base</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          <Input placeholder="slug" value={newSlug} onChange={(e) => setNewSlug(e.target.value)} />
          <Input placeholder="Title AR" value={newTitleAr} onChange={(e) => setNewTitleAr(e.target.value)} />
          <Input placeholder="Title EN" value={newTitleEn} onChange={(e) => setNewTitleEn(e.target.value)} />
          <div />
          <Textarea placeholder="Body AR" value={newBodyAr} onChange={(e) => setNewBodyAr(e.target.value)} />
          <Textarea placeholder="Body EN" value={newBodyEn} onChange={(e) => setNewBodyEn(e.target.value)} />
        </div>
        <Button variant="outline" onClick={() => void addArticle()} disabled={busy}>Add article</Button>
        <div className="space-y-3">
          {articles.map((article) => (
            <div key={article.id} className="rounded-lg border p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="font-medium">{article.titleAr} / {article.titleEn}</p>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={article.isActive}
                    onCheckedChange={(isActive) => {
                      void updateAdminAssistantArticle(article.id, { isActive }).then(() => load());
                    }}
                  />
                  <Button variant="destructive" size="sm" onClick={() => void deleteAdminAssistantArticle(article.id).then(() => load())}>Delete</Button>
                </div>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{article.slug} · {article.category}</p>
            </div>
          ))}
        </div>
      </section>

      {stats?.topQuestions?.length ? (
        <section className="rounded-xl border p-4">
          <h2 className="mb-3 font-semibold">Top questions</h2>
          <ul className="space-y-1 text-sm">
            {stats.topQuestions.map((row) => (
              <li key={row.question} className="flex justify-between gap-4">
                <span>{row.question}</span>
                <span className="text-muted-foreground">{row.count}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
