import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CAPABILITY_NOT_SUPPORTED,
  IRAQI_TTS_NOT_CONFIGURED,
  PROVIDER_AUTH_FAILED,
  PROVIDER_NOT_CONFIGURED,
  PROVIDER_RATE_LIMITED,
  ProviderError,
} from './provider-error';
import type {
  AIImageProvider,
  AITTSProvider,
  AITextProvider,
  GenerationJobHandle,
  GenerationResult,
  GenerationStatus,
  ImageGenerateInput,
  ProviderAuthResult,
  TextCompleteInput,
  TtsInput,
} from './types';

/**
 * OpenAI brain + optional Images API (gpt-image-2 per official deprecation path).
 * Video/Iraqi-TTS/lip-sync/upscale are not claimed here. OpenAI TTS is MSA/generic, never labeled Iraqi.
 * Docs: https://developers.openai.com/api/reference/resources/images/methods/generate/
 */
@Injectable()
export class OpenAIProvider implements AITextProvider, AIImageProvider, AITTSProvider {
  readonly id = 'openai';
  private readonly logger = new Logger(OpenAIProvider.name);
  private readonly completed = new Map<string, GenerationResult>();

  constructor(private readonly config: ConfigService) {}

  isConfigured(): boolean {
    return Boolean(this.apiKey());
  }

  private apiKey(): string {
    const dedicated = (this.config.get<string>('OPENAI_API_KEY') || '').trim();
    if (dedicated) return dedicated;
    const shared = (this.config.get<string>('AI_API_KEY') || '').trim();
    if (!shared || shared === 'not-configured') return '';
    const base = this.baseUrl();
    // Allow shared platform key for OpenAI-compatible Gemini / OpenAI hosts.
    if (
      base.includes('api.openai.com') ||
      base.includes('generativelanguage.googleapis.com')
    ) {
      return shared;
    }
    return '';
  }

  private baseUrl(): string {
    return (
      this.config.get<string>('OPENAI_API_BASE_URL') ||
      this.config.get<string>('AI_API_BASE_URL') ||
      'https://api.openai.com/v1'
    ).replace(/\/$/, '');
  }

  private async request(path: string, init: RequestInit = {}): Promise<Response> {
    const key = this.apiKey();
    if (!key) throw new ProviderError(PROVIDER_NOT_CONFIGURED, 'OpenAI is not configured.', 503);
    const headers = new Headers(init.headers);
    headers.set('Authorization', `Bearer ${key}`);
    if (!headers.has('content-type') && init.body) headers.set('content-type', 'application/json');
    const res = await fetch(`${this.baseUrl()}${path}`, { ...init, headers });
    return res;
  }

  async authenticate(): Promise<ProviderAuthResult> {
    const res = await this.request('/models');
    if (!res.ok) {
      this.logger.warn(JSON.stringify({ event: 'OPENAI_AUTH_FAILED', status: res.status }));
      throw new ProviderError(PROVIDER_AUTH_FAILED, 'تعذر التحقق من اتصال OpenAI.', 502);
    }
    const json = (await res.json()) as { data?: Array<{ id?: string }> };
    const modelsSample = (json.data ?? []).map((m) => m.id).filter(Boolean).slice(0, 8) as string[];
    return { ok: true, provider: this.id, modelsSample };
  }

