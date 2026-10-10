import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CAPABILITY_NOT_SUPPORTED,
  PROVIDER_AUTH_FAILED,
  PROVIDER_NOT_CONFIGURED,
  PROVIDER_RATE_LIMITED,
  ProviderError,
} from './provider-error';
import type {
  AIImageProvider,
  AIVideoProvider,
  GenerationJobHandle,
  GenerationResult,
  GenerationStatus,
  ImageGenerateInput,
  ProviderAuthResult,
  VideoGenerateInput,
} from './types';

/**
 * OpenRouter media layer — Image API + async Video API.
 * Docs:
 * https://openrouter.ai/docs/guides/overview/multimodal/image-generation
 * https://openrouter.ai/docs/guides/overview/multimodal/video-generation
 */
@Injectable()
export class OpenRouterProvider implements AIImageProvider, AIVideoProvider {
  readonly id = 'openrouter';
  private readonly logger = new Logger(OpenRouterProvider.name);
  private readonly completedImages = new Map<string, GenerationResult>();

  constructor(private readonly config: ConfigService) {}

  isConfigured(): boolean {
    return Boolean(this.apiKey());
  }

  private apiKey(): string {
    return (this.config.get<string>('OPENROUTER_API_KEY') || '').trim();
  }

  private baseUrl(): string {
    return (this.config.get<string>('OPENROUTER_API_BASE_URL') || 'https://openrouter.ai/api/v1').replace(/\/$/, '');
  }

  private headers(json = true): Headers {
    const key = this.apiKey();
    if (!key) throw new ProviderError(PROVIDER_NOT_CONFIGURED, 'OpenRouter is not configured.', 503);
    const headers = new Headers();
    headers.set('Authorization', `Bearer ${key}`);
    if (json) headers.set('content-type', 'application/json');
    const referer = this.config.get<string>('API_PUBLIC_URL') || this.config.get<string>('WEB_PUBLIC_URL');
    if (referer) headers.set('HTTP-Referer', referer);
    headers.set('X-Title', 'Chatloora Creative Studio');
    return headers;
  }

  private async request(path: string, init: RequestInit = {}): Promise<Response> {
    return fetch(`${this.baseUrl()}${path}`, { ...init, headers: this.headers(!init.body || typeof init.body === 'string') });
  }

  async authenticate(): Promise<ProviderAuthResult> {
    const res = await this.request('/models');
    if (!res.ok) {
      this.logger.warn(JSON.stringify({ event: 'OPENROUTER_AUTH_FAILED', status: res.status }));
      throw new ProviderError(PROVIDER_AUTH_FAILED, 'تعذر التحقق من اتصال OpenRouter.', 502);
    }
    const json = (await res.json()) as { data?: Array<{ id?: string }> };
    const modelsSample = (json.data ?? []).map((m) => m.id).filter(Boolean).slice(0, 8) as string[];
    return { ok: true, provider: this.id, modelsSample };
  }

  async listImageModels(): Promise<Array<{ id: string; supported?: Record<string, unknown> }>> {
    const res = await this.request('/images/models');
    if (!res.ok) {
      this.logger.warn(JSON.stringify({ event: 'OPENROUTER_IMAGE_MODELS_FAILED', status: res.status }));
      throw new ProviderError(PROVIDER_AUTH_FAILED, 'تعذر جلب نماذج الصور من OpenRouter.', 502);
    }
    const json = (await res.json()) as { data?: Array<{ id: string; supported_parameters?: Record<string, unknown> }> };
    return (json.data ?? []).map((row) => ({ id: row.id, supported: row.supported_parameters }));
  }

  async listVideoModels(): Promise<
    Array<{
      id: string;
      supported_durations?: number[];
      supported_resolutions?: string[];
      supported_aspect_ratios?: string[];
      supported_parameters?: Record<string, unknown>;
    }>
  > {
    const res = await this.request('/videos/models');
    if (!res.ok) {
      this.logger.warn(JSON.stringify({ event: 'OPENROUTER_VIDEO_MODELS_FAILED', status: res.status }));
      throw new ProviderError(PROVIDER_AUTH_FAILED, 'تعذر جلب نماذج الفيديو من OpenRouter.', 502);
    }
    const json = (await res.json()) as {
      data?: Array<{
        id: string;
        supported_durations?: number[];
        supported_resolutions?: string[];
        supported_aspect_ratios?: string[];
        supported_parameters?: Record<string, unknown>;
      }>;
    };
    return json.data ?? [];
  }

