'use client';

import { FormEvent, useEffect, useState } from 'react';
import { BookOpen, Brain, Bot, DollarSign, GraduationCap, Loader2, Search, Settings2, Sparkles, Wrench, Zap } from 'lucide-react';
import { TrainingMediaPanel } from '@/components/ai/training-media-panel';
import { AppShell } from '@/components/layout/app-shell';
import { useTranslation } from '@/components/providers/locale-provider';
import { AlertBanner } from '@/components/shared/alert-banner';
import { PageHeader } from '@/components/shared/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { api, parseApiError } from '@/lib/utils';

type KnowledgeDocument = { id: string; title: string; status: string; mimeType?: string; _count?: { chunks: number } };
type MemoryItem = { id: string; scope: string; key: string; value: string };
type Tool = { id: string; name: string; description: string; kind: string; enabled: boolean };
type Cost = { operation: string; _sum: { costCents: number; promptTokens: number; completionTokens: number }; _count: { _all: number } };
type AiSettings = {
  enabled: boolean;
  autoReplyEnabled: boolean;
  confidenceThreshold: number;
  greetingMessage?: string | null;
  outOfOfficeMessage?: string | null;
  transferOnLowConfidence: boolean;
  transferOnComplaint: boolean;
  transferOnRefund: boolean;
  transferOnSensitive: boolean;
  transferOnHumanRequest: boolean;
  pauseAiOnHumanReply: boolean;
  pauseAiOnAssignment: boolean;
  systemPromptOverride?: string | null;
};
type AutomationRule = { id: string; name: string; trigger: string; action: string; enabled: boolean; priority: number };

