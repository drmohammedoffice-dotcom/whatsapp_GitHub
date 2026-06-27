'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Loader2, PlugZap } from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { useTranslation } from '@/components/providers/locale-provider';
import { AlertBanner } from '@/components/shared/alert-banner';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { api, parseApiError } from '@/lib/utils';

type ProviderType = 'OPENAI_COMPATIBLE' | 'OPENROUTER' | 'GROQ' | 'GEMINI' | 'CUSTOM';

type ProviderConfig = {
  provider: ProviderType;
  baseUrl: string;
  model: string | null;
  temperature: number;
  maxTokens: number;
  topP: number;
  enableStreaming: boolean;
  enableMemory: boolean;
  enableHumanHandover: boolean;
  enableVision: boolean;
  enableProductSearch: boolean;
  enableImageSending: boolean;
  hasApiKey: boolean;
  lastTestAt?: string | null;
  lastTestOk?: boolean | null;
  lastTestMessage?: string | null;
};

const PROVIDER_DEFAULTS: Record<ProviderType, { baseUrl: string; model: string }> = {
  OPENAI_COMPATIBLE: { baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
  OPENROUTER: { baseUrl: 'https://openrouter.ai/api/v1', model: 'openai/gpt-4o-mini' },
  GROQ: { baseUrl: 'https://api.groq.com/openai/v1', model: 'llama-3.3-70b-versatile' },
  GEMINI: { baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', model: 'gemini-2.0-flash' },
  CUSTOM: { baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
};

export default function AiProvidersPage() {
  const { t } = useTranslation();
  const [config, setConfig] = useState<ProviderConfig | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [models, setModels] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [loadingModels, setLoadingModels] = useState(false);

  const providerLabels = useMemo(
    () => ({
      OPENAI_COMPATIBLE: t('aiProviders.providerOpenAi'),
      OPENROUTER: t('aiProviders.providerOpenRouter'),
      GROQ: t('aiProviders.providerGroq'),
      GEMINI: t('aiProviders.providerGemini'),
      CUSTOM: t('aiProviders.providerCustom'),
    }),
    [t],
  );

  useEffect(() => {
    api<ProviderConfig>('/ai/providers')
      .then((data) => {
        setConfig({
          ...data,
          provider: data.provider ?? 'OPENAI_COMPATIBLE',
          baseUrl: data.baseUrl || PROVIDER_DEFAULTS.OPENAI_COMPATIBLE.baseUrl,
          model: data.model ?? PROVIDER_DEFAULTS.OPENAI_COMPATIBLE.model,
        });
      })
      .catch((err) => setLoadError(parseApiError(err)))
      .finally(() => setLoading(false));
  }, []);

  function updateConfig(patch: Partial<ProviderConfig>) {
    setConfig((prev) => (prev ? { ...prev, ...patch } : prev));
  }

  function onProviderChange(value: ProviderType) {
    const defaults = PROVIDER_DEFAULTS[value];
    updateConfig({ provider: value, baseUrl: defaults.baseUrl, model: defaults.model });
    setModels([]);
  }

  async function loadModels() {
    if (!config) return;
    setLoadingModels(true);
    setError(null);
    try {
      const result = await api<{ models: string[] }>('/ai/providers/models', {
        method: 'POST',
        body: JSON.stringify({
          provider: config.provider,
          baseUrl: config.baseUrl,
          model: config.model,
          ...(apiKey ? { apiKey } : {}),
        }),
      });
      setModels(result.models);
      if (result.models[0] && !config.model) updateConfig({ model: result.models[0] });
    } catch (err) {
      setError(parseApiError(err));
    } finally {
      setLoadingModels(false);
    }
  }

  async function testConnection() {
    if (!config) return;
    setTesting(true);
    setError(null);
    setTestResult(null);
    try {
      const result = await api<{ ok: boolean; message: string }>('/ai/providers/test', {
        method: 'POST',
        body: JSON.stringify({
          provider: config.provider,
          baseUrl: config.baseUrl,
          model: config.model,
          ...(apiKey ? { apiKey } : {}),
        }),
      });
      setTestResult(result);
      if (result.ok) setSuccess(t('aiProviders.connected'));
    } catch (err) {
      setError(parseApiError(err));
    } finally {
      setTesting(false);
    }
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!config) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const saved = await api<ProviderConfig>('/ai/providers', {
        method: 'POST',
        body: JSON.stringify({
          provider: config.provider,
          baseUrl: config.baseUrl,
          model: config.model,
          temperature: config.temperature,
          maxTokens: config.maxTokens,
          topP: config.topP,
          enableStreaming: config.enableStreaming,
          enableMemory: config.enableMemory,
          enableHumanHandover: config.enableHumanHandover,
          enableVision: config.enableVision,
          enableProductSearch: config.enableProductSearch,
          enableImageSending: config.enableImageSending,
          ...(apiKey ? { apiKey } : {}),
        }),
      });
      setConfig(saved);
      setApiKey('');
      setSuccess(t('aiProviders.saved'));
    } catch (err) {
      setError(parseApiError(err));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <AppShell>
        <PageHeader title={t('aiProviders.title')} description={t('aiProviders.description')} />
        <div className="mt-6 flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t('common.loading')}
        </div>
      </AppShell>
    );
  }

  if (!config) {
    return (
      <AppShell>
        <PageHeader title={t('aiProviders.title')} description={t('aiProviders.description')} />
        <AlertBanner className="mt-6" message={loadError ?? t('errors.requestFailed')} />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageHeader title={t('aiProviders.title')} description={t('aiProviders.description')} />

      <div className="mt-4 space-y-3">
        {error && <AlertBanner message={error} onDismiss={() => setError(null)} />}
        {success && <AlertBanner variant="success" message={success} onDismiss={() => setSuccess(null)} />}
        {testResult && !testResult.ok && <AlertBanner message={testResult.message} onDismiss={() => setTestResult(null)} />}
        {testResult?.ok && <AlertBanner variant="success" message={testResult.message} onDismiss={() => setTestResult(null)} />}
      </div>

      <Card className="mt-6 border-0 shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <PlugZap className="h-5 w-5 text-primary" />
            {t('aiProviders.title')}
          </CardTitle>
          <CardDescription>{t('aiProviders.description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={save} className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>{t('aiProviders.provider')}</Label>
                <Select value={config.provider} onValueChange={(v) => onProviderChange(v as ProviderType)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(providerLabels) as ProviderType[]).map((key) => (
                      <SelectItem key={key} value={key}>
                        {providerLabels[key]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="apiKey">{t('aiProviders.apiKey')}</Label>
                <Input
                  id="apiKey"
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder={config.hasApiKey ? '••••••••••••••••' : t('aiProviders.apiKeyPlaceholder')}
                  autoComplete="off"
                />
                <p className="text-xs text-muted-foreground">{t('aiProviders.apiKeyHint')}</p>
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="baseUrl">{t('aiProviders.baseUrl')}</Label>
                <Input id="baseUrl" value={config.baseUrl} onChange={(e) => updateConfig({ baseUrl: e.target.value })} required />
              </div>

              <div className="space-y-2">
                <Label htmlFor="model">{t('aiProviders.model')}</Label>
                <div className="flex gap-2">
                  {models.length > 0 ? (
                    <Select value={config.model ?? ''} onValueChange={(v) => updateConfig({ model: v })}>
                      <SelectTrigger className="flex-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {models.map((model) => (
                          <SelectItem key={model} value={model}>
                            {model}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input id="model" className="flex-1" value={config.model ?? ''} onChange={(e) => updateConfig({ model: e.target.value })} required />
                  )}
                  <Button type="button" variant="outline" onClick={() => void loadModels()} disabled={loadingModels}>
                    {loadingModels ? <Loader2 className="h-4 w-4 animate-spin" /> : t('aiProviders.loadModels')}
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="maxTokens">{t('aiProviders.maxTokens')}</Label>
                <Input id="maxTokens" type="number" min={1} max={128000} value={config.maxTokens} onChange={(e) => updateConfig({ maxTokens: Number(e.target.value) })} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="temperature">{t('aiProviders.temperature')}</Label>
                <Input id="temperature" type="range" min={0} max={2} step={0.05} value={config.temperature} onChange={(e) => updateConfig({ temperature: Number(e.target.value) })} />
                <p className="text-xs text-muted-foreground">{config.temperature}</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="topP">{t('aiProviders.topP')}</Label>
                <Input id="topP" type="number" min={0} max={1} step={0.05} value={config.topP} onChange={(e) => updateConfig({ topP: Number(e.target.value) })} />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {(
                [
                  ['enableStreaming', t('aiProviders.enableStreaming')],
                  ['enableMemory', t('aiProviders.enableMemory')],
                  ['enableHumanHandover', t('aiProviders.enableHumanHandover')],
                  ['enableVision', t('aiProviders.enableVision')],
                  ['enableProductSearch', t('aiProviders.enableProductSearch')],
                  ['enableImageSending', t('aiProviders.enableImageSending')],
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="flex items-center justify-between rounded-lg border bg-muted/20 px-4 py-3 text-sm">
                  <span>{label}</span>
                  <Switch checked={config[key]} onCheckedChange={(checked) => updateConfig({ [key]: checked })} />
                </label>
              ))}
            </div>

            {config.lastTestAt && (
              <p className="text-xs text-muted-foreground">
                {t('aiProviders.lastTest')}: {new Date(config.lastTestAt).toLocaleString()} — {config.lastTestMessage}
              </p>
            )}

            <div className="flex flex-wrap gap-3">
              <Button type="button" variant="outline" onClick={() => void testConnection()} disabled={testing}>
                {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : t('aiProviders.testConnection')}
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? t('aiProviders.saving') : t('aiProviders.saveSettings')}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </AppShell>
  );
}
