import { Injectable, Logger } from '@nestjs/common';
import { AiGatewayConfigService } from './ai-gateway-config';
import { AiGatewayHealthService } from './ai-gateway-health.service';
import { AiGatewayMetricsService } from './ai-gateway-metrics.service';
import { AiGatewayRateLimiterService } from './ai-gateway-rate-limiter.service';
import type { AiGatewayKeySlot, AiGatewayLoadBalanceStrategy } from './ai-gateway.types';

/**
 * Selects the next platform API key using a configurable strategy.
 * Never receives or logs raw secrets — works on slot metadata only.
 */
@Injectable()
export class AiGatewayLoadBalancerService {
  private readonly logger = new Logger(AiGatewayLoadBalancerService.name);
  private roundRobinCursor = 0;
  private weightedCursor = 0;

  constructor(
    private readonly gatewayConfig: AiGatewayConfigService,
    private readonly health: AiGatewayHealthService,
    private readonly metrics: AiGatewayMetricsService,
    private readonly rateLimiter: AiGatewayRateLimiterService,
  ) {}

  /**
   * Order usable keys for this request. Empty if none are currently healthy.
   * Excludes keys already tried in `excludeIds`.
   */
  selectOrder(slots: AiGatewayKeySlot[], excludeIds: Set<string> = new Set()): AiGatewayKeySlot[] {
    const cfg = this.gatewayConfig.get();
    const candidates = slots.filter((slot) => {
      if (excludeIds.has(slot.id)) return false;
      if (!this.health.canUse(slot)) return false;
      if (!this.rateLimiter.canAccept(slot.id)) {
        this.logger.log(`Skipping ${slot.label} (near rate limit)`);
        return false;
      }
      return true;
    });

    if (!candidates.length) return [];

    switch (cfg.strategy) {
      case 'round_robin':
        return this.orderRoundRobin(candidates);
      case 'weighted_round_robin':
        return this.orderWeighted(candidates);
      case 'least_used':
      default:
        return this.orderLeastUsed(candidates);
    }
  }

  strategy(): AiGatewayLoadBalanceStrategy {
    return this.gatewayConfig.get().strategy;
  }

  private orderRoundRobin(candidates: AiGatewayKeySlot[]): AiGatewayKeySlot[] {
    if (!candidates.length) return [];
    const start = this.roundRobinCursor % candidates.length;
    this.roundRobinCursor = (this.roundRobinCursor + 1) % Number.MAX_SAFE_INTEGER;
    return [...candidates.slice(start), ...candidates.slice(0, start)];
  }

  private orderWeighted(candidates: AiGatewayKeySlot[]): AiGatewayKeySlot[] {
    const expanded: AiGatewayKeySlot[] = [];
    for (const slot of candidates) {
      const w = Math.max(1, Math.min(20, slot.weight || 1));
      for (let i = 0; i < w; i += 1) expanded.push(slot);
    }
    if (!expanded.length) return candidates;
    const start = this.weightedCursor % expanded.length;
    this.weightedCursor = (this.weightedCursor + 1) % Number.MAX_SAFE_INTEGER;
    const first = expanded[start]!;
    const rest = candidates.filter((s) => s.id !== first.id);
    return [first, ...this.orderLeastUsed(rest)];
  }

  private orderLeastUsed(candidates: AiGatewayKeySlot[]): AiGatewayKeySlot[] {
    return [...candidates].sort((a, b) => {
      const pa = this.rateLimiter.pressure(a.id);
      const pb = this.rateLimiter.pressure(b.id);
      if (pa !== pb) return pa - pb;
      const ma = this.metrics.getRuntime(a.id);
      const mb = this.metrics.getRuntime(b.id);
      if (ma.requests !== mb.requests) return ma.requests - mb.requests;
      if (ma.successes !== mb.successes) return ma.successes - mb.successes;
      const la = ma.latencyCount ? ma.latencySumMs / ma.latencyCount : 0;
      const lb = mb.latencyCount ? mb.latencySumMs / mb.latencyCount : 0;
      return la - lb;
    });
  }
}
