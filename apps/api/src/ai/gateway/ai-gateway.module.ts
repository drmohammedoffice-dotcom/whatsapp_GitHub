import { AiGatewayConfigService } from './ai-gateway-config';
import { AiGatewayErrorClassifier } from './ai-gateway-error';
import { AiGatewayHealthService } from './ai-gateway-health.service';
import { AiGatewayKeyPoolService } from './ai-gateway-key-pool.service';
import { AiGatewayLoadBalancerService } from './ai-gateway-load-balancer.service';
import { AiGatewayMetricsService } from './ai-gateway-metrics.service';
import { AiGatewayRateLimiterService } from './ai-gateway-rate-limiter.service';
import { AiGatewayRetryProcessor } from './ai-gateway-retry.processor';
import { AiGatewayService } from './ai-gateway.service';

/** Provider list for AiModule — OpenRouter / AI Gateway key manager wiring. */
export const AI_GATEWAY_PROVIDERS = [
  AiGatewayConfigService,
  AiGatewayKeyPoolService,
  AiGatewayRateLimiterService,
  AiGatewayMetricsService,
  AiGatewayHealthService,
  AiGatewayLoadBalancerService,
  AiGatewayErrorClassifier,
  AiGatewayService,
  AiGatewayRetryProcessor,
] as const;
