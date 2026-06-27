import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiProviderType } from '@watsapp/database';
import axios, { AxiosError, AxiosInstance } from 'axios';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { EncryptionService } from '../security/encryption.service';
import { AiProviderConfigDto, TestAiProviderDto } from './dto/ai.dto';

export const PROVIDER_DEFAULTS: Record<AiProviderType, { baseUrl: string; model: string }> = {
  OPENAI_COMPATIBLE: { baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
  OPENROUTER: { baseUrl: 'https://openrouter.ai/api/v1', model: 'openai/gpt-4o-mini' },
  GROQ: { baseUrl: 'https://api.groq.com/openai/v1', model: 'llama-3.3-70b-versatile' },
  GEMINI: { baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', model: 'gemini-2.0-flash' },
  CUSTOM: { baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
};

export type ProviderPublicConfig = {
  id: string;
  teamId: string;
  provider: AiProviderType;
  baseUrl: string;
  model: string | null;
  temperature: number;
  maxTokens: number;
  topP: number;
  enableStreaming: boolean;
  enableMemory: boolean;
  enableHumanHandover: boolean;
  enableVision: boolean;
  enableProductSearch: boolean;
  enableImageSending: boolean;
  hasApiKey: boolean;
  lastTestAt: Date | null;
  lastTestOk: boolean | null;
  lastTestMessage: string | null;
};

export type ProviderRuntimeConfig = {
  provider: AiProviderType;
  baseUrl: string;
  apiKey: string;
  model: string;
  temperature: number;
  maxTokens: number;
  topP: number;
  enableStreaming: boolean;
  enableMemory: boolean;
  enableHumanHandover: boolean;
  enableVision: boolean;
  enableProductSearch: boolean;
  enableImageSending: boolean;
};

@Injectable()
export class AiProviderConfigService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
  ) {}

  async get(teamId: string): Promise<ProviderPublicConfig> {
    const row = await this.ensure(teamId);
    return this.toPublic(row);
  }

  async update(teamId: string, userId: string | undefined, dto: AiProviderConfigDto): Promise<ProviderPublicConfig> {
    await this.ensure(teamId);
    const defaults = PROVIDER_DEFAULTS[dto.provider ?? AiProviderType.OPENAI_COMPATIBLE];
    const data: Record<string, unknown> = {
      provider: dto.provider,
      baseUrl: dto.baseUrl?.trim() || defaults.baseUrl,
      model: dto.model?.trim() || defaults.model,
      temperature: dto.temperature,
      maxTokens: dto.maxTokens,
      topP: dto.topP,
      enableStreaming: dto.enableStreaming,
      enableMemory: dto.enableMemory,
      enableHumanHandover: dto.enableHumanHandover,
      enableVision: dto.enableVision,
      enableProductSearch: dto.enableProductSearch,
      enableImageSending: dto.enableImageSending,
    };

    if (dto.apiKey?.trim()) {
      data.encryptedApiKey = this.encryption.encryptJson(dto.apiKey.trim());
    }

    const updated = await this.prisma.aiProviderConfig.update({
      where: { teamId },
      data: data as never,
    });

    await this.audit.log({
      teamId,
      actorUserId: userId,
      action: 'ai.provider.update',
      resource: 'aiProviderConfig',
      resourceId: updated.id,
      metadata: { provider: updated.provider, model: updated.model },
    });

    return this.toPublic(updated);
  }

  async resolveRuntime(teamId: string): Promise<ProviderRuntimeConfig | null> {
    const row = await this.prisma.aiProviderConfig.findUnique({ where: { teamId } });
    if (!row?.encryptedApiKey) return this.envFallback();
    const defaults = PROVIDER_DEFAULTS[row.provider];
    return {
      provider: row.provider,
      baseUrl: row.baseUrl.replace(/\/$/, ''),
      apiKey: this.encryption.decryptJson<string>(row.encryptedApiKey),
      model: row.model ?? defaults.model,
      temperature: row.temperature,
      maxTokens: row.maxTokens,
      topP: row.topP,
      enableStreaming: row.enableStreaming,
      enableMemory: row.enableMemory,
      enableHumanHandover: row.enableHumanHandover,
      enableVision: row.enableVision,
      enableProductSearch: row.enableProductSearch,
      enableImageSending: row.enableImageSending,
    };
  }

  async test(teamId: string, userId: string | undefined, dto: TestAiProviderDto) {
    const stored = await this.prisma.aiProviderConfig.findUnique({ where: { teamId } });
    const provider = dto.provider ?? stored?.provider ?? AiProviderType.OPENAI_COMPATIBLE;
    const defaults = PROVIDER_DEFAULTS[provider];
    const apiKey = dto.apiKey?.trim() || (stored?.encryptedApiKey ? this.encryption.decryptJson<string>(stored.encryptedApiKey) : '');
    const baseUrl = (dto.baseUrl?.trim() || stored?.baseUrl || defaults.baseUrl).replace(/\/$/, '');
    const model = dto.model?.trim() || stored?.model || defaults.model;

    if (!apiKey) throw new BadRequestException('API key is required to test the connection');

    const result = await this.probeConnection({ baseUrl, apiKey, model, provider });

    if (stored) {
      await this.prisma.aiProviderConfig.update({
        where: { teamId },
        data: { lastTestAt: new Date(), lastTestOk: result.ok, lastTestMessage: result.message },
      });
    }

    await this.audit.log({
      teamId,
      actorUserId: userId,
      action: 'ai.provider.test',
      resource: 'aiProviderConfig',
      metadata: { provider, ok: result.ok, message: result.message },
    });

    return result;
  }

  async listModels(teamId: string, dto: TestAiProviderDto) {
    const stored = await this.prisma.aiProviderConfig.findUnique({ where: { teamId } });
    const provider = dto.provider ?? stored?.provider ?? AiProviderType.OPENAI_COMPATIBLE;
    const defaults = PROVIDER_DEFAULTS[provider];
    const apiKey = dto.apiKey?.trim() || (stored?.encryptedApiKey ? this.encryption.decryptJson<string>(stored.encryptedApiKey) : '');
    const baseUrl = (dto.baseUrl?.trim() || stored?.baseUrl || defaults.baseUrl).replace(/\/$/, '');

    if (!apiKey) throw new BadRequestException('API key is required to list models');

    try {
      const client = this.createClient(baseUrl, apiKey, provider);
      const response = await client.get('/models', { timeout: 20_000 });
      const models = (response.data?.data ?? [])
        .map((item: { id?: string }) => item.id)
        .filter(Boolean) as string[];
      return { models: models.length ? models.sort() : this.fallbackModels(provider) };
    } catch (error) {
      return { models: this.fallbackModels(provider), warning: this.formatError(error) };
    }
  }

  async probeConnection(input: { baseUrl: string; apiKey: string; model: string; provider: AiProviderType }) {
    try {
      const client = this.createClient(input.baseUrl, input.apiKey, input.provider);
      const response = await client.post('/chat/completions', {
        model: input.model,
        messages: [{ role: 'user', content: 'ping' }],
        max_tokens: 5,
        temperature: 0,
      }, { timeout: 30_000 });

      if (!response.data?.choices?.length) {
        return { ok: false, message: 'Provider responded but returned no completion choices' };
      }
      return { ok: true, message: 'Connected successfully' };
    } catch (error) {
      return { ok: false, message: this.formatError(error) };
    }
  }

  createClient(baseUrl: string, apiKey: string, provider: AiProviderType): AxiosInstance {
    const headers: Record<string, string> = { authorization: `Bearer ${apiKey}` };
    if (provider === AiProviderType.OPENROUTER) {
      headers['HTTP-Referer'] = 'https://watsapp.local';
      headers['X-Title'] = 'Watsapp SaaS';
    }
    return axios.create({ baseURL: baseUrl, headers, timeout: 60_000 });
  }

  formatError(error: unknown): string {
    if (!axios.isAxiosError(error)) {
      if (error instanceof Error && error.message.includes('timeout')) return 'Connection timed out. Check the endpoint and try again.';
      return error instanceof Error ? error.message : 'Unknown provider error';
    }
    const err = error as AxiosError<{ error?: { message?: string }; message?: string }>;
    const status = err.response?.status;
    const body = err.response?.data?.error?.message ?? err.response?.data?.message ?? err.message;
    if (status === 401 || status === 403) return `Invalid API key: ${body}`;
    if (status === 429) return `Quota exceeded: ${body}`;
    if (status === 404) return `Invalid model or endpoint: ${body}`;
    if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') return 'Provider offline or unreachable. Verify the base URL.';
    if (err.code === 'ETIMEDOUT' || err.message.includes('timeout')) return 'Connection timed out. The provider did not respond in time.';
    return body || 'Provider request failed';
  }

  private async ensure(teamId: string) {
    const defaults = PROVIDER_DEFAULTS.OPENAI_COMPATIBLE;
    return this.prisma.aiProviderConfig.upsert({
      where: { teamId },
      update: {},
      create: { teamId, baseUrl: defaults.baseUrl, model: defaults.model },
    });
  }

  private envFallback(): ProviderRuntimeConfig | null {
    const apiKey = this.config.get<string>('AI_API_KEY');
    if (!apiKey || apiKey === 'not-configured') return null;
    return {
      provider: AiProviderType.OPENAI_COMPATIBLE,
      baseUrl: this.config.getOrThrow<string>('AI_API_BASE_URL').replace(/\/$/, ''),
      apiKey,
      model: this.config.getOrThrow<string>('AI_CHAT_MODEL'),
      temperature: 0.2,
      maxTokens: 1024,
      topP: 1,
      enableStreaming: false,
      enableMemory: true,
      enableHumanHandover: true,
      enableVision: false,
      enableProductSearch: true,
      enableImageSending: false,
    };
  }

  private toPublic(row: {
    id: string;
    teamId: string;
    provider: AiProviderType;
    baseUrl: string;
    model: string | null;
    temperature: number;
    maxTokens: number;
    topP: number;
    enableStreaming: boolean;
    enableMemory: boolean;
    enableHumanHandover: boolean;
    enableVision: boolean;
    enableProductSearch: boolean;
    enableImageSending: boolean;
    encryptedApiKey: string | null;
    lastTestAt: Date | null;
    lastTestOk: boolean | null;
    lastTestMessage: string | null;
  }): ProviderPublicConfig {
    return {
      id: row.id,
      teamId: row.teamId,
      provider: row.provider,
      baseUrl: row.baseUrl,
      model: row.model,
      temperature: row.temperature,
      maxTokens: row.maxTokens,
      topP: row.topP,
      enableStreaming: row.enableStreaming,
      enableMemory: row.enableMemory,
      enableHumanHandover: row.enableHumanHandover,
      enableVision: row.enableVision,
      enableProductSearch: row.enableProductSearch,
      enableImageSending: row.enableImageSending,
      hasApiKey: Boolean(row.encryptedApiKey),
      lastTestAt: row.lastTestAt,
      lastTestOk: row.lastTestOk,
      lastTestMessage: row.lastTestMessage,
    };
  }

  private fallbackModels(provider: AiProviderType): string[] {
    return [PROVIDER_DEFAULTS[provider].model];
  }
}
