'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import {
  Clapperboard,
  Film,
  ImageIcon,
  Mic2,
  Music2,
  Palette,
  Scissors,
  Sparkles,
  Upload,
  Wand2,
} from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { PlanGate } from '@/components/billing/plan-gate';
import { useTranslation } from '@/components/providers/locale-provider';
import { PageHeader } from '@/components/shared/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { api, apiUpload, fetchAuthedBlobUrl } from '@/lib/utils';

type Project = {
  id: string;
  name: string;
  status: string;
  aspectRatio?: string | null;
  productProfile?: Record<string, unknown> | null;
  assets?: Array<{ id: string; fileName?: string }>;
  briefs?: Array<Record<string, unknown>>;
  concepts?: Array<{ id: string; title: string; selected: boolean; payload: Record<string, unknown> }>;
  jobs?: Array<{
    id: string;
    type: string;
    status: string;
    errorCode?: string | null;
    errorMessage?: string | null;
    provider?: string;
    model?: string;
    assets?: Array<{ id: string; mimeType: string; resolutionType?: string | null; metadata?: { isNative4k?: boolean } }>;
    usageRecords?: Array<{ estimatedCost?: number | null; actualCost?: number | null; costStatus?: string }>;
  }>;
  scenes?: Array<{ id: string; order: number; durationSec: number; role?: string | null; script?: string | null; environment?: string | null }>;
  versions?: Array<{ id: string; version: number; isCurrent: boolean; label?: string | null }>;
};

type StudioStatus = {
  geminiConfigured?: boolean;
  openaiConfigured?: boolean;
  openrouterConfigured?: boolean;
  imageGenerationEnabled?: boolean;
  videoGenerationEnabled?: boolean;
  defaultMediaProvider?: string;
};

const STEPS = ['upload', 'intelligence', 'brief', 'concepts', 'scenes', 'generate', 'result'] as const;

function statusBadge(status: string, t: (k: string) => string) {
  if (status === 'SUCCEEDED') return <Badge>{t('creative.completed')}</Badge>;
  if (status === 'FAILED' || status === 'CANCELLED') return <Badge variant="destructive">{t('creative.failed')}</Badge>;
  if (['QUEUED', 'RUNNING', 'PROVIDER_SUBMITTED', 'POLLING', 'DOWNLOADING', 'STORING', 'QUALITY_CHECK'].includes(status)) {
    return <Badge variant="secondary">{t('creative.generating')} — {status}</Badge>;
  }
  return <Badge variant="outline">{status}</Badge>;
}

