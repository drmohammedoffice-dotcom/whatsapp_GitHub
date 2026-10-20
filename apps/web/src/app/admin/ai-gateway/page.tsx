'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, RefreshCw, Activity } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { fetchAdminAiGateway, probeAdminAiGateway, type AdminAiGatewayDashboard } from '@/lib/admin-api';

const STATUS_CLASS: Record<string, string> = {
  healthy: 'bg-emerald-100 text-emerald-800',
  busy: 'bg-amber-100 text-amber-800',
  rate_limited: 'bg-orange-100 text-orange-900',
  offline: 'bg-red-100 text-red-800',
  slow: 'bg-yellow-100 text-yellow-900',
  cooling_down: 'bg-sky-100 text-sky-900',
  disabled: 'bg-slate-200 text-slate-700',
  testing: 'bg-violet-100 text-violet-900',
  unavailable: 'bg-red-200 text-red-900',
};

function StatusBadge({ status }: { status: string }) {
  const cls = STATUS_CLASS[status] ?? 'bg-slate-100 text-slate-700';
  const label = status.replace(/_/g, ' ');
  return (
    <span className={`inline-flex rounded px-2 py-0.5 text-xs font-medium capitalize ${cls}`}>{label}</span>
  );
}

function formatCooldown(ms?: number) {
  if (!ms || ms <= 0) return '—';
  const sec = Math.ceil(ms / 1000);
  if (sec < 60) return `${sec}s`;
  return `${Math.ceil(sec / 60)}m`;
}

export default function AdminAiGatewayPage() {
  const [data, setData] = useState<AdminAiGatewayDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [probing, setProbing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const next = await fetchAdminAiGateway();
      setData(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const id = setInterval(() => void load(), 15_000);
    return () => clearInterval(id);
  }, [load]);

  async function onProbe() {
    setProbing(true);
    setError(null);
    try {
      const next = await probeAdminAiGateway();
      setData(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Probe failed');
    } finally {
      setProbing(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="AI Gateway"
        description="OpenRouter key manager — load balancing, failover, cooldown. Secrets never leave the server."
      />

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
        <Button size="sm" onClick={() => void onProbe()} disabled={probing}>
          {probing ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Activity className="mr-1.5 h-3.5 w-3.5" />}
          Probe now
        </Button>
        {data && (
          <span className="text-sm text-muted-foreground">
            {data.enabled
              ? `${data.keyCount} keys · ${data.strategy ?? 'least_used'} · ${data.baseUrl}`
              : 'Gateway disabled (no AI_API_KEY_N / OPENROUTER_KEYS configured)'}
          </span>
        )}
      </div>

      {error && <p className="mt-3 text-sm text-destructive">{error}</p>}

      {loading && !data ? (
        <div className="mt-6 flex gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading...
        </div>
      ) : data ? (
        <>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
            {[
              { label: 'Requests', value: data.totals.requests },
              { label: 'Successes', value: data.totals.successes },
              { label: 'Errors', value: data.totals.errors },
              { label: 'Failovers', value: data.totals.failovers },
              { label: 'Retries', value: data.totals.retriesScheduled },
              { label: 'Queued waits', value: data.totals.queuedWaits ?? 0 },
            ].map((card) => (
              <div key={card.label} className="rounded-lg border px-4 py-3">
                <div className="text-xs text-muted-foreground">{card.label}</div>
                <div className="mt-1 text-2xl font-semibold tabular-nums">{card.value}</div>
              </div>
            ))}
          </div>

          <div className="mt-6 overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Key</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Success %</TableHead>
                  <TableHead>Fail %</TableHead>
                  <TableHead>Today</TableHead>
                  <TableHead>RPM</TableHead>
                  <TableHead>Avg latency</TableHead>
                  <TableHead>Cooldown</TableHead>
                  <TableHead>Last success</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.keys.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-muted-foreground">
                      No platform keys loaded. Set AI_API_KEY_1…N or OPENROUTER_KEYS in server environment.
                    </TableCell>
                  </TableRow>
                ) : (
                  data.keys.map((k) => (
                    <TableRow key={k.id}>
                      <TableCell className="font-medium">{k.label}</TableCell>
                      <TableCell>
                        <StatusBadge status={k.status} />
                      </TableCell>
                      <TableCell className="tabular-nums">{k.successRate ?? 0}%</TableCell>
                      <TableCell className="tabular-nums">{k.failureRate ?? 0}%</TableCell>
                      <TableCell className="tabular-nums">{k.requestsToday ?? k.requests}</TableCell>
                      <TableCell className="tabular-nums">{k.requestsLastMinute ?? '—'}</TableCell>
                      <TableCell className="tabular-nums">{k.avgLatencyMs ? `${k.avgLatencyMs} ms` : '—'}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatCooldown(k.cooldownRemainingMs)}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {k.lastSuccessAt
                          ? new Date(k.lastSuccessAt).toLocaleString()
                          : k.lastUsedAt
                            ? new Date(k.lastUsedAt).toLocaleString()
                            : '—'}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Updated {new Date(data.updatedAt).toLocaleString()}. API key values are never exposed to this page.
          </p>
        </>
      ) : null}
    </div>
  );
}
