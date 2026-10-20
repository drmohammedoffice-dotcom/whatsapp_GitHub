import { Injectable } from '@nestjs/common';
import { AiGatewayService } from '../../ai/gateway/ai-gateway.service';
import { AiGatewayHealthService } from '../../ai/gateway/ai-gateway-health.service';

@Injectable()
export class AdminAiGatewayService {
  constructor(
    private readonly gateway: AiGatewayService,
    private readonly health: AiGatewayHealthService,
  ) {}

  getStatus() {
    return this.gateway.getDashboard();
  }

  async probeNow() {
    await this.health.probeAll();
    return this.gateway.getDashboard();
  }
}
