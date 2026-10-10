import { Injectable } from '@nestjs/common';
import { AiGatewayConfigService } from './ai-gateway-config';
import { AiGatewayRateLimiterService } from './ai-gateway-rate-limiter.service';
import type { AiGatewayKeyHealth, AiGatewayKeyMetricsSnapshot } from './ai-gateway.types';

export type KeyRuntime = {
  status: AiGatewayKeyHealth;
  requests: number;
  successes: number;
  errors: number;
  rateLimited: number;
  latencySumMs: number;
  latencyCount: number;
  lastUsedAt: Date | null;
  lastSuccessAt: Date | null;
  lastErrorAt: Date | null;
  lastErrorLabel: string | null;
  consecutiveFailures: number;
  circuitOpenUntil: Date | null;
  disabled: boolean;
};

@Injectable()
export class AiGatewayMetricsService {
  private readonly byKey = new Map<string, KeyRuntime>();
  private failovers = 0;
  private retriesScheduled = 0;
  private queuedWaits = 0;

  constructor(
    private readonly gatewayConfig: AiGatewayConfigService,
    private readonly rateLimiter: AiGatewayRateLimiterService,
  ) {}

  ensure(id: string): KeyRuntime {
    let row = this.byKey.get(id);
    if (!row) {
      row = {
        status: 'healthy',
        requests: 0,
        successes: 0,
        errors: 0,
        rateLimited: 0,
        latencySumMs: 0,
        latencyCount: 0,
        lastUsedAt: null,
        lastSuccessAt: null,
        lastErrorAt: null,
        lastErrorLabel: null,
        consecutiveFailures: 0,
        circuitOpenUntil: null,
        disabled: false,
      };
      this.byKey.set(id, row);
    }
    return row;
  }

  recordAttempt(id: string) {
    const row = this.ensure(id);
    row.requests += 1;
    row.lastUsedAt = new Date();
  }

  recordSuccess(id: string, latencyMs: number) {
    const cfg = this.gatewayConfig.get();
    const row = this.ensure(id);
    row.successes += 1;
    row.latencySumMs += latencyMs;
    row.latencyCount += 1;
    row.consecutiveFailures = 0;
    row.circuitOpenUntil = null;
    row.status = latencyMs >= cfg.slowMs ? 'slow' : 'healthy';
    row.lastUsedAt = new Date();
    row.lastSuccessAt = new Date();
  }

  recordError(id: string, label: string, status: AiGatewayKeyHealth) {
    const row = this.ensure(id);
    row.errors += 1;
    row.lastErrorAt = new Date();
    row.lastErrorLabel = label;
    row.status = status;
    if (status === 'rate_limited') row.rateLimited += 1;
    row.consecutiveFailures += 1;
  }

  setStatus(id: string, status: AiGatewayKeyHealth) {
    this.ensure(id).status = status;
  }

  setCircuit(id: string, openUntil: Date | null, consecutiveFailures?: number) {
    const row = this.ensure(id);
    row.circuitOpenUntil = openUntil;
    if (typeof consecutiveFailures === 'number') row.consecutiveFailures = consecutiveFailures;
    if (openUntil && openUntil.getTime() > Date.now()) {
      row.status = 'cooling_down';
    }
  }

  setDisabled(id: string, disabled: boolean) {
    const row = this.ensure(id);
    row.disabled = disabled;
    if (disabled) row.status = 'disabled';
  }

  getRuntime(id: string): KeyRuntime {
    return this.ensure(id);
  }

  incrementFailover() {
    this.failovers += 1;
  }

  incrementRetryScheduled() {
    this.retriesScheduled += 1;
  }

  incrementQueuedWait() {
    this.queuedWaits += 1;
  }

  snapshot(id: string, label: string, index: number): AiGatewayKeyMetricsSnapshot {
    const row = this.ensure(id);
    const now = Date.now();
    let status = row.status;
    if (row.disabled) status = 'disabled';
    else if (row.circuitOpenUntil && row.circuitOpenUntil.getTime() > now) status = 'cooling_down';

    const totalDecided = row.successes + row.errors;
    const usage = this.rateLimiter.usage(id, now);
    const cooldownRemainingMs =
      row.circuitOpenUntil && row.circuitOpenUntil.getTime() > now
        ? row.circuitOpenUntil.getTime() - now
        : 0;

    return {
      id,
      label,
      index,
      status,
      requests: row.requests,
      successes: row.successes,
      errors: row.errors,
      rateLimited: row.rateLimited,
      avgLatencyMs: row.latencyCount ? Math.round(row.latencySumMs / row.latencyCount) : 0,
      successRate: totalDecided ? Math.round((row.successes / totalDecided) * 1000) / 10 : 0,
      failureRate: totalDecided ? Math.round((row.errors / totalDecided) * 1000) / 10 : 0,
      requestsToday: usage.rpd,
      requestsLastMinute: usage.rpm,
      requestsLastHour: usage.rph,
      lastSuccessAt: row.lastSuccessAt?.toISOString() ?? null,
      lastUsedAt: row.lastUsedAt?.toISOString() ?? null,
      lastErrorAt: row.lastErrorAt?.toISOString() ?? null,
      lastErrorLabel: row.lastErrorLabel,
      circuitOpenUntil: row.circuitOpenUntil?.toISOString() ?? null,
      cooldownUntil: row.circuitOpenUntil?.toISOString() ?? null,
      cooldownRemainingMs,
      consecutiveFailures: row.consecutiveFailures,
    };
  }

  totals() {
    let requests = 0;
    let successes = 0;
    let errors = 0;
    for (const row of this.byKey.values()) {
      requests += row.requests;
      successes += row.successes;
      errors += row.errors;
    }
    return {
      requests,
      successes,
      errors,
      failovers: this.failovers,
      retriesScheduled: this.retriesScheduled,
      queuedWaits: this.queuedWaits,
    };
  }
}