  async createImageJob(input: ImageGenerateInput): Promise<GenerationJobHandle> {
    const body: Record<string, unknown> = { model: input.model, prompt: input.prompt };
    if (input.aspectRatio) body.aspect_ratio = input.aspectRatio;
    if (input.resolution) body.resolution = input.resolution;
    if (input.quality) body.quality = input.quality;
    if (input.referenceImageUrls?.length) {
      body.input_references = input.referenceImageUrls.map((url) => ({
        type: 'image_url',
        image_url: { url },
      }));
    }
    const res = await this.request('/images', { method: 'POST', body: JSON.stringify(body) });
    if (res.status === 429) {
      throw new ProviderError(PROVIDER_RATE_LIMITED, 'OpenRouter رفض الطلب مؤقتاً بسبب حد الاستخدام.', 429);
    }
    if (!res.ok) {
      this.logger.warn(JSON.stringify({ event: 'OPENROUTER_IMAGE_FAILED', status: res.status }));
      throw new ProviderError(PROVIDER_AUTH_FAILED, 'تعذر إنشاء الصورة عبر OpenRouter.', 502);
    }
    const json = (await res.json()) as { data?: Array<{ b64_json?: string; media_type?: string }> };
    const first = json.data?.[0];
    if (!first?.b64_json) throw new ProviderError(CAPABILITY_NOT_SUPPORTED, 'OpenRouter image response had no image bytes.', 502);
    const id = `openrouter-img-${Date.now()}`;
    this.completedImages.set(id, {
      buffer: Buffer.from(first.b64_json, 'base64'),
      mimeType: first.media_type || 'image/png',
    });
    return { providerJobId: id, status: 'completed' };
  }

  async createVideoJob(input: VideoGenerateInput): Promise<GenerationJobHandle> {
    const body: Record<string, unknown> = { model: input.model, prompt: input.prompt };
    if (input.durationSec) body.duration = input.durationSec;
    if (input.resolution) body.resolution = input.resolution;
    if (input.aspectRatio) body.aspect_ratio = input.aspectRatio;
    if (input.frameImageUrls?.[0]) {
      body.frame_images = [
        { type: 'image_url', image_url: { url: input.frameImageUrls[0] }, frame_type: 'first_frame' },
      ];
    }
    if (input.referenceImageUrls?.length) {
      body.input_references = input.referenceImageUrls.map((url) => ({
        type: 'image_url',
        image_url: { url },
      }));
    }
    const res = await this.request('/videos', { method: 'POST', body: JSON.stringify(body) });
    if (res.status === 429) {
      throw new ProviderError(PROVIDER_RATE_LIMITED, 'OpenRouter رفض الطلب مؤقتاً بسبب حد الاستخدام.', 429);
    }
    if (res.status !== 202 && !res.ok) {
      this.logger.warn(JSON.stringify({ event: 'OPENROUTER_VIDEO_FAILED', status: res.status }));
      throw new ProviderError(PROVIDER_AUTH_FAILED, 'تعذر إنشاء مهمة الفيديو عبر OpenRouter.', 502);
    }
    const json = (await res.json()) as { id?: string; polling_url?: string; status?: string };
    if (!json.id) throw new ProviderError(PROVIDER_AUTH_FAILED, 'OpenRouter video job missing id.', 502);
    const status = json.status === 'completed' ? 'completed' : json.status === 'in_progress' ? 'in_progress' : 'pending';
    return { providerJobId: json.id, status, pollingUrl: json.polling_url };
  }

  async getGenerationStatus(providerJobId: string): Promise<GenerationStatus> {
    if (this.completedImages.has(providerJobId)) return { providerJobId, status: 'completed' };
    const res = await this.request(`/videos/${encodeURIComponent(providerJobId)}`);
    if (!res.ok) {
      this.logger.warn(JSON.stringify({ event: 'OPENROUTER_VIDEO_STATUS_FAILED', status: res.status }));
      throw new ProviderError(PROVIDER_AUTH_FAILED, 'تعذر قراءة حالة مهمة الفيديو.', 502);
    }
    const json = (await res.json()) as { status?: string; error?: string; usage?: { cost?: number } };
    const raw = json.status || 'pending';
    const status =
      raw === 'expired' || raw === 'failed' || raw === 'cancelled' || raw === 'completed' || raw === 'in_progress'
        ? raw
        : 'pending';
    return { providerJobId, status, error: json.error, costUsd: json.usage?.cost };
  }

  async cancelGenerationJob(): Promise<void> {
    throw new ProviderError(
      CAPABILITY_NOT_SUPPORTED,
      'OpenRouter video API does not document a cancel endpoint; jobs are polled until a terminal status.',
      501,
    );
  }

  async getGenerationResult(providerJobId: string): Promise<GenerationResult> {
    const cached = this.completedImages.get(providerJobId);
    if (cached) return cached;
    const res = await fetch(`${this.baseUrl()}/videos/${encodeURIComponent(providerJobId)}/content?index=0`, {
      headers: this.headers(false),
    });
    if (!res.ok) {
      this.logger.warn(JSON.stringify({ event: 'OPENROUTER_VIDEO_CONTENT_FAILED', status: res.status }));
      throw new ProviderError(PROVIDER_AUTH_FAILED, 'تعذر تنزيل فيديو OpenRouter.', 502);
    }
    const buf = Buffer.from(await res.arrayBuffer());
    return { buffer: buf, mimeType: res.headers.get('content-type') || 'video/mp4' };
  }
}