export default function AiPage() {
  const { t } = useTranslation();
  const [answer, setAnswer] = useState('');
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
  const [searchResults, setSearchResults] = useState<Array<{ title: string; content: string; score: number }>>([]);
  const [memories, setMemories] = useState<MemoryItem[]>([]);
  const [tools, setTools] = useState<Tool[]>([]);
  const [costs, setCosts] = useState<Cost[]>([]);
  const [settings, setSettings] = useState<AiSettings | null>(null);
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [trainingSaving, setTrainingSaving] = useState(false);
  const [trainingNotice, setTrainingNotice] = useState<string | null>(null);

  async function load() {
    const [docs, memory, toolData, costData, settingsData, rulesData] = await Promise.all([
      api<KnowledgeDocument[]>('/ai/knowledge'),
      api<MemoryItem[]>('/ai/memory'),
      api<Tool[]>('/ai/tools'),
      api<Cost[]>('/ai/costs'),
      api<AiSettings>('/ai/settings'),
      api<AutomationRule[]>('/ai/automation'),
    ]);
    setDocuments(docs.filter((doc) => doc.title !== '__ai_training_instructions__')); setMemories(memory); setTools(toolData); setCosts(costData); setSettings(settingsData); setRules(rulesData);
  }
  useEffect(() => { load().catch(console.error); }, []);

  async function chat(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const form = new FormData(event.currentTarget); const result = await api<{ content: string }>('/ai/chat', { method: 'POST', body: JSON.stringify({ message: form.get('message'), useKnowledge: true }) }); setAnswer(result.content); }
  async function ingestText(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const form = new FormData(event.currentTarget); await api('/ai/knowledge/text', { method: 'POST', body: JSON.stringify({ title: form.get('title'), content: form.get('content') }) }); event.currentTarget.reset(); await load(); }
  async function crawl(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const form = new FormData(event.currentTarget); await api('/ai/knowledge/crawl', { method: 'POST', body: JSON.stringify({ url: form.get('url') }) }); event.currentTarget.reset(); await load(); }
  async function search(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const form = new FormData(event.currentTarget); setSearchResults(await api('/ai/search', { method: 'POST', body: JSON.stringify({ query: form.get('query') }) })); }
  async function memory(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const form = new FormData(event.currentTarget); await api('/ai/memory', { method: 'POST', body: JSON.stringify({ scope: form.get('scope'), key: form.get('key'), value: form.get('value') }) }); event.currentTarget.reset(); await load(); }
  async function createTool(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const form = new FormData(event.currentTarget); await api('/ai/tools', { method: 'POST', body: JSON.stringify({ name: form.get('name'), description: form.get('description'), kind: 'HTTP_REQUEST', schema: {}, config: { method: 'POST', url: form.get('url') } }) }); event.currentTarget.reset(); await load(); }
  async function analyze(event: FormEvent<HTMLFormElement>, path: string) { event.preventDefault(); const form = new FormData(event.currentTarget); const result = await api<{ content: string }>(path, { method: 'POST', body: JSON.stringify({ text: form.get('text'), targetLanguage: form.get('targetLanguage') }) }); setAnswer(result.content); }
  async function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const updated = await api<AiSettings>('/ai/settings', {
      method: 'POST',
      body: JSON.stringify({
        enabled: form.get('enabled') === 'on',
        autoReplyEnabled: form.get('autoReplyEnabled') === 'on',
        confidenceThreshold: Number(form.get('confidenceThreshold')),
        greetingMessage: form.get('greetingMessage') || null,
        outOfOfficeMessage: form.get('outOfOfficeMessage') || null,
        transferOnLowConfidence: form.get('transferOnLowConfidence') === 'on',
        transferOnComplaint: form.get('transferOnComplaint') === 'on',
        transferOnRefund: form.get('transferOnRefund') === 'on',
        transferOnSensitive: form.get('transferOnSensitive') === 'on',
        transferOnHumanRequest: form.get('transferOnHumanRequest') === 'on',
        pauseAiOnHumanReply: form.get('pauseAiOnHumanReply') === 'on',
        pauseAiOnAssignment: form.get('pauseAiOnAssignment') === 'on',
      }),
    });
    setSettings(updated);
  }
  async function saveTraining(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!settings) return;
    setTrainingSaving(true);
    setTrainingNotice(null);
    try {
      const form = new FormData(event.currentTarget);
      const systemPromptOverride = String(form.get('trainingInstructions') ?? '').trim() || null;
      const updated = await api<AiSettings>('/ai/settings', {
        method: 'POST',
        body: JSON.stringify({
          enabled: true,
          autoReplyEnabled: true,
          confidenceThreshold: settings.confidenceThreshold,
          greetingMessage: settings.greetingMessage ?? null,
          outOfOfficeMessage: settings.outOfOfficeMessage ?? null,
          transferOnLowConfidence: settings.transferOnLowConfidence,
          transferOnComplaint: settings.transferOnComplaint,
          transferOnRefund: settings.transferOnRefund,
          transferOnSensitive: settings.transferOnSensitive,
          transferOnHumanRequest: settings.transferOnHumanRequest,
          pauseAiOnHumanReply: settings.pauseAiOnHumanReply,
          pauseAiOnAssignment: settings.pauseAiOnAssignment,
          systemPromptOverride,
        }),
      });
      setSettings(updated);
      setTrainingNotice(t('ai.trainingSaved'));
    } catch (err) {
      setTrainingNotice(parseApiError(err));
    } finally {
      setTrainingSaving(false);
    }
  }
  async function createRule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await api('/ai/automation', { method: 'POST', body: JSON.stringify({ name: form.get('name'), trigger: form.get('trigger'), action: form.get('action'), config: { message: form.get('message') }, priority: Number(form.get('priority') || 0) }) });
    event.currentTarget.reset();
    await load();
  }

  return (
    <AppShell>
      <PageHeader title={t('ai.title')} description={t('ai.description')} />

      <Tabs defaultValue="training" className="mt-6">
        <TabsList className="mb-4 flex-wrap">
          <TabsTrigger value="training"><GraduationCap className="me-2 h-4 w-4" />{t('ai.tabTraining')}</TabsTrigger>
          <TabsTrigger value="settings"><Settings2 className="me-2 h-4 w-4" />{t('ai.tabSettings')}</TabsTrigger>
          <TabsTrigger value="automation"><Zap className="me-2 h-4 w-4" />{t('ai.tabAutomation')}</TabsTrigger>
          <TabsTrigger value="chat"><Sparkles className="me-2 h-4 w-4" />{t('ai.tabChat')}</TabsTrigger>
          <TabsTrigger value="knowledge"><BookOpen className="me-2 h-4 w-4" />{t('ai.tabKnowledge')}</TabsTrigger>
          <TabsTrigger value="memory"><Brain className="me-2 h-4 w-4" />{t('ai.tabMemory')}</TabsTrigger>
          <TabsTrigger value="tools"><Wrench className="me-2 h-4 w-4" />{t('ai.tabTools')}</TabsTrigger>
          <TabsTrigger value="costs"><DollarSign className="me-2 h-4 w-4" />{t('ai.tabCosts')}</TabsTrigger>
        </TabsList>

        <TabsContent value="training">
          <Card className="border-0 shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><GraduationCap className="h-5 w-5" />{t('ai.trainingTitle')}</CardTitle>
              <CardDescription>{t('ai.trainingDesc')}</CardDescription>
            </CardHeader>
            <CardContent>
              {trainingNotice && (
                <AlertBanner className="mb-4" variant={trainingNotice === t('ai.trainingSaved') ? 'success' : 'error'}>
                  {trainingNotice}
                </AlertBanner>
              )}
              {settings && (
                <form onSubmit={saveTraining} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="trainingInstructions">{t('ai.tabTraining')}</Label>
                    <Textarea
                      id="trainingInstructions"
                      name="trainingInstructions"
                      defaultValue={settings.systemPromptOverride ?? ''}
                      placeholder={t('ai.trainingPlaceholder')}
                      rows={16}
                      className="font-mono text-sm leading-relaxed"
                    />
                  </div>
                  <p className="text-sm text-muted-foreground">{t('ai.trainingHint')}</p>
                  <div className="flex flex-wrap items-center gap-3">
                    <Button type="submit" disabled={trainingSaving}>
                      {trainingSaving ? <><Loader2 className="me-2 h-4 w-4 animate-spin" />{t('ai.savingTraining')}</> : t('ai.saveTraining')}
                    </Button>
                    {settings.enabled && settings.autoReplyEnabled && (
                      <Badge variant="success">{t('common.enabled')}</Badge>
                    )}
                  </div>
                </form>
              )}
              <TrainingMediaPanel />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings">
          <Card className="border-0 shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Bot className="h-5 w-5" />{t('ai.settingsTitle')}</CardTitle>
              <CardDescription>{t('ai.settingsDesc')}</CardDescription>
            </CardHeader>
            <CardContent>
              {settings && (
                <form onSubmit={saveSettings} className="grid gap-4 md:grid-cols-2">
                  <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="enabled" defaultChecked={settings.enabled} /> {t('ai.enableAi')}</label>
                  <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="autoReplyEnabled" defaultChecked={settings.autoReplyEnabled} /> {t('ai.autoReply')}</label>
                  <div className="space-y-2">
                    <Label>{t('ai.confidenceThreshold')}</Label>
                    <Input name="confidenceThreshold" type="number" step="0.05" min="0" max="1" defaultValue={settings.confidenceThreshold} />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label>{t('ai.greetingMessage')}</Label>
                    <Textarea name="greetingMessage" defaultValue={settings.greetingMessage ?? ''} rows={2} />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label>{t('ai.oooMessage')}</Label>
                    <Textarea name="outOfOfficeMessage" defaultValue={settings.outOfOfficeMessage ?? ''} rows={2} />
                  </div>
                  <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="transferOnHumanRequest" defaultChecked={settings.transferOnHumanRequest} /> {t('ai.transferHuman')}</label>
                  <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="transferOnLowConfidence" defaultChecked={settings.transferOnLowConfidence} /> {t('ai.transferLowConfidence')}</label>
                  <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="transferOnComplaint" defaultChecked={settings.transferOnComplaint} /> {t('ai.transferComplaint')}</label>
                  <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="transferOnRefund" defaultChecked={settings.transferOnRefund} /> {t('ai.transferRefund')}</label>
                  <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="transferOnSensitive" defaultChecked={settings.transferOnSensitive} /> {t('ai.transferSensitive')}</label>
                  <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="pauseAiOnHumanReply" defaultChecked={settings.pauseAiOnHumanReply} /> {t('ai.pauseOnHuman')}</label>
                  <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="pauseAiOnAssignment" defaultChecked={settings.pauseAiOnAssignment} /> {t('ai.pauseOnAssign')}</label>
                  <Button type="submit" className="md:col-span-2">{t('ai.saveSettings')}</Button>
                </form>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="automation">
          <Card className="border-0 shadow-card">
            <CardHeader>
              <CardTitle>{t('ai.automationTitle')}</CardTitle>
              <CardDescription>{t('ai.automationDesc')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <form onSubmit={createRule} className="grid gap-3 rounded-lg border bg-muted/30 p-4 md:grid-cols-2">
                <Input name="name" placeholder={t('ai.ruleName')} required />
                <Input name="priority" type="number" placeholder={t('ai.priority')} defaultValue={0} />
                <select name="trigger" className="rounded-md border bg-background px-3 py-2 text-sm" required>
                  <option value="CONVERSATION_OPENED">{t('ai.triggerConversationOpened')}</option>
                  <option value="MESSAGE_RECEIVED">{t('ai.triggerMessageReceived')}</option>
                  <option value="OUT_OF_OFFICE">{t('ai.triggerOutOfOffice')}</option>
                  <option value="BUSINESS_HOURS">{t('ai.triggerBusinessHours')}</option>
                </select>
                <select name="action" className="rounded-md border bg-background px-3 py-2 text-sm" required>
                  <option value="SEND_GREETING">{t('ai.actionGreeting')}</option>
                  <option value="SEND_MESSAGE">{t('ai.actionMessage')}</option>
                  <option value="AUTO_TAG">{t('ai.actionAutoTag')}</option>
                  <option value="AUTO_ASSIGN">{t('ai.actionAutoAssign')}</option>
                </select>
                <Textarea name="message" placeholder={t('ai.content')} className="md:col-span-2" rows={2} />
                <Button type="submit" className="md:col-span-2">{t('ai.addRule')}</Button>
              </form>
              <Table>
                <TableHeader><TableRow><TableHead>{t('ai.ruleName')}</TableHead><TableHead>Trigger</TableHead><TableHead>Action</TableHead><TableHead>{t('ai.priority')}</TableHead></TableRow></TableHeader>
                <TableBody>
                  {rules.map((rule) => (
                    <TableRow key={rule.id}>
                      <TableCell className="font-medium">{rule.name}</TableCell>
                      <TableCell><Badge variant="outline">{rule.trigger}</Badge></TableCell>
                      <TableCell><Badge variant="secondary">{rule.action}</Badge></TableCell>
                      <TableCell>{rule.priority}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="chat">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="border-0 shadow-card">
              <CardHeader>
                <CardTitle>{t('ai.chatTitle')}</CardTitle>
                <CardDescription>{t('ai.chatDesc')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <form onSubmit={chat} className="flex gap-2">
                  <Input name="message" placeholder={t('ai.askPlaceholder')} required className="flex-1" />
                  <Button type="submit">{t('ai.askBtn')}</Button>
                </form>
                {answer && (
                  <div className="rounded-lg bg-muted p-4">
                    <pre className="whitespace-pre-wrap text-sm">{answer}</pre>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-0 shadow-card">
              <CardHeader>
                <CardTitle>{t('ai.assistantsTitle')}</CardTitle>
                <CardDescription>{t('ai.assistantsDesc')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <form onSubmit={(e) => analyze(e, '/ai/rewrite')} className="space-y-2">
                  <Input name="text" placeholder={t('ai.rewrite')} />
                  <Button variant="secondary" className="w-full">{t('ai.rewrite')}</Button>
                </form>
                <form onSubmit={(e) => analyze(e, '/ai/translate')} className="space-y-2">
                  <Input name="text" placeholder={t('ai.translate')} />
                  <Input name="targetLanguage" placeholder={t('ai.targetLanguage')} />
                  <Button variant="secondary" className="w-full">{t('ai.translate')}</Button>
                </form>
                <form onSubmit={(e) => analyze(e, '/ai/sentiment')} className="space-y-2">
                  <Input name="text" placeholder={t('ai.analyzeSentiment')} />
                  <Button variant="secondary" className="w-full">{t('ai.analyzeSentiment')}</Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="knowledge">
          <Card className="border-0 shadow-card">
            <CardHeader>
              <CardTitle>{t('ai.knowledgeTitle')}</CardTitle>
              <CardDescription>{t('ai.knowledgeDesc')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <form onSubmit={ingestText} className="grid gap-3 rounded-lg border bg-muted/30 p-4 md:grid-cols-2">
                <div className="space-y-2 md:col-span-2">
                  <Label>{t('ai.docTitle')}</Label>
                  <Input name="title" placeholder={t('ai.docTitle')} required />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>{t('ai.content')}</Label>
                  <Textarea name="content" placeholder={t('ai.content')} required rows={4} />
                </div>
                <Button type="submit" className="md:col-span-2">{t('ai.indexText')}</Button>
              </form>

              <form onSubmit={crawl} className="flex gap-2">
                <Input name="url" placeholder="https://example.com/docs" required className="flex-1" />
                <Button type="submit">{t('ai.crawlUrl')}</Button>
              </form>

              <form onSubmit={search} className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input name="query" placeholder={t('ai.searchKnowledge')} required className="ps-9" />
                </div>
                <Button type="submit">{t('common.search')}</Button>
              </form>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('ai.docTitle')}</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Chunks</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {documents.map((doc) => (
                    <TableRow key={doc.id}>
                      <TableCell className="font-medium">{doc.title}</TableCell>
                      <TableCell><Badge variant="outline">{doc.status}</Badge></TableCell>
                      <TableCell className="text-right">{doc._count?.chunks ?? 0}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {searchResults.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold">Search results</h4>
                  {searchResults.map((result, index) => (
                    <div key={index} className="rounded-lg bg-muted p-3 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{result.title}</span>
                        <Badge variant="secondary">{Math.round(result.score * 100)}%</Badge>
                      </div>
                      <p className="mt-1 text-muted-foreground">{result.content.slice(0, 240)}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="memory">
          <Card className="border-0 shadow-card">
            <CardHeader>
              <CardTitle>{t('ai.memoryTitle')}</CardTitle>
              <CardDescription>{t('ai.memoryDesc')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <form onSubmit={memory} className="grid gap-3 rounded-lg border bg-muted/30 p-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label>{t('ai.scope')}</Label>
                  <select name="scope" className="flex h-10 w-full rounded-lg border border-input bg-background px-3 text-sm shadow-soft">
                    <option>BUSINESS</option>
                    <option>LONG_TERM</option>
                    <option>CUSTOMER</option>
                    <option>CONVERSATION</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>{t('ai.key')}</Label>
                  <Input name="key" placeholder={t('ai.key')} required />
                </div>
                <div className="space-y-2">
                  <Label>{t('ai.value')}</Label>
                  <Input name="value" placeholder={t('ai.value')} required />
                </div>
                <Button type="submit" className="md:col-span-3">{t('ai.saveMemory')}</Button>
              </form>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('ai.scope')}</TableHead>
                    <TableHead>{t('ai.key')}</TableHead>
                    <TableHead>{t('ai.value')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {memories.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell><Badge variant="outline">{item.scope}</Badge></TableCell>
                      <TableCell className="font-medium">{item.key}</TableCell>
                      <TableCell className="text-muted-foreground">{item.value}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tools">
          <Card className="border-0 shadow-card">
            <CardHeader>
              <CardTitle>{t('ai.toolsTitle')}</CardTitle>
              <CardDescription>{t('ai.toolsDesc')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <form onSubmit={createTool} className="grid gap-3 rounded-lg border bg-muted/30 p-4">
                <Input name="name" placeholder={t('ai.toolName')} required />
                <Input name="description" placeholder={t('ai.content')} required />
                <Input name="url" placeholder={t('ai.toolUrl')} required />
                <Button type="submit">{t('ai.createTool')}</Button>
              </form>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('ai.toolName')}</TableHead>
                    <TableHead>Kind</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tools.map((tool) => (
                    <TableRow key={tool.id}>
                      <TableCell>
                        <p className="font-medium">{tool.name}</p>
                        <p className="text-xs text-muted-foreground">{tool.description}</p>
                      </TableCell>
                      <TableCell><Badge variant="outline">{tool.kind}</Badge></TableCell>
                      <TableCell><Badge variant={tool.enabled ? 'success' : 'secondary'}>{tool.enabled ? t('common.enabled') : t('common.disabled')}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="costs">
          <Card className="border-0 shadow-card">
            <CardHeader>
              <CardTitle>{t('ai.costsTitle')}</CardTitle>
              <CardDescription>{t('ai.costsDesc')}</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('ai.operation')}</TableHead>
                    <TableHead>{t('ai.costCents')}</TableHead>
                    <TableHead>{t('ai.tokens')}</TableHead>
                    <TableHead className="text-right">{t('ai.runs')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {costs.map((cost) => (
                    <TableRow key={cost.operation}>
                      <TableCell className="font-medium">{cost.operation}</TableCell>
                      <TableCell>{cost._sum.costCents ?? 0}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {(cost._sum.promptTokens ?? 0) + (cost._sum.completionTokens ?? 0)}
                      </TableCell>
                      <TableCell className="text-right">{cost._count._all}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}
