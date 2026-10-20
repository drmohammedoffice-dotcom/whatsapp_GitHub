export type AiGatewayLoadBalanceStrategy =
  | 'round_robin'
  | 'least_used'
  | 'weighted_round_robin';

export type AiGatewayKeyHealth =
  | 'healthy'
  | 'cooling_down'
  | 'disabled'
  | 'testing'
  | 'rate_limited'
  | 'unavailable'
  | 'busy'
  | 'slow'
  | 'offline';

export type AiGatewayKeySlot = {
  /** Stable public id, e.g. api-1 — never the secret */
  id: string;
  /** Human label for logs/UI, e.g. API 1 */
  label: string;
  /** 1-based index from env (AI_API_KEY_N / OPENROUTER_KEYS) */
  index: number;
  /** Relative weight for weighted_round_robin (default 1) */
  weight: number;
  /** Secret — never log or serialize */
  apiKey: string;
};

export type AiGatewayErrorClass =
  | 'rate_limited'
  | 'timeout'
  | 'server_error'
  | 'network'
  | 'auth'
  | 'prompt_too_large'
  | 'credits'
  | 'bad_request'
  | 'unknown';

export type ClassifiedGatewayError = {
  class: AiGatewayErrorClass;
  retryable: boolean;
  status?: number;
  label: string;
  message: string;
};

export type AiGatewayChatRequest = {
  model: string;
  messages: Array<{ role: string; content: unknown; name?: string }>;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  json?: boolean;
  /** Keep retrying with backoff until a key succeeds (auto-reply path). */
  persistUntilSuccess?: boolean;
  /** Optional correlation for logs */
  correlationId?: string;
};

export type AiGatewayChatResult = {
  content: string;
  promptTokens: number;
  completionTokens: number;
  raw: unknown;
  model: string;
  keyId: string;
  keyLabel: string;
  latencyMs: number;
};

export type AiGatewayKeyMetricsSnapshot = {
  id: string;
  label: string;
  index: number;
  status: AiGatewayKeyHealth;
  requests: number;
  successes: number;
  errors: number;
  rateLimited: number;
  avgLatencyMs: number;
  successRate: number;
  failureRate: number;
  requestsToday: number;
  requestsLastMinute: number;
  requestsLastHour: number;
  lastSuccessAt: string | null;
  lastUsedAt: string | null;
  lastErrorAt: string | null;
  lastErrorLabel: string | null;
  circuitOpenUntil: string | null;
  cooldownUntil: string | null;
  cooldownRemainingMs: number;
  consecutiveFailures: number;
};

export type AiGatewayDashboard = {
  enabled: boolean;
  baseUrl: string;
  strategy: AiGatewayLoadBalanceStrategy;
  keyCount: number;
  preferredKeyId: string | null;
  updatedAt: string;
  keys: AiGatewayKeyMetricsSnapshot[];
  totals: {
    requests: number;
    successes: number;
    errors: number;
    failovers: number;
    retriesScheduled: number;
    queuedWaits: number;
  };
};

/** @deprecated Prefer AiGatewayConfigService — kept for tests/back-compat. */
export const GATEWAY_RETRY_DELAYS_MS = [500, 1_500, 3_000, 8_000] as const;
export const GATEWAY_CIRCUIT_FAILURE_THRESHOLD = 1;
export const GATEWAY_CIRCUIT_COOLDOWN_MS = 5 * 60_000;
export const GATEWAY_SLOW_MS = 8_000;
export const GATEWAY_HEALTH_PROBE_INTERVAL_MS = 60_000;
