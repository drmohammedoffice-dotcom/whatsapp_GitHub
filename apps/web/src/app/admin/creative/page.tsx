'use client';

import { useCallback, useEffect, useState } from 'react';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { getAdminToken } from '@/lib/admin-api';
import { API_URL } from '@/lib/utils';

type Health = Record<string, { provider?: string; status: string }>;
type ModelRow = {
  id: string;
  provider: string;
  modelId: string;
  mediaType: string;
  enabled: boolean;
  priority: number;
  isDefault: boolean;
  isFallback: boolean;
  maxResolution?: string | null;
};

async function adminCreative<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getAdminToken();
  const response = await fetch(`${API_URL}/api/v1/admin/creative${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error((body as { message?: string }).message ?? `Request failed (${response.status})`);
  }
  return response.json() as Promise<T>;
}

export default function AdminCreativePage() {
  const [health, setHealth] = useState<Health | null>(null);
  const [models, setModels] = useState<ModelRow[]>([]);
  const [defaultImage, setDefaultImage] = useState('');
  const [defaultVideo, setDefaultVideo] = useState('');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [h, m, s] = await Promise.all([
        adminCreative<Health>('/health'),
        adminCreative<ModelRow[]>('/models'),
        adminCreative<{ defaultImageModel?: string | null; defaultVideoModel?: string | null }>('/settings'),
      ]);
      setHealth(h);
      setModels(m);
      setDefaultImage(s.defaultImageModel || '');
      setDefaultVideo(s.defaultVideoModel || '');
    } catch (err) {
      setError(String((err as Error).message));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-6 p-6">
      <PageHeader title="Creative Studio models" description="No API keys are stored in model configuration." />
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="grid gap-3 md:grid-cols-2">
        {health &&
          Object.entries(health).map(([key, row]) => (
            <p key={key} className="rounded border p-3 text-sm">
              {key}: {row.status}
            </p>
          ))}
      </div>
      <div className="flex flex-wrap gap-3">
        <div>
          <Label>Default image model</Label>
          <Input value={defaultImage} onChange={(e) => setDefaultImage(e.target.value)} />
        </div>
        <div>
          <Label>Default video model</Label>
          <Input value={defaultVideo} onChange={(e) => setDefaultVideo(e.target.value)} />
        </div>
        <Button
          onClick={() =>
            adminCreative('/settings', {
              method: 'PATCH',
              body: JSON.stringify({ defaultImageModel: defaultImage, defaultVideoModel: defaultVideo }),
            }).then(() => load())
          }
        >
          Save
        </Button>
      </div>
      <div className="space-y-2">
        {models.map((model) => (
          <div key={model.id} className="flex items-center justify-between rounded border p-3 text-sm">
            <span>
              {model.provider} / {model.modelId} ({model.mediaType})
            </span>
            <Switch
              checked={model.enabled}
              onCheckedChange={(enabled) =>
                adminCreative(`/models/${model.id}`, { method: 'PATCH', body: JSON.stringify({ enabled }) }).then(() => load())
              }
            />
          </div>
        ))}
      </div>
    </div>
  );
}
