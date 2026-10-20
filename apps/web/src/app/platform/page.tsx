'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { AppShell } from '@/components/layout/app-shell';
import { useTranslation } from '@/components/providers/locale-provider';
import { AlertBanner } from '@/components/shared/alert-banner';
import { LoadingBlock } from '@/components/shared/loading-block';
import { PageHeader } from '@/components/shared/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { api, parseApiError } from '@/lib/utils';

type Business = { id: string; name: string; slug: string; industry?: string };
type AiAgent = { id: string; name: string; type: string };
type WhatsAppAccount = {
  id: string;
  name: string;
  phoneNumber: string;
  phoneNumberId: string;
  status: string;
  aiAgent?: AiAgent | null;
  channel?: { id: string; status: string } | null;
};
type RoutingRule = {
  id: string;
  name: string;
  strategy: string;
  active: boolean;
  poolMembers: Array<{ account: { id: string; name: string; phoneNumber: string } }>;
};
type Campaign = {
  id: string;
  name: string;
  slug: string;
  active: boolean;
  redirectMessage?: string;
  whatsAppCloudAccount?: { id: string; name: string; phoneNumber: string } | null;
  routingRule?: { id: string; name: string; strategy: string } | null;
  _count?: { redirectLogs: number };
};
type RedirectLog = {
  id: string;
  createdAt: string;
  device?: string;
  ipAddress?: string;
  utmSource?: string;
  campaign?: { name: string; slug: string };
};
type WebhookEvent = {
  id: string;
  provider: string;
  eventType: string;
  status: string;
  createdAt: string;
};

const SOURCE_TYPES = ['TIKTOK', 'FACEBOOK', 'INSTAGRAM', 'GOOGLE', 'LANDING_PAGE', 'SNAPCHAT', 'CUSTOM'] as const;
const STRATEGIES = ['MANUAL', 'ROUND_ROBIN', 'RANDOM', 'PERCENTAGE', 'COUNTRY', 'CAMPAIGN', 'AI'] as const;

