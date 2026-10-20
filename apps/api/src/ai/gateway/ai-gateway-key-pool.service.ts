import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AiGatewayKeySlot } from './ai-gateway.types';

/**
 * Loads platform OpenRouter / AI Gateway API keys from environment.
 *
 * Supported forms (never hardcode secrets in source):
 * - AI_API_KEY_1..N
 * - OPENROUTER_KEYS='["sk-…","sk-…"]'  (JSON array)
 * - OPENROUTER_KEYS=sk-a,sk-b          (comma-separated)
 * - Legacy AI_API_KEY when no numbered / JSON keys exist
 *
 * Optional weights: AI_API_KEY_WEIGHT_1=3 (for weighted_round_robin)
 */
@Injectable()
export class AiGatewayKeyPoolService implements OnModuleInit {
  private readonly logger = new Logger(AiGatewayKeyPoolService.name);
  private slots: AiGatewayKeySlot[] = [];

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    this.reload();
  }

  reload() {
    const found: AiGatewayKeySlot[] = [];
    const env = process.env;
    const numbered: Array<{ index: number; key: string; weight: number }> = [];

    for (const [name, value] of Object.entries(env)) {
      const match = /^AI_API_KEY_(\d+)$/.exec(name);
      if (!match || typeof value !== 'string') continue;
      const trimmed = value.trim();
      if (!trimmed || trimmed === 'not-configured') continue;
      const index = Number(match[1]);
      const weightRaw = Number(env[`AI_API_KEY_WEIGHT_${index}`] ?? 1);
      numbered.push({
        index,
        key: trimmed,
        weight: Number.isFinite(weightRaw) && weightRaw > 0 ? Math.floor(weightRaw) : 1,
      });
    }

    numbered.sort((a, b) => a.index - b.index);
    for (const entry of numbered) {
      found.push({
        id: `api-${entry.index}`,
        label: `API ${entry.index}`,
        index: entry.index,
        weight: entry.weight,
        apiKey: entry.key,
      });
    }

    // OPENROUTER_KEYS JSON array or comma-separated — only when numbered keys absent
    if (!found.length) {
      for (const key of this.parseOpenRouterKeys()) {
        const index = found.length + 1;
        found.push({
          id: `api-${index}`,
          label: `API ${index}`,
          index,
          weight: 1,
          apiKey: key,
        });
      }
    }

    // Legacy single key — only if nothing else loaded
    if (!found.length) {
      const legacy = (this.config.get<string>('AI_API_KEY') ?? process.env.AI_API_KEY ?? '').trim();
      if (legacy && legacy !== 'not-configured') {
        found.push({ id: 'api-1', label: 'API 1', index: 1, weight: 1, apiKey: legacy });
      }
    }

    this.slots = found;
    this.logger.log(
      JSON.stringify({
        event: 'key_pool_loaded',
        keyCount: found.length,
        labels: found.map((s) => s.label),
      }),
    );
  }

  private parseOpenRouterKeys(): string[] {
    const raw =
      this.config.get<string>('OPENROUTER_KEYS')?.trim() ||
      process.env.OPENROUTER_KEYS?.trim() ||
      '';
    if (!raw) return [];

    // JSON array
    if (raw.startsWith('[')) {
      try {
        const parsed = JSON.parse(raw) as unknown;
        if (Array.isArray(parsed)) {
          return parsed
            .map((v) => String(v ?? '').trim())
            .filter((v) => v && v !== 'not-configured');
        }
      } catch {
        this.logger.warn(
          JSON.stringify({ event: 'openrouter_keys_parse_error', hint: 'expected JSON array' }),
        );
      }
    }

    // Comma / whitespace / newline separated
    return raw
      .split(/[\s,]+/)
      .map((v) => v.trim())
      .filter((v) => v && v !== 'not-configured');
  }

  isEnabled(): boolean {
    return this.slots.length > 0;
  }

  getSlots(): AiGatewayKeySlot[] {
    return this.slots.slice();
  }

  getSlot(id: string): AiGatewayKeySlot | undefined {
    return this.slots.find((s) => s.id === id);
  }

  getBaseUrl(): string {
    const raw =
      this.config.get<string>('AI_GATEWAY_BASE_URL')?.trim() ||
      process.env.AI_GATEWAY_BASE_URL?.trim() ||
      this.config.get<string>('AI_API_BASE_URL') ||
      process.env.AI_API_BASE_URL ||
      'https://openrouter.ai/api/v1';
    return raw.replace(/\/$/, '');
  }

  getChatModel(): string | null {
    const raw =
      this.config.get<string>('AI_GATEWAY_CHAT_MODEL')?.trim() ||
      process.env.AI_GATEWAY_CHAT_MODEL?.trim();
    return raw || null;
  }

  isOpenRouter(): boolean {
    return this.getBaseUrl().includes('openrouter.ai');
  }

  isKie(): boolean {
    return this.getBaseUrl().includes('api.kie.ai');
  }
}
