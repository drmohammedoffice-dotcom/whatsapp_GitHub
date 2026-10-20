import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import axios from 'axios';
import { AiProviderType } from '@watsapp/database';
import { AiProviderConfigService } from '../ai-provider-config.service';
import { AiGatewayConfigService } from './ai-gateway-config';
import { classifyGatewayError, healthFromErrorClass } from './ai-gateway-error';
import { AiGatewayKeyPoolService } from './ai-gateway-key-pool.service';
import { AiGatewayMetricsService } from './ai-gateway-metrics.service';
import type { AiGatewayKeySlot } from './ai-gateway.types';

/**
 * Circuit breaker + exponential cooldown + background health probes.
 */
@Injectable()
export class AiGatewayHealthService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AiGatewayHealthService.name);
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly keys: AiGatewayKeyPoolService,
    private readonly metrics: AiGatewayMetricsService,
    private readonly providerConfig: AiProviderConfigService,
    private readonly gatewayConfig: AiGatewayConfigService,
  ) {}

  onModuleInit() {
    const interval = this.gatewayConfig.get().healthCheckIntervalMs;
    this.timer = setInterval(() => {
      void this.probeAll();
    }, interval);
    this.timer.unref?.();
    setTimeout(() => void this.probeAll(), 5_000).unref?.();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  /**
   * Whether a key may be used for a live request.
   * Half-open: after cooldown expires, allow a trial (status → testing).
   */
  canUse(slot: AiGatewayKeySlot): boolean {
    const runtime = this.metrics.getRuntime(slot.id);
    if (runtime.disabled) return false;
    const until = runtime.circuitOpenUntil;
    if (!until) return true;
    if (Date.now() >= until.getTime()) {
      this.metrics.setStatus(slot.id, 'testing');
      return true;
    }
    return false;
  }

  /** Exponential cooldown: base * 2^(failures-1), capped. */
  cooldownMsFor(consecutiveFailures: number): number {
    const cfg = this.gatewayConfig.get();
    const exp = Math.max(0, consecutiveFailures - 1);
    const ms = cfg.cooldownBaseMs * Math.pow(2, exp);
    return Math.min(cfg.cooldownMaxMs, ms);
  }

  recordSuccess(slot: AiGatewayKeySlot, latencyMs: number) {
    const prev = this.metrics.getRuntime(slot.id);
    const wasDegraded =
      prev.consecutiveFailures > 0 ||
      prev.status === 'cooling_down' ||
      prev.status === 'testing' ||
      prev.status === 'unavailable' ||
      prev.status === 'rate_limited' ||
      prev.status === 'offline' ||
      prev.status === 'busy';
    this.metrics.recordSuccess(slot.id, latencyMs);
    this.metrics.setCircuit(slot.id, null, 0);
    if (wasDegraded) {
      this.logger.log(
        JSON.stringify({
          event: 'key_recovered',
          keyId: slot.id,
          keyLabel: slot.label,
          latencyMs,
        }),
      );
    }
  }

  recordFailure(
    slot: AiGatewayKeySlot,
    label: string,
    errorClass: ReturnType<typeof classifyGatewayError>['class'],
  ) {
    const health = healthFromErrorClass(errorClass);
    this.metrics.recordError(slot.id, label, health);
    const runtime = this.metrics.getRuntime(slot.id);
    const cfg = this.gatewayConfig.get();

    // Payload/model mistakes are not the key's fault — never cool the pool for them.
    if (errorClass === 'bad_request' || errorClass === 'prompt_too_large') {
      return;
    }

    // Credits: never cool — free-tier budget misses are fixed by lowering max_tokens, not parking keys for minutes.
    if (errorClass === 'credits') {
      return;
    }

    // Auth failures: longer cooldown (key may be revoked)
    const failures = runtime.consecutiveFailures;
    if (failures >= cfg.circuitFailureThreshold) {
      const base = this.cooldownMsFor(failures);
      const openMs = errorClass === 'auth' ? Math.min(cfg.cooldownMaxMs, base * 2) : base;
      const openUntil = new Date(Date.now() + openMs);
      this.metrics.setCircuit(slot.id, openUntil);
      this.logger.warn(
        JSON.stringify({
          event: 'key_cooldown_started',
          keyId: slot.id,
          keyLabel: slot.label,
          reason: label,
          errorClass,
          consecutiveFailures: failures,
          cooldownMs: openMs,
          cooldownUntil: openUntil.toISOString(),
        }),
      );
    }
  }

  async probeAll() {
    if (!this.keys.isEnabled()) return;
    const baseUrl = this.keys.getBaseUrl();
    const provider = this.keys.isOpenRouter() ? AiProviderType.OPENROUTER : AiProviderType.OPENAI_COMPATIBLE;

    for (const slot of this.keys.getSlots()) {
      await this.probeSlot(slot, baseUrl, provider);
    }
  }

  private async probeSlot(slot: AiGatewayKeySlot, baseUrl: string, provider: AiProviderType) {
    const runtime = this.metrics.getRuntime(slot.id);
    if (runtime.disabled) return;

    // Only actively probe keys that are cooling down / unhealthy / testing
    const until = runtime.circuitOpenUntil;
    const cooling = until && until.getTime() > Date.now();
    if (cooling) return; // wait for cooldown to expire

    const needsProbe =
      runtime.status === 'testing' ||
      runtime.status === 'cooling_down' ||
      runtime.status === 'unavailable' ||
      runtime.status === 'rate_limited' ||
      runtime.status === 'offline' ||
      runtime.status === 'busy' ||
      (until != null && until.getTime() <= Date.now());

    // Always light-probe periodically even healthy keys so we detect silent death
    const shouldProbe = needsProbe || runtime.status === 'healthy' || runtime.status === 'slow';
    if (!shouldProbe) return;

    if (needsProbe) this.metrics.setStatus(slot.id, 'testing');

    const start = Date.now();
    try {
      const client = this.providerConfig.createClient(baseUrl, slot.apiKey, provider);
      await client.get('/models', { timeout: 12_000, validateStatus: (s) => s < 500 });
      const latency = Date.now() - start;
      const prev = this.metrics.getRuntime(slot.id);
      const wasBad =
        prev.status !== 'healthy' && prev.status !== 'slow' && prev.consecutiveFailures > 0;
      const cfg = this.gatewayConfig.get();
      this.metrics.setStatus(slot.id, latency >= cfg.slowMs ? 'slow' : 'healthy');
      this.metrics.setCircuit(slot.id, null, 0);
      if (wasBad || needsProbe) {
        this.logger.log(
          JSON.stringify({
            event: 'key_recovered',
            keyId: slot.id,
            keyLabel: slot.label,
            via: 'health_probe',
            latencyMs: latency,
          }),
        );
      }
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status && error.response.status < 500) {
        const status = error.response.status;
        if (status === 429) {
          this.metrics.setStatus(slot.id, 'rate_limited');
          const openUntil = new Date(Date.now() + this.cooldownMsFor(1));
          this.metrics.setCircuit(slot.id, openUntil);
          return;
        }
        if (status === 401 || status === 403) {
          this.metrics.setStatus(slot.id, 'unavailable');
          const openUntil = new Date(Date.now() + this.cooldownMsFor(Math.max(2, runtime.consecutiveFailures + 1)));
          this.metrics.setCircuit(slot.id, openUntil);
          return;
        }
        // 404 on /models is common for some gateways — treat as reachable
        this.metrics.setStatus(slot.id, 'healthy');
        this.metrics.setCircuit(slot.id, null, 0);
        return;
      }
      const classified = classifyGatewayError(error);
      this.metrics.setStatus(slot.id, healthFromErrorClass(classified.class));
      const openUntil = new Date(Date.now() + this.cooldownMsFor(runtime.consecutiveFailures + 1));
      this.metrics.setCircuit(slot.id, openUntil);
      this.logger.warn(
        JSON.stringify({
          event: 'health_probe_failed',
          keyId: slot.id,
          keyLabel: slot.label,
          reason: classified.label,
        }),
      );
    }
  }
}