export default function CreativeStudioPage() {
  const { t } = useTranslation();
  const [projects, setProjects] = useState<Project[]>([]);
  const [project, setProject] = useState<Project | null>(null);
  const [step, setStep] = useState(0);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [editText, setEditText] = useState('');
  const [editParsed, setEditParsed] = useState<Record<string, unknown> | null>(null);
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [directorCmd, setDirectorCmd] = useState('');
  const [advanced, setAdvanced] = useState(false);
  const [studioStatus, setStudioStatus] = useState<StudioStatus | null>(null);

  const loadList = useCallback(async () => {
    setProjects(await api<Project[]>('/creative/projects'));
  }, []);

  useEffect(() => {
    api<StudioStatus>('/creative/status')
      .then(setStudioStatus)
      .catch(() => setStudioStatus(null));
  }, []);

  async function loadProject(id: string) {
    const row = await api<Project>(`/creative/projects/${id}`);
    setProject(row);
    const map: Record<string, string> = {};
    for (const asset of row.assets || []) {
      map[asset.id] = await fetchAuthedBlobUrl(`/creative/assets/${asset.id}/file`);
    }
    for (const job of row.jobs || []) {
      for (const asset of job.assets || []) {
        map[asset.id] = await fetchAuthedBlobUrl(`/creative/generated/${asset.id}/file`);
      }
    }
    setPreviews(map);
    return row;
  }

  useEffect(() => {
    loadList().catch((err) => setError(String(err.message || err)));
  }, [loadList]);

  useEffect(() => {
    const job = project?.jobs?.[0];
    if (!job || !['QUEUED', 'RUNNING', 'PROVIDER_SUBMITTED', 'POLLING', 'DOWNLOADING', 'STORING', 'QUALITY_CHECK'].includes(job.status)) {
      return;
    }
    const timer = setInterval(() => {
      loadProject(project.id).catch(() => undefined);
    }, 2500);
    return () => clearInterval(timer);
  }, [project?.id, project?.jobs?.[0]?.status]);

  async function wrap(fn: () => Promise<void>) {
    setBusy(true);
    setError('');
    try {
      await fn();
    } catch (err) {
      setError(String((err as Error).message || err));
    } finally {
      setBusy(false);
    }
  }

  async function createProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await wrap(async () => {
      const created = await api<Project>('/creative/projects', {
        method: 'POST',
        body: JSON.stringify({ name: form.get('name'), aspectRatio: form.get('aspectRatio') || '1:1' }),
      });
      await loadList();
      await loadProject(created.id);
      setStep(0);
    });
  }

  async function saveProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!project) return;
    const form = new FormData(event.currentTarget);
    await wrap(async () => {
      await api(`/creative/projects/${project.id}/product`, {
        method: 'PUT',
        body: JSON.stringify({
          name: form.get('name'),
          description: form.get('description'),
          category: form.get('category'),
          brand: form.get('brand'),
          userClaims: form.get('userClaims'),
          targetAudience: form.get('targetAudience'),
        }),
      });
      const file = form.get('file');
      if (file instanceof File && file.size) {
        const fd = new FormData();
        fd.append('file', file);
        await apiUpload(`/creative/projects/${project.id}/assets`, fd);
      }
      await loadProject(project.id);
    });
  }

  async function analyze() {
    if (!project) return;
    await wrap(async () => {
      await api(`/creative/projects/${project.id}/analyze`, { method: 'POST', body: '{}' });
      await loadProject(project.id);
      setStep(1);
    });
  }

  async function brief() {
    if (!project) return;
    await wrap(async () => {
      await api(`/creative/projects/${project.id}/brief`, { method: 'POST', body: JSON.stringify({ platform: 'instagram' }) });
      await loadProject(project.id);
      setStep(2);
    });
  }

  async function concepts() {
    if (!project) return;
    await wrap(async () => {
      await api(`/creative/projects/${project.id}/concepts`, { method: 'POST', body: '{}' });
      await loadProject(project.id);
      setStep(3);
    });
  }

  async function selectConcept(id: string) {
    if (!project) return;
    await wrap(async () => {
      await api(`/creative/projects/${project.id}/concepts/select`, { method: 'POST', body: JSON.stringify({ conceptId: id }) });
      await loadProject(project.id);
    });
  }

  async function generate(type: 'IMAGE' | 'VIDEO' | 'EDIT' | 'TTS' | 'COMPOSE' | 'LIPSYNC' | 'UPSCALE', extra: Record<string, unknown> = {}) {
    if (!project) return;
    await wrap(async () => {
      await api('/creative/jobs', {
        method: 'POST',
        body: JSON.stringify({
          projectId: project.id,
          type,
          provider: type === 'COMPOSE' ? 'ffmpeg' : type === 'TTS' ? undefined : 'gemini',
          aspectRatio: project.aspectRatio || '1:1',
          ...extra,
        }),
      });
      await loadProject(project.id);
      setStep(4);
    });
  }

  const intel = (project?.productProfile?.intelligence || {}) as Record<string, unknown>;
  const latestJob = project?.jobs?.[0];

  return (
    <AppShell>
      <PlanGate feature="creative_studio">
        <PageHeader title={t('creative.title')} description={t('creative.description')} />
        {error && <p className="mt-4 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm">{error}</p>}
        {studioStatus && (
          <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
            <Badge variant={studioStatus.geminiConfigured ? 'default' : 'destructive'}>
              Gemini {studioStatus.geminiConfigured ? 'جاهز' : 'غير مربوط'}
            </Badge>
            <Badge variant={studioStatus.imageGenerationEnabled ? 'secondary' : 'outline'}>صور</Badge>
            <Badge variant={studioStatus.videoGenerationEnabled ? 'secondary' : 'outline'}>فيديو</Badge>
            <span className="text-muted-foreground">
              المزود الافتراضي: {studioStatus.defaultMediaProvider || '—'}
            </span>
          </div>
        )}
        <div className="mt-6 grid gap-6 lg:grid-cols-[280px_1fr]">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('creative.newProject')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <form className="space-y-3" onSubmit={createProject}>
                <Input name="name" required placeholder={t('creative.title')} />
                <Input name="aspectRatio" placeholder="1:1 / 9:16 / 16:9" />
                <Button type="submit" disabled={busy} className="w-full">{t('creative.newProject')}</Button>
              </form>
              <div className="space-y-2">
                {projects.map((row) => (
                  <button
                    key={row.id}
                    type="button"
                    className="block w-full rounded-md border p-2 text-start text-sm hover:bg-muted"
                    onClick={() => loadProject(row.id).then(() => setStep(0))}
                  >
                    {row.name}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {project && (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                {STEPS.map((key, index) => (
                  <button key={key} type="button" className={index === step ? 'font-semibold text-foreground' : ''} onClick={() => setStep(index)}>
                    {index + 1}. {key}
                  </button>
                ))}
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>{project.name}</CardTitle>
                  <CardDescription>{t('creative.ttsSoon')}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <form className="grid gap-3 sm:grid-cols-2" onSubmit={saveProduct}>
                    <div className="sm:col-span-2"><Label>{t('creative.upload')}</Label><Input name="file" type="file" accept="image/jpeg,image/png,image/webp" /></div>
                    <Input name="name" defaultValue={String(project.productProfile?.name || project.name)} required />
                    <Input name="brand" defaultValue={String(project.productProfile?.brand || '')} placeholder="Brand" />
                    <Input name="category" defaultValue={String(project.productProfile?.category || '')} placeholder="Category" />
                    <Input name="targetAudience" defaultValue={String(project.productProfile?.targetAudience || '')} placeholder="Audience" />
                    <Textarea name="description" className="sm:col-span-2" defaultValue={String(project.productProfile?.description || '')} />
                    <Textarea name="userClaims" className="sm:col-span-2" defaultValue={String(project.productProfile?.userClaims || '')} placeholder="User-provided claims only" />
                    <Button type="submit" disabled={busy}><Upload className="me-2 h-4 w-4" />{t('common.save')}</Button>
                  </form>
                  <div className="flex flex-wrap gap-2">
                    {(project.assets || []).map((asset) => (
                      previews[asset.id] ? <img key={asset.id} src={previews[asset.id]} alt="" className="h-20 w-20 rounded object-cover" /> : null
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button disabled={busy} onClick={analyze}>{t('creative.analyze')}</Button>
                    <Button disabled={busy} variant="secondary" onClick={brief}>{t('creative.brief')}</Button>
                    <Button disabled={busy} variant="secondary" onClick={concepts}>{t('creative.concepts')}</Button>
                    <Button disabled={busy} onClick={() => generate('IMAGE')}><Sparkles className="me-2 h-4 w-4" />{t('creative.generate')}</Button>
                    <Button disabled={busy} variant="outline" onClick={() => generate('VIDEO')}>{t('creative.video')}</Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">مكتبة أدوات الاستوديو</CardTitle>
                  <CardDescription>
                    أدوات احترافية لتوليد الصور والفيديو عبر Gemini — من الفكرة حتى التصدير
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {[
                    { icon: ImageIcon, title: 'توليد صورة', desc: 'Imagen / Gemini Image', action: () => generate('IMAGE'), enabled: true },
                    { icon: Film, title: 'توليد فيديو', desc: 'Veo عبر Gemini', action: () => generate('VIDEO'), enabled: true },
                    { icon: Wand2, title: 'تعديل ذكي', desc: 'تعديل بإيعاز نصي', action: () => generate('EDIT', { instruction: editText || 'حسّن الإضاءة مع الحفاظ على المنتج' }), enabled: true },
                    { icon: Clapperboard, title: 'مشاهد Timeline', desc: 'بناء مشاهد الإعلان', action: () => setStep(4), enabled: true },
                    { icon: Mic2, title: 'تعليق صوتي', desc: 'TTS (فصحى)', action: () => generate('TTS', { script: project.scenes?.[0]?.script || editText || project.name, dialect: 'msa' }), enabled: true },
                    { icon: Scissors, title: 'تركيب نهائي', desc: 'Compose بالـ FFmpeg', action: () => generate('COMPOSE'), enabled: Boolean(project.scenes?.length) },
                    { icon: Music2, title: 'موسيقى مرخّصة', desc: 'رفع مقطع للاستخدام', action: null, enabled: true },
                    { icon: Palette, title: 'المخرج الإبداعي', desc: 'أوامر إخراج كاملة', action: () => setStep(5), enabled: true },
                  ].map((tool) => (
                    <div key={tool.title} className="rounded-lg border p-3">
                      <div className="mb-2 flex items-center gap-2 font-medium">
                        <tool.icon className="h-4 w-4" />
                        {tool.title}
                      </div>
                      <p className="mb-3 text-xs text-muted-foreground">{tool.desc}</p>
                      {tool.title === 'موسيقى مرخّصة' ? (
                        <label className="inline-flex cursor-pointer items-center gap-2 text-xs">
                          <Input
                            type="file"
                            accept="audio/mpeg,audio/wav,audio/mp4,audio/*"
                            className="max-w-[220px] text-xs"
                            disabled={busy}
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              void wrap(async () => {
                                const fd = new FormData();
                                fd.append('file', file);
                                fd.append('name', file.name);
                                fd.append('licenseConfirmed', 'true');
                                fd.append('licenseNote', 'user-uploaded');
                                await apiUpload(`/creative/projects/${project.id}/music`, fd);
                              });
                            }}
                          />
                        </label>
                      ) : (
                        <Button size="sm" variant="secondary" disabled={busy || !tool.enabled} onClick={() => tool.action?.()}>
                          تشغيل
                        </Button>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>

              {intel && Object.keys(intel).length > 0 && (
                <Card>
                  <CardHeader><CardTitle>Product Intelligence</CardTitle></CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <p><strong>Confidence:</strong> {String(intel.overallConfidence || '')}</p>
                    <pre className="max-h-64 overflow-auto rounded bg-muted p-3 text-xs">{JSON.stringify(intel, null, 2)}</pre>
                  </CardContent>
                </Card>
              )}

              {(project.concepts || []).length > 0 && (
                <div className="grid gap-3 md:grid-cols-2">
                  {project.concepts!.map((concept) => (
                    <Card key={concept.id} className={concept.selected ? 'border-primary' : ''}>
                      <CardHeader>
                        <CardTitle className="text-base">{concept.title}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-muted-foreground">{String(concept.payload.description || '')}</p>
                        <Button className="mt-3" size="sm" onClick={() => selectConcept(concept.id)}>Select</Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              {latestJob && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Palette className="h-4 w-4" />
                      {latestJob.type} {statusBadge(latestJob.status, t)}
                    </CardTitle>
                    <CardDescription>
                      {latestJob.provider} {latestJob.model} {latestJob.errorCode ? `— ${latestJob.errorCode}` : ''}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {latestJob.errorMessage && <p className="text-sm text-destructive">{latestJob.errorMessage}</p>}
                    <div className="flex flex-wrap gap-3">
                      {(latestJob.assets || []).map((asset) => (
                        <div key={asset.id}>
                          {previews[asset.id] && asset.mimeType.startsWith('image/') && (
                            <img src={previews[asset.id]} alt="" className="max-h-80 rounded border" />
                          )}
                          {previews[asset.id] && asset.mimeType.startsWith('video/') && (
                            <video src={previews[asset.id]} controls className="max-h-80 rounded border" />
                          )}
                          <p className="mt-1 text-xs text-muted-foreground">
                            {asset.metadata?.isNative4k ? 'Native 4K' : asset.resolutionType || 'NATIVE'}
                          </p>
                        </div>
                      ))}
                    </div>
                    <Textarea value={editText} onChange={(e) => setEditText(e.target.value)} placeholder="غير الخلفية" />
                    <div className="flex gap-2">
                      <Button
                        disabled={busy || !editText}
                        variant="outline"
                        onClick={() =>
                          wrap(async () => {
                            const parsed = await api<{ parsedPlan: Record<string, unknown> }>('/creative/edits/parse', {
                              method: 'POST',
                              body: JSON.stringify({ projectId: project.id, instruction: editText }),
                            });
                            setEditParsed(parsed.parsedPlan);
                          })
                        }
                      >
                        Parse edit
                      </Button>
                      <Button disabled={busy || !editText} onClick={() => generate('EDIT', { instruction: editText })}>
                        {t('creative.variation')}
                      </Button>
                    </div>
                    {editParsed && <pre className="text-xs">{JSON.stringify(editParsed, null, 2)}</pre>}
                    <p className="text-xs text-muted-foreground">{t('creative.costUnknown')}</p>
                    {(latestJob.assets || []).map((asset) => (
                      <Button
                        key={`dl-${asset.id}`}
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          wrap(async () => {
                            const url = await fetchAuthedBlobUrl(`/creative/generated/${asset.id}/file?download=1`);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = 'creative-media';
                            a.click();
                          })
                        }
                      >
                        {t('creative.export')}
                      </Button>
                    ))}
                  </CardContent>
                </Card>
              )}

              {(project.scenes || []).length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>{t('creative.timeline')}</CardTitle>
                    <CardDescription>00:00 ──────── {project.scenes!.reduce((s, sc) => s + (sc.durationSec || 0), 0)}s</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {project.scenes!.map((scene) => (
                      <div key={scene.id} className="rounded border p-3 text-sm">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <strong>Scene {scene.order} {scene.role || ''}</strong>
                          <span>{scene.durationSec}s</span>
                        </div>
                        <Textarea
                          className="mt-2"
                          defaultValue={scene.script || ''}
                          onBlur={(e) => {
                            const value = e.target.value;
                            void api(`/creative/scenes/${scene.id}`, { method: 'PATCH', body: JSON.stringify({ script: value }) });
                          }}
                        />
                        <div className="mt-2 flex flex-wrap gap-2">
                          <Button size="sm" variant="outline" disabled={busy} onClick={() => generate('EDIT', { sceneId: scene.id, instruction: `غير المشهد ${scene.order} فقط` })}>
                            {t('creative.regenerateScene')}
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => wrap(async () => { await api(`/creative/scenes/${scene.id}/duplicate`, { method: 'POST', body: '{}' }); await loadProject(project.id); })}>
                            Duplicate
                          </Button>
                        </div>
                      </div>
                    ))}
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() =>
                        wrap(async () => {
                          await api(`/creative/projects/${project.id}/scenes`, {
                            method: 'PUT',
                            body: JSON.stringify({
                              scenes: [
                                ...(project.scenes || []).map((s) => ({ id: s.id, order: s.order, durationSec: s.durationSec, script: s.script, role: s.role })),
                                { order: (project.scenes?.length || 0) + 1, durationSec: 5, role: 'PRODUCT', script: '' },
                              ],
                            }),
                          });
                          await loadProject(project.id);
                        })
                      }
                    >
                      {t('creative.addScene')}
                    </Button>
                    <Button size="sm" onClick={() => wrap(async () => { await api(`/creative/projects/${project.id}/script`, { method: 'POST', body: '{}' }); await loadProject(project.id); })}>
                      {t('creative.script')}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => generate('TTS', { script: project.scenes?.[0]?.script || '', dialect: 'msa' })}>
                      {t('creative.voice')}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => generate('COMPOSE')}>{t('creative.compose')}</Button>
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader><CardTitle>{t('creative.director')}</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  <Textarea value={directorCmd} onChange={(e) => setDirectorCmd(e.target.value)} placeholder="سويلي إعلان 30 ثانية..." />
                  <Button
                    disabled={busy || !directorCmd}
                    onClick={() =>
                      wrap(async () => {
                        const result = await api<{ config: Record<string, unknown> }>(`/creative/projects/${project.id}/director`, {
                          method: 'POST',
                          body: JSON.stringify({ command: directorCmd }),
                        });
                        setEditParsed(result.config);
                      })
                    }
                  >
                    {t('creative.director')}
                  </Button>
                </CardContent>
              </Card>

              {(project.versions || []).length > 0 && (
                <Card>
                  <CardHeader><CardTitle>{t('creative.versions')}</CardTitle></CardHeader>
                  <CardContent className="space-y-2">
                    {project.versions!.map((v) => (
                      <div key={v.id} className="flex items-center justify-between text-sm">
                        <span>v{v.version} {v.label || ''} {v.isCurrent ? '(current)' : ''}</span>
                        {!v.isCurrent && (
                          <Button size="sm" variant="outline" onClick={() => wrap(async () => { await api(`/creative/versions/${v.id}/restore`, { method: 'POST', body: '{}' }); await loadProject(project.id); })}>
                            Restore
                          </Button>
                        )}
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              <button type="button" className="text-xs underline" onClick={() => setAdvanced(!advanced)}>{t('creative.advanced')}</button>
              {advanced && (
                <pre className="text-xs text-muted-foreground">{JSON.stringify(project.jobs?.[0] || {}, null, 2)}</pre>
              )}
            </div>
          )}
        </div>
      </PlanGate>
    </AppShell>
  );
}