export default function PlatformPage() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [accounts, setAccounts] = useState<WhatsAppAccount[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [rules, setRules] = useState<RoutingRule[]>([]);
  const [redirectLogs, setRedirectLogs] = useState<RedirectLog[]>([]);
  const [webhooks, setWebhooks] = useState<WebhookEvent[]>([]);
  const [agents, setAgents] = useState<AiAgent[]>([]);
  const [busy, setBusy] = useState(false);
  const [campaignSource, setCampaignSource] = useState<string>('TIKTOK');
  const [campaignWhatsApp, setCampaignWhatsApp] = useState<string>('');
  const [campaignRule, setCampaignRule] = useState<string>('');
  const [ruleStrategy, setRuleStrategy] = useState<string>('ROUND_ROBIN');
  const [whatsAppAgent, setWhatsAppAgent] = useState<string>('');
  const [sendTo, setSendTo] = useState('');
  const [sendBody, setSendBody] = useState('Hello from ChatLoora WhatsApp Cloud API');
  const [sendAccountId, setSendAccountId] = useState('');
  const [sendResult, setSendResult] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [b, a, c, r, logs, wh, ag] = await Promise.all([
        api<Business[]>('/businesses'),
        api<WhatsAppAccount[]>('/whatsapp-cloud/accounts'),
        api<Campaign[]>('/campaigns'),
        api<RoutingRule[]>('/routing/whatsapp'),
        api<RedirectLog[]>('/platform/redirect-logs'),
        api<WebhookEvent[]>('/platform/webhook-events'),
        api<AiAgent[]>('/ai/agents'),
      ]);
      setBusinesses(b);
      setAccounts(a);
      setCampaigns(c);
      setRules(r);
      setRedirectLogs(logs);
      setWebhooks(wh);
      setAgents(ag);
    } catch (err) {
      setError(parseApiError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load().catch(console.error); }, [load]);

  async function submitBusiness(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    try {
      await api('/businesses', {
        method: 'POST',
        body: JSON.stringify({ name: form.get('name'), slug: form.get('slug') }),
      });
      e.currentTarget.reset();
      await load();
    } catch (err) {
      setError(parseApiError(err));
    } finally {
      setBusy(false);
    }
  }

  async function submitWhatsApp(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    try {
      await api('/whatsapp-cloud/accounts', {
        method: 'POST',
        body: JSON.stringify({
          name: form.get('name'),
          phoneNumber: form.get('phoneNumber'),
          phoneNumberId: form.get('phoneNumberId'),
          wabaId: form.get('wabaId'),
          accessToken: form.get('accessToken'),
          verifyToken: form.get('verifyToken') || undefined,
          aiAgentId: whatsAppAgent || undefined,
        }),
      });
      e.currentTarget.reset();
      await load();
    } catch (err) {
      setError(parseApiError(err));
    } finally {
      setBusy(false);
    }
  }

  async function submitCampaign(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    try {
      await api('/campaigns', {
        method: 'POST',
        body: JSON.stringify({
          name: form.get('name'),
          slug: form.get('slug'),
          trafficSourceType: campaignSource,
          whatsAppCloudAccountId: campaignWhatsApp || undefined,
          routingRuleId: campaignRule || undefined,
          redirectMessage: form.get('redirectMessage') || undefined,
        }),
      });
      e.currentTarget.reset();
      await load();
    } catch (err) {
      setError(parseApiError(err));
    } finally {
      setBusy(false);
    }
  }

  async function submitRule(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const accountIds = form.getAll('accountIds') as string[];
    setBusy(true);
    try {
      await api('/routing/whatsapp', {
        method: 'POST',
        body: JSON.stringify({
          name: form.get('name'),
          strategy: ruleStrategy,
          pool: accountIds.filter(Boolean).map((accountId) => ({ accountId })),
        }),
      });
      e.currentTarget.reset();
      await load();
    } catch (err) {
      setError(parseApiError(err));
    } finally {
      setBusy(false);
    }
  }

  async function copyTrackingLink(campaignId: string) {
    try {
      const { url } = await api<{ url: string }>(`/campaigns/${campaignId}/tracking-link`);
      await navigator.clipboard.writeText(url);
    } catch (err) {
      setError(parseApiError(err));
    }
  }

  async function assignAgent(accountId: string, aiAgentId: string) {
    setBusy(true);
    try {
      await api(`/whatsapp-cloud/accounts/${accountId}/ai-agent`, {
        method: 'POST',
        body: JSON.stringify({ aiAgentId: aiAgentId || null }),
      });
      await load();
    } catch (err) {
      setError(parseApiError(err));
    } finally {
      setBusy(false);
    }
  }

  async function sendCloudMessage(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!sendAccountId) {
      setError('Select a Cloud API account first');
      return;
    }
    setBusy(true);
    setSendResult(null);
    try {
      const res = await api<{ messageId?: string }>(`/whatsapp-cloud/accounts/${sendAccountId}/send`, {
        method: 'POST',
        body: JSON.stringify({ to: sendTo, body: sendBody }),
      });
      setSendResult(`Sent · message id: ${res.messageId ?? 'ok'}`);
    } catch (err) {
      setError(parseApiError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell>
      <PageHeader title={t('platform.title')} description={t('platform.description')} />

      {error && <AlertBanner className="mt-4" message={error} onDismiss={() => setError(null)} />}

      {loading ? (
        <LoadingBlock className="mt-6" />
      ) : (
        <Tabs defaultValue="whatsapp" className="mt-6">
          <TabsList className="flex h-auto flex-wrap gap-1">
            <TabsTrigger value="businesses">{t('platform.tabBusinesses')}</TabsTrigger>
            <TabsTrigger value="whatsapp">{t('platform.tabWhatsApp')}</TabsTrigger>
            <TabsTrigger value="campaigns">{t('platform.tabCampaigns')}</TabsTrigger>
            <TabsTrigger value="routing">{t('platform.tabRouting')}</TabsTrigger>
            <TabsTrigger value="analytics">{t('platform.tabAnalytics')}</TabsTrigger>
            <TabsTrigger value="webhooks">{t('platform.tabWebhooks')}</TabsTrigger>
          </TabsList>

          <TabsContent value="businesses" className="mt-4 space-y-4">
            <Card>
              <CardHeader><CardTitle>{t('platform.createBusiness')}</CardTitle></CardHeader>
              <CardContent>
                <form onSubmit={submitBusiness} className="grid gap-3 sm:grid-cols-3">
                  <div><Label>{t('platform.businessName')}</Label><Input name="name" required /></div>
                  <div><Label>{t('platform.businessSlug')}</Label><Input name="slug" required pattern="[a-z0-9-]+" /></div>
                  <div className="flex items-end"><Button type="submit" disabled={busy}>{t('common.save')}</Button></div>
                </form>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                {businesses.length === 0 ? (
                  <p className="text-muted-foreground">{t('platform.noData')}</p>
                ) : (
                  <Table>
                    <TableHeader><TableRow><TableHead>{t('platform.businessName')}</TableHead><TableHead>{t('platform.businessSlug')}</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {businesses.map((b) => (
                        <TableRow key={b.id}><TableCell>{b.name}</TableCell><TableCell>{b.slug}</TableCell></TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="whatsapp" className="mt-4 space-y-4">
            <Card>
              <CardHeader><CardTitle>{t('platform.addWhatsAppAccount')}</CardTitle></CardHeader>
              <CardContent>
                <form onSubmit={submitWhatsApp} className="grid gap-3 sm:grid-cols-2">
                  <div><Label>{t('platform.accountName')}</Label><Input name="name" required /></div>
                  <div><Label>{t('platform.phoneNumber')}</Label><Input name="phoneNumber" required placeholder="+966..." /></div>
                  <div><Label>{t('platform.phoneNumberId')}</Label><Input name="phoneNumberId" required /></div>
                  <div><Label>{t('platform.wabaId')}</Label><Input name="wabaId" required /></div>
                  <div className="sm:col-span-2"><Label>{t('platform.accessToken')}</Label><Input name="accessToken" required type="password" /></div>
                  <div><Label>{t('platform.verifyToken')}</Label><Input name="verifyToken" /></div>
                  <div>
                    <Label>{t('platform.assignAiAgent')}</Label>
                    <Select value={whatsAppAgent} onValueChange={setWhatsAppAgent}>
                      <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                      <SelectContent>
                        {agents.map((a) => <SelectItem key={a.id} value={a.id}>{a.name} ({a.type})</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="sm:col-span-2"><Button type="submit" disabled={busy}>{t('common.connect')}</Button></div>
                </form>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Send test message (Cloud API)</CardTitle></CardHeader>
              <CardContent>
                <form onSubmit={sendCloudMessage} className="grid gap-3 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <Label>Account</Label>
                    <Select value={sendAccountId} onValueChange={setSendAccountId}>
                      <SelectTrigger><SelectValue placeholder="Select connected account" /></SelectTrigger>
                      <SelectContent>
                        {accounts.filter((a) => a.status === 'CONNECTED').map((a) => (
                          <SelectItem key={a.id} value={a.id}>{a.name} · {a.phoneNumber}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Recipient (digits with country code)</Label>
                    <Input value={sendTo} onChange={(e) => setSendTo(e.target.value)} placeholder="9647XXXXXXXX" required />
                  </div>
                  <div>
                    <Label>Message</Label>
                    <Input value={sendBody} onChange={(e) => setSendBody(e.target.value)} required />
                  </div>
                  <div className="sm:col-span-2 flex items-center gap-3">
                    <Button type="submit" disabled={busy}>Send via Cloud API</Button>
                    {sendResult ? <span className="text-sm text-emerald-600">{sendResult}</span> : null}
                  </div>
                </form>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                {accounts.length === 0 ? (
                  <p className="text-muted-foreground">{t('platform.noData')}</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t('platform.accountName')}</TableHead>
                        <TableHead>{t('platform.phoneNumber')}</TableHead>
                        <TableHead>{t('platform.status')}</TableHead>
                        <TableHead>{t('platform.assignAiAgent')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {accounts.map((a) => (
                        <TableRow key={a.id}>
                          <TableCell>{a.name}</TableCell>
                          <TableCell>{a.phoneNumber}</TableCell>
                          <TableCell>
                            <Badge variant={a.status === 'CONNECTED' ? 'default' : 'secondary'}>
                              {a.status === 'CONNECTED' ? t('platform.connected') : t('platform.disconnected')}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Select
                              value={a.aiAgent?.id ?? ''}
                              onValueChange={(v) => assignAgent(a.id, v)}
                              disabled={busy}
                            >
                              <SelectTrigger className="w-[180px]"><SelectValue placeholder="—" /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="">—</SelectItem>
                                {agents.map((ag) => <SelectItem key={ag.id} value={ag.id}>{ag.name}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="campaigns" className="mt-4 space-y-4">
            <Card>
              <CardHeader><CardTitle>{t('platform.createCampaign')}</CardTitle></CardHeader>
              <CardContent>
                <form onSubmit={submitCampaign} className="grid gap-3 sm:grid-cols-2">
                  <div><Label>{t('platform.campaignName')}</Label><Input name="name" required /></div>
                  <div><Label>{t('platform.campaignSlug')}</Label><Input name="slug" required pattern="[a-z0-9-]+" /></div>
                  <div>
                    <Label>{t('platform.sourceType')}</Label>
                    <Select value={campaignSource} onValueChange={setCampaignSource}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {SOURCE_TYPES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>{t('platform.whatsAppTarget')}</Label>
                    <Select value={campaignWhatsApp} onValueChange={setCampaignWhatsApp}>
                      <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                      <SelectContent>
                        {accounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.name} — {a.phoneNumber}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>{t('platform.routingRule')}</Label>
                    <Select value={campaignRule} onValueChange={setCampaignRule}>
                      <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                      <SelectContent>
                        {rules.map((r) => <SelectItem key={r.id} value={r.id}>{r.name} ({r.strategy})</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div><Label>{t('platform.redirectMessage')}</Label><Input name="redirectMessage" placeholder="Hello!" /></div>
                  <div className="sm:col-span-2"><Button type="submit" disabled={busy}>{t('common.save')}</Button></div>
                </form>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                {campaigns.length === 0 ? (
                  <p className="text-muted-foreground">{t('platform.noData')}</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t('platform.campaignName')}</TableHead>
                        <TableHead>{t('platform.whatsAppTarget')}</TableHead>
                        <TableHead>{t('platform.clicks')}</TableHead>
                        <TableHead>{t('platform.trackingLink')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {campaigns.map((c) => (
                        <TableRow key={c.id}>
                          <TableCell>{c.name}</TableCell>
                          <TableCell>{c.whatsAppCloudAccount?.phoneNumber ?? '—'}</TableCell>
                          <TableCell>{c._count?.redirectLogs ?? 0}</TableCell>
                          <TableCell>
                            <Button variant="outline" size="sm" onClick={() => copyTrackingLink(c.id)}>
                              {t('common.copy')}
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="routing" className="mt-4 space-y-4">
            <Card>
              <CardHeader><CardTitle>{t('platform.createRule')}</CardTitle></CardHeader>
              <CardContent>
                <form onSubmit={submitRule} className="grid gap-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div><Label>{t('platform.ruleName')}</Label><Input name="name" required /></div>
                    <div>
                      <Label>{t('platform.strategy')}</Label>
                      <Select value={ruleStrategy} onValueChange={setRuleStrategy}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {STRATEGIES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <Label>{t('platform.poolAccounts')}</Label>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {accounts.map((a) => (
                        <label key={a.id} className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
                          <input type="checkbox" name="accountIds" value={a.id} />
                          {a.name}
                        </label>
                      ))}
                    </div>
                  </div>
                  <Button type="submit" disabled={busy || accounts.length === 0}>{t('common.save')}</Button>
                </form>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                {rules.length === 0 ? (
                  <p className="text-muted-foreground">{t('platform.noData')}</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t('platform.ruleName')}</TableHead>
                        <TableHead>{t('platform.strategy')}</TableHead>
                        <TableHead>{t('platform.poolAccounts')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rules.map((r) => (
                        <TableRow key={r.id}>
                          <TableCell>{r.name}</TableCell>
                          <TableCell><Badge variant="secondary">{r.strategy}</Badge></TableCell>
                          <TableCell>{r.poolMembers.map((m) => m.account.name).join(', ') || '—'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="analytics" className="mt-4">
            <Card>
              <CardContent className="pt-6">
                {redirectLogs.length === 0 ? (
                  <p className="text-muted-foreground">{t('platform.noData')}</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t('platform.campaignName')}</TableHead>
                        <TableHead>Device</TableHead>
                        <TableHead>IP</TableHead>
                        <TableHead>UTM</TableHead>
                        <TableHead>Time</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {redirectLogs.map((log) => (
                        <TableRow key={log.id}>
                          <TableCell>{log.campaign?.name ?? '—'}</TableCell>
                          <TableCell>{log.device ?? '—'}</TableCell>
                          <TableCell>{log.ipAddress ?? '—'}</TableCell>
                          <TableCell>{log.utmSource ?? '—'}</TableCell>
                          <TableCell>{new Date(log.createdAt).toLocaleString()}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="webhooks" className="mt-4">
            <Card>
              <CardContent className="pt-6">
                {webhooks.length === 0 ? (
                  <p className="text-muted-foreground">{t('platform.noData')}</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Provider</TableHead>
                        <TableHead>Event</TableHead>
                        <TableHead>{t('platform.status')}</TableHead>
                        <TableHead>Time</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {webhooks.map((w) => (
                        <TableRow key={w.id}>
                          <TableCell>{w.provider}</TableCell>
                          <TableCell>{w.eventType}</TableCell>
                          <TableCell><Badge variant="secondary">{w.status}</Badge></TableCell>
                          <TableCell>{new Date(w.createdAt).toLocaleString()}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </AppShell>
  );
}
