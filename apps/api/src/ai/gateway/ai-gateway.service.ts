import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { AiProviderType } from '@watsapp/database';
import { QUEUES } from '../../queues/queues.constants';
import { AiProviderConfigService } from '../ai-provider-config.service';
import { classifyGatewayError } from './ai-gateway-error';
import { AiGatewayConfigService } from './ai-gateway-config';
import { AiGatewayHealthService } from './ai-gateway-health.service';
import { AiGatewayKeyPoolService } from './ai-gateway-key-pool.service';
import { AiGatewayLoadBalancerService } from './ai-gateway-load-balancer.service';
import { AiGatewayMetricsService } from './ai-gateway-metrics.service';
import { AiGatewayRateLimiterService } from './ai-gateway-rate-limiter.service';
import {
  GATEWAY_RETRY_DELAYS_MS,
  type AiGatewayChatRequest,
  type AiGatewayChatResult,
  type AiGatewayDashboard,
  type AiGatewayKeySlot,
} from './ai-gateway.types';

export type AiGatewayRetryJob = {
  request: AiGatewayChatRequest;
  enqueuedAt: string;
  attempt: number;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Extract affordable max_tokens from OpenRouter 402 credit errors. */
function parseAffordableTokens(error: unknown): number | null {
  const data = (error as { response?: { data?: unknown } })?.response?.data;
  const blob = typeof data === 'string' ? data : JSON.stringify(data ?? '');
  const match = /can only afford (\d+)/i.exec(blob);
  if (!match) return null;
  const affordable = Number(match[1]);
  return Number.isFinite(affordable) ? Math.max(0, affordable - 16) : null;
}

/**
 * OpenRouter / platform AI client façade.
 *
 * await gateway.chat(...)  — selects key, failovers, cools down, rate-limits,
 * queues when busy. Callers never see which key was used.
 */
@Injectable()
export class AiGatewayService {
  private readonly logger = new Logger(AiGatewayService.name);

  constructor(
    private readonly keys: AiGatewayKeyPoolService,
    private readonly health: AiGatewayHealthService,
    private readonly metrics: AiGatewayMetricsService,
    private readonly providerConfig: AiProviderConfigService,
    private readonly gatewayConfig: AiGatewayConfigService,
    private readonly loadBalancer: AiGatewayLoadBalancerService,
    private readonly rateLimiter: AiGatewayRateLimiterService,
    @InjectQueue(QUEUES.AI_GATEWAY_RETRY) private readonly retryQueue: Queue<AiGatewayRetryJob>,
  ) {}

  isEnabled(): boolean {
    return this.keys.isEnabled();
  }

  getBaseUrl(): string {
    return this.keys.getBaseUrl();
  }

  isOpenRouter(): boolean {
    return this.keys.isOpenRouter();
  }

  /** Alias kept for callers that prefer OpenRouter naming. */
  async chatCompletion(request: AiGatewayChatRequest): Promise<AiGatewayChatResult> {
    return this.chat(request);
  }

  getDashboard(): AiGatewayDashboard {
    const slots = this.keys.getSlots();
    const preferred = this.loadBalancer.selectOrder(slots)[0]?.id ?? slots[0]?.id ?? null;
    return {
      enabled: this.isEnabled(),
      baseUrl: this.keys.getBaseUrl(),
      strategy: this.loadBalancer.strategy(),
      keyCount: slots.length,
      preferredKeyId: preferred,
      updatedAt: new Date().toISOString(),
      keys: slots.map((s) => this.metrics.snapshot(s.id, s.label, s.index)),
      totals: this.metrics.totals(),
    };
  }

  async chat(request: AiGatewayChatRequest): Promise<AiGatewayChatResult> {
    if (!this.isEnabled()) {
      throw new ServiceUnavailableException('AI Gateway has no configured API keys');
    }

    const corr = request.correlationId ? ` correlationId=${request.correlationId}` : '';
    const cfg = this.gatewayConfig.get();

    const first = await this.attemptWithFailover(request, corr);
    if (first.result) return first.result;
    if (first.nonRetryableError) throw first.nonRetryableError;
    if (first.allAuthFailures) {
      this.logger.error(
        JSON.stringify({ event: 'gateway_unavailable', reason: 'all_auth_failures', correlationId: request.correlationId }),
      );
      throw new ServiceUnavailableException('AI Gateway: no usable API keys');
    }

    // One quick reduced-budget retry (no long queue) — then fail fast so team-key fallback can reply.
    if (!first.noneAvailable) {
      request.maxTokens = Math.min(request.maxTokens ?? 128, 96);
      const quick = await this.attemptWithFailover(request, corr);
      if (quick.result) return quick.result;
      if (quick.nonRetryableError) throw quick.nonRetryableError;
      this.logger.warn(
        JSON.stringify({
          event: 'gateway_fail_fast',
          reason: 'credits_or_capacity',
          correlationId: request.correlationId,
        }),
      );
      throw new ServiceUnavailableException('AI Gateway: free-tier capacity exhausted');
    }

    // Queue / wait only when keys are temporarily unavailable (cooldown/rate-limit), not on budget misses
    for (let round = 0; round < Math.max(1, cfg.maxRetries); round += 1) {
      const delay = GATEWAY_RETRY_DELAYS_MS[Math.min(round, GATEWAY_RETRY_DELAYS_MS.length - 1)]!;
      this.metrics.incrementRetryScheduled();
      this.logger.log(
        JSON.stringify({
          event: 'retry_scheduled',
          delayMs: delay,
          round: round + 1,
          correlationId: request.correlationId,
        }),
      );
      await this.enqueueRetryMarker(request, delay);
      await this.waitForAvailableKey(corr);
      await sleep(delay);

      const retry = await this.attemptWithFailover(request, corr);
      if (retry.result) return retry.result;
      if (retry.nonRetryableError) throw retry.nonRetryableError;
      if (retry.allAuthFailures) {
        throw new ServiceUnavailableException('AI Gateway: no usable API keys');
      }
      if (!retry.noneAvailable) {
        throw new ServiceUnavailableException('AI Gateway: all API keys exhausted after retries');
      }
    }

    throw new ServiceUnavailableException('AI Gateway: all API keys exhausted after retries');
  }

  private async waitForAvailableKey(corr: string) {
    const cfg = this.gatewayConfig.get();
    const slots = this.keys.getSlots();
    if (this.loadBalancer.selectOrder(slots).length > 0) return;

    this.metrics.incrementQueuedWait();
    this.logger.log(
      JSON.stringify({
        event: 'queue_started',
        waitMs: cfg.queueWaitMs,
        correlationId: corr.trim() || undefined,
      }),
    );

    const deadline = Date.now() + cfg.queueWaitMs;
    while (Date.now() < deadline) {
      if (this.loadBalancer.selectOrder(this.keys.getSlots()).length > 0) {
        this.logger.log(JSON.stringify({ event: 'queue_ended', reason: 'key_available' }));
        return;
      }
      await sleep(cfg.queuePollMs);
    }
    this.logger.log(JSON.stringify({ event: 'queue_ended', reason: 'timeout' }));
  }

  private async attemptWithFailover(
    request: AiGatewayChatRequest,
    corr: string,
  ): Promise<{
    result: AiGatewayChatResult | null;
    allAuthFailures: boolean;
    noneAvailable: boolean;
    nonRetryableError?: unknown;
  }> {
    const cfg = this.gatewayConfig.get();
    const exclude = new Set<string>();
    let tried = 0;
    let authFailures = 0;
    let switches = 0;

    while (switches < cfg.maxRetries) {
      const ordered = this.loadBalancer.selectOrder(this.keys.getSlots(), exclude);
      if (!ordered.length) break;

      const slot = ordered[0]!;
      exclude.add(slot.id);
      tried += 1;
      switches += 1;

      this.logger.log(
        JSON.stringify({
          event: 'key_selected',
          keyId: slot.id,
          keyLabel: slot.label,
          strategy: this.loadBalancer.strategy(),
          correlationId: request.correlationId,
        }),
      );

      this.rateLimiter.reserve(slot.id);
      this.metrics.recordAttempt(slot.id);

      const started = Date.now();
      try {
        const completion = await this.executeChat(slot, request);
        const latencyMs = Date.now() - started;
        this.health.recordSuccess(slot, latencyMs);
        this.logger.log(
          JSON.stringify({
            event: 'key_success',
            keyId: slot.id,
            keyLabel: slot.label,
            latencyMs,
            status: 200,
            correlationId: request.correlationId,
          }),
        );
        return {
          result: {
            ...completion,
            keyId: slot.id,
            keyLabel: slot.label,
            latencyMs,
          },
          allAuthFailures: false,
          noneAvailable: false,
        };
      } catch (error) {
        const classified = classifyGatewayError(error);
        // Credits/capacity: shrink max_tokens for the rest of this request so other keys succeed immediately.
        if (classified.class === 'credits') {
          const affordable = parseAffordableTokens(error);
          const nextMax = Math.min(
            request.maxTokens ?? 256,
            affordable && affordable > 32 ? Math.min(affordable, 200) : 128,
          );
          if (!request.maxTokens || nextMax < request.maxTokens) {
            request.maxTokens = nextMax;
            this.logger.warn(
              JSON.stringify({
                event: 'request_max_tokens_capped',
                to: nextMax,
                correlationId: request.correlationId,
              }),
            );
          }
        }
        this.health.recordFailure(slot, classified.label, classified.class);
        this.logger.warn(
          JSON.stringify({
            event: 'key_failed',
            keyId: slot.id,
            keyLabel: slot.label,
            reason: classified.label,
            errorClass: classified.class,
            status: classified.status ?? null,
            message: classified.message.slice(0, 240),
            model: request.model,
            correlationId: request.correlationId,
          }),
        );

        if (!classified.retryable) {
          return {
            result: null,
            allAuthFailures: false,
            noneAvailable: false,
            nonRetryableError: error,
          };
        }

        if (classified.class === 'auth') authFailures += 1;
        this.metrics.incrementFailover();
        this.logger.log(
          JSON.stringify({
            event: 'switch_key',
            from: slot.label,
            correlationId: request.correlationId,
          }),
        );
      }
    }

    if (tried === 0) {
      this.logger.warn(
        JSON.stringify({
          event: 'no_keys_available',
          correlationId: request.correlationId,
        }),
      );
    }
    return {
      result: null,
      allAuthFailures: tried > 0 && authFailures === tried,
      noneAvailable: tried === 0,
    };
  }

  private async executeChat(
    slot: AiGatewayKeySlot,
    request: AiGatewayChatRequest,
  ): Promise<Omit<AiGatewayChatResult, 'keyId' | 'keyLabel' | 'latencyMs'>> {
    const baseUrl = this.keys.getBaseUrl();
    const provider = this.keys.isOpenRouter() ? AiProviderType.OPENROUTER : AiProviderType.OPENAI_COMPATIBLE;
    const timeout = this.gatewayConfig.get().requestTimeoutMs;
    const client = this.providerConfig.createClient(baseUrl, slot.apiKey, provider);
    client.defaults.timeout = timeout;

    // Prefer the caller/team model; gateway env model is only a fallback.
    let model = (request.model?.trim() || this.keys.getChatModel() || '').trim();
    if (this.keys.isOpenRouter() && model && !model.includes('/')) model = `openai/${model}`;
    if (!model) {
      throw new ServiceUnavailableException('AI model is not configured');
    }
    const path = this.keys.isKie() ? `/${model}/v1/chat/completions` : '/chat/completions';

    const postOnce = async (maxTokens: number | undefined) =>
      client.post(path, {
        model,
        messages: request.messages,
        temperature: request.temperature,
        max_tokens: maxTokens,
        top_p: request.topP,
        stream: false,
        ...(request.json ? { response_format: { type: 'json_object' } } : {}),
      });

    let response;
    try {
      response = await postOnce(request.maxTokens);
    } catch (error) {
      // Free-tier OpenRouter: 402 "can only afford N" — retry once with a conservative completion budget.
      const affordable = parseAffordableTokens(error);
      if (affordable && affordable > 32) {
        const reduced = Math.min(affordable, 200, request.maxTokens ?? 200);
        if (!request.maxTokens || reduced < request.maxTokens) {
          this.logger.warn(
            JSON.stringify({
              event: 'max_tokens_reduced',
              from: request.maxTokens ?? null,
              to: reduced,
              keyId: slot.id,
              correlationId: request.correlationId,
            }),
          );
          request.maxTokens = reduced;
          response = await postOnce(reduced);
        } else {
          throw error;
        }
      } else {
        throw error;
      }
    }

    const data = response.data ?? {};
    if (data.error) {
      const message =
        typeof data.error === 'string' ? data.error : data.error?.message ?? JSON.stringify(data.error);
      throw new ServiceUnavailableException(`AI provider error: ${message}`);
    }
    if (!data.choices && (typeof data.code === 'number' || data.msg)) {
      throw new ServiceUnavailableException(`AI provider error ${data.code ?? ''}: ${data.msg ?? 'unknown'}`);
    }

    const choice = data.choices?.[0];
    const content = choice?.message?.content ?? '';
    if (!content && choice?.finish_reason) {
      throw new ServiceUnavailableException(
        `AI provider returned empty content (finish_reason=${choice.finish_reason})`,
      );
    }

    return {
      content,
      promptTokens: data.usage?.prompt_tokens ?? 0,
      completionTokens: data.usage?.completion_tokens ?? 0,
      raw: data,
      model,
    };
  }

  private async enqueueRetryMarker(request: AiGatewayChatRequest, delay: number) {
    try {
      await this.retryQueue.add(
        'retry-marker',
        {
          request: {
            model: request.model,
            messages: [],
            correlationId: request.correlationId,
            persistUntilSuccess: request.persistUntilSuccess,
          },
          enqueuedAt: new Date().toISOString(),
          attempt: 0,
        },
        {
          delay,
          removeOnComplete: 50,
          removeOnFail: 20,
        },
      );
    } catch {
      // best-effort
    }
  }
}
