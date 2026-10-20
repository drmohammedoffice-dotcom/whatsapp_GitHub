import { AiGatewayConfigService } from '../ai-gateway-config';
import type { AiGatewayRuntimeConfig as Cfg } from '../ai-gateway-config';
import { AiGatewayLoadBalancerService } from '../ai-gateway-load-balancer.service';
import { AiGatewayMetricsService } from '../ai-gateway-metrics.service';
import { AiGatewayRateLimiterService } from '../ai-gateway-rate-limiter.service';
import { classifyGatewayError } from '../ai-gateway-error';
import type { AiGatewayKeySlot } from '../ai-gateway.types';

function mockConfig(overrides: Partial<Cfg> = {}): AiGatewayConfigService {
  const base: Cfg = {
    strategy: 'least_used',
    cooldownBaseMs: 5 * 60_000,
    cooldownMaxMs: 40 * 60_000,
    circuitFailureThreshold: 1,
    maxRetries: 3,
    healthCheckIntervalMs: 60_000,
    requestTimeoutMs: 60_000,
    rateLimitPerMinute: 5,
    rateLimitPerHour: 100,
    rateLimitPerDay: 1000,
    queueWaitMs: 1_000,
    queuePollMs: 50,
    slowMs: 8_000,
    ...overrides,
  };
  return { get: () => base } as AiGatewayConfigService;
}

function slot(index: number, weight = 1): AiGatewayKeySlot {
  return {
    id: `api-${index}`,
    label: `API ${index}`,
    index,
    weight,
    apiKey: `secret-${index}`,
  };
}

describe('classifyGatewayError', () => {
  it('marks 429 / 5xx / network / auth as retryable', () => {
    expect(classifyGatewayError({ response: { status: 429 } }).retryable).toBe(true);
    expect(classifyGatewayError({ response: { status: 503 } }).retryable).toBe(true);
    expect(classifyGatewayError({ code: 'ECONNREFUSED', message: 'connect' }).retryable).toBe(true);
    expect(classifyGatewayError({ response: { status: 401 } }).class).toBe('auth');
  });

  it('does not retry prompt-too-large', () => {
    const err = {
      response: { status: 402, data: { error: { message: 'Your prompt is too large for this model' } } },
      message: 'Your prompt is too large for this model',
    };
    const c = classifyGatewayError(err);
    expect(c.retryable).toBe(false);
    expect(c.class).toBe('prompt_too_large');
  });

  it('treats can-only-afford 402 as retryable credits', () => {
    const err = {
      response: {
        status: 402,
        data: {
          error: {
            message:
              'This request requires more credits, or fewer max_tokens. You requested up to 1024 tokens, but can only afford 962.',
          },
        },
      },
      message: 'Request failed with status code 402',
    };
    const c = classifyGatewayError(err);
    expect(c.retryable).toBe(true);
    expect(c.class).toBe('credits');
  });

  it('marks invalid model 400 as non-retryable bad_request', () => {
    const err = {
      response: { status: 400, data: { error: { message: 'gemini-3-flash is not a valid model ID' } } },
      message: 'Request failed with status code 400',
    };
    const c = classifyGatewayError(err);
    expect(c.retryable).toBe(false);
    expect(c.class).toBe('bad_request');
  });
});

describe('AiGatewayRateLimiterService', () => {
  it('tracks rpm and blocks near limit', () => {
    const cfg = mockConfig({ rateLimitPerMinute: 3, rateLimitPerHour: 100, rateLimitPerDay: 1000 });
    const limiter = new AiGatewayRateLimiterService(cfg);
    const now = Date.now();
    limiter.reserve('api-1', now);
    limiter.reserve('api-1', now + 1);
    expect(limiter.canAccept('api-1', now + 2)).toBe(true);
    limiter.reserve('api-1', now + 2);
    expect(limiter.canAccept('api-1', now + 3)).toBe(false);
    expect(limiter.usage('api-1', now + 3).rpm).toBe(3);
  });
});

describe('AiGatewayLoadBalancerService', () => {
  function build(strategy: Cfg['strategy']) {
    const cfg = mockConfig({ strategy, rateLimitPerMinute: 1000 });
    const rateLimiter = new AiGatewayRateLimiterService(cfg);
    const metrics = new AiGatewayMetricsService(cfg, rateLimiter);
    const health = {
      canUse: () => true,
    } as unknown as import('../ai-gateway-health.service').AiGatewayHealthService;
    const balancer = new AiGatewayLoadBalancerService(cfg, health, metrics, rateLimiter);
    return { balancer, metrics, rateLimiter };
  }

  it('least_used prefers the key with fewer requests', () => {
    const { balancer, metrics, rateLimiter } = build('least_used');
    rateLimiter.reserve('api-1');
    metrics.recordAttempt('api-1');
    const order = balancer.selectOrder([slot(1), slot(2)]);
    expect(order[0]?.id).toBe('api-2');
  });

  it('round_robin rotates across keys', () => {
    const { balancer } = build('round_robin');
    const slots = [slot(1), slot(2), slot(3)];
    const first = balancer.selectOrder(slots)[0]?.id;
    const second = balancer.selectOrder(slots)[0]?.id;
    const third = balancer.selectOrder(slots)[0]?.id;
    expect(new Set([first, second, third]).size).toBe(3);
  });

  it('respects exclude set for failover', () => {
    const { balancer } = build('least_used');
    const order = balancer.selectOrder([slot(1), slot(2)], new Set(['api-1']));
    expect(order.map((s) => s.id)).toEqual(['api-2']);
  });
});

describe('exponential cooldown', () => {
  it('doubles each failure up to max', () => {
    const cfg = mockConfig({ cooldownBaseMs: 5 * 60_000, cooldownMaxMs: 40 * 60_000 });
    const cooldownMsFor = (consecutiveFailures: number) => {
      const c = cfg.get();
      const exp = Math.max(0, consecutiveFailures - 1);
      return Math.min(c.cooldownMaxMs, c.cooldownBaseMs * Math.pow(2, exp));
    };
    expect(cooldownMsFor(1)).toBe(5 * 60_000);
    expect(cooldownMsFor(2)).toBe(10 * 60_000);
    expect(cooldownMsFor(3)).toBe(20 * 60_000);
    expect(cooldownMsFor(4)).toBe(40 * 60_000);
    expect(cooldownMsFor(5)).toBe(40 * 60_000);
  });
});
