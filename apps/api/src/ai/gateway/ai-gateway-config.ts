import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AiGatewayLoadBalanceStrategy } from './ai-gateway.types';

export type AiGatewayRuntimeConfig = {
  strategy: AiGatewayLoadBalanceStrategy;
  /** Base cooldown after a key fails (ms). Doubles each consecutive failure. */
  cooldownBaseMs: number;
  /** Cap for exponential cooldown. */
  cooldownMaxMs: number;
  /** Failures before opening circuit / entering cooldown. */
  circuitFailureThreshold: number;
  /** Max automatic key switches for a single chat request. */
  maxRetries: number;
  /** Health probe interval. */
  healthCheckIntervalMs: number;
  /** Request timeout for chat completions (ms). */
  requestTimeoutMs: number;
  /** Soft rate-limit thresholds per key. */
  rateLimitPerMinute: number;
  rateLimitPerHour: number;
  rateLimitPerDay: number;
  /** When every key is cooling down, wait up to this long for one to recover. */
  queueWaitMs: number;
  /** Poll interval while waiting in the queue. */
  queuePollMs: number;
  /** Latency above this marks a key as "slow". */
  slowMs: number;
};

function intEnv(config: ConfigService, name: string, fallback: number): number {
  const raw = config.get<string | number>(name) ?? process.env[name];
  const n = typeof raw === 'number' ? raw : Number(String(raw ?? '').trim());
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

function strategyEnv(config: ConfigService): AiGatewayLoadBalanceStrategy {
  const raw = (
    config.get<string>('AI_GATEWAY_STRATEGY') ??
    process.env.AI_GATEWAY_STRATEGY ??
    'least_used'
  )
    .trim()
    .toLowerCase()
    .replace(/-/g, '_');
  if (raw === 'round_robin' || raw === 'weighted_round_robin' || raw === 'least_used') {
    return raw;
  }
  return 'least_used';
}

/**
 * Central OpenRouter / AI Gateway runtime configuration.
 * All tunables come from env — never hardcode secrets here.
 */
@Injectable()
export class AiGatewayConfigService {
  constructor(private readonly config: ConfigService) {}

  get(): AiGatewayRuntimeConfig {
    return {
      strategy: strategyEnv(this.config),
      cooldownBaseMs: intEnv(this.config, 'AI_GATEWAY_COOLDOWN_MS', 5 * 60_000),
      cooldownMaxMs: intEnv(this.config, 'AI_GATEWAY_COOLDOWN_MAX_MS', 40 * 60_000),
      circuitFailureThreshold: intEnv(this.config, 'AI_GATEWAY_CIRCUIT_FAILURES', 1),
      maxRetries: intEnv(this.config, 'AI_GATEWAY_MAX_RETRIES', 3),
      healthCheckIntervalMs: intEnv(this.config, 'AI_GATEWAY_HEALTH_INTERVAL_MS', 60_000),
      requestTimeoutMs: intEnv(this.config, 'AI_GATEWAY_TIMEOUT_MS', 60_000),
      rateLimitPerMinute: intEnv(this.config, 'AI_GATEWAY_RPM', 60),
      rateLimitPerHour: intEnv(this.config, 'AI_GATEWAY_RPH', 3_000),
      rateLimitPerDay: intEnv(this.config, 'AI_GATEWAY_RPD', 50_000),
      queueWaitMs: intEnv(this.config, 'AI_GATEWAY_QUEUE_WAIT_MS', 30_000),
      queuePollMs: intEnv(this.config, 'AI_GATEWAY_QUEUE_POLL_MS', 500),
      slowMs: intEnv(this.config, 'AI_GATEWAY_SLOW_MS', 8_000),
    };
  }
}