  async completeText(input: TextCompleteInput) {
    const content: unknown[] = [{ type: 'text', text: input.user }];
    for (const image of input.images ?? []) {
      content.push({
        type: 'image_url',
        image_url: { url: `data:${image.mimeType};base64,${image.dataBase64}` },
      });
    }
    const body: Record<string, unknown> = {
      model: input.model,
      messages: [
        { role: 'system', content: input.system },
        { role: 'user', content },
      ],
    };
    if (input.json) body.response_format = { type: 'json_object' };
    const res = await this.request('/chat/completions', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    if (res.status === 429) {
      throw new ProviderError(PROVIDER_RATE_LIMITED, 'OpenAI رفض الطلب مؤقتاً بسبب حد الاستخدام. أعد المحاولة لاحقاً.', 429);
    }
    if (!res.ok) {
      this.logger.warn(JSON.stringify({ event: 'OPENAI_TEXT_FAILED', status: res.status }));
      throw new ProviderError(PROVIDER_AUTH_FAILED, 'تعذر إكمال النص عبر OpenAI.', 502);
    }
    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number };
      model?: string;
    };
    const text = json.choices?.[0]?.message?.content?.trim() || '';
    return {
      text,
      model: json.model || input.model,
      promptTokens: json.usage?.prompt_tokens,
      completionTokens: json.usage?.completion_tokens,
    };
  }

  async createImageJob(input: ImageGenerateInput): Promise<GenerationJobHandle> {
    const size = this.mapSize(input.aspectRatio, input.resolution);
    const body: Record<string, unknown> = {
      model: input.model,
      prompt: input.prompt,
      n: 1,
      size,
    };
    if (input.quality) body.quality = input.quality;
    const res = await this.request('/images/generations', { method: 'POST', body: JSON.stringify(body) });
    if (!res.ok) {
      this.logger.warn(JSON.stringify({ event: 'OPENAI_IMAGE_FAILED', status: res.status }));
      throw new ProviderError(PROVIDER_AUTH_FAILED, 'تعذر إنشاء الصورة عبر OpenAI.', 502);
    }
    const json = (await res.json()) as { data?: Array<{ b64_json?: string; url?: string }> };
    const b64 = json.data?.[0]?.b64_json;
    if (!b64) throw new ProviderError(CAPABILITY_NOT_SUPPORTED, 'OpenAI image response had no image bytes.', 502);
    const id = `openai-img-${Date.now()}`;
    this.completed.set(id, { buffer: Buffer.from(b64, 'base64'), mimeType: 'image/png' });
    return { providerJobId: id, status: 'completed' };
  }

  async getGenerationStatus(providerJobId: string): Promise<GenerationStatus> {
    if (this.completed.has(providerJobId)) return { providerJobId, status: 'completed' };
    return { providerJobId, status: 'failed', error: 'Unknown OpenAI image job' };
  }

  async getGenerationResult(providerJobId: string): Promise<GenerationResult> {
    const found = this.completed.get(providerJobId);
    if (!found) throw new ProviderError(CAPABILITY_NOT_SUPPORTED, 'OpenAI image job not found.', 404);
    return found;
  }

  async cancelGenerationJob(): Promise<void> {
    throw new ProviderError(CAPABILITY_NOT_SUPPORTED, 'OpenAI Images API does not expose an async cancel endpoint.', 501);
  }

  async synthesize(input: TtsInput): Promise<GenerationResult & { dialect?: string; voice?: string; sampleRate?: number }> {
    const dialect = (input.dialect || '').toLowerCase();
    if (dialect.includes('iraqi') || dialect.includes('irq') || dialect === 'ar-iq') {
      throw new ProviderError(
        IRAQI_TTS_NOT_CONFIGURED,
        'Iraqi Arabic TTS is not available on OpenAI. Do not label this voice as Iraqi.',
        501,
      );
    }
    const model = input.model || this.config.get<string>('CREATIVE_OPENAI_TTS_MODEL')?.trim() || 'tts-1';
    const voice = input.voice || (input.gender === 'female' ? 'nova' : 'onyx');
    const res = await this.request('/audio/speech', {
      method: 'POST',
      body: JSON.stringify({
        model,
        voice,
        input: input.text,
        speed: input.speed || 1,
      }),
    });
    if (res.status === 429) {
      throw new ProviderError(PROVIDER_RATE_LIMITED, 'OpenAI TTS rate limited.', 429);
    }
    if (!res.ok) {
      this.logger.warn(JSON.stringify({ event: 'OPENAI_TTS_FAILED', status: res.status }));
      throw new ProviderError(PROVIDER_AUTH_FAILED, 'تعذر توليد الصوت عبر OpenAI.', 502);
    }
    const buffer = Buffer.from(await res.arrayBuffer());
    return { buffer, mimeType: 'audio/mpeg', dialect: 'msa', voice, sampleRate: 24000 };
  }

  /** Official GPT Image 2 sizes from OpenAI image generation docs. */
  private mapSize(aspect?: string, resolution?: string): string {
    if (resolution === '1024x1536' || resolution === '1536x1024' || resolution === '1024x1024') return resolution;
    if (aspect === '9:16' || aspect === '4:5') return '1024x1536';
    if (aspect === '16:9') return '1536x1024';
    return '1024x1024';
  }
}
