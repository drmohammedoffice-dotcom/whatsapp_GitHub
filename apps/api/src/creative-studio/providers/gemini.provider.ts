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

type CachedResult = GenerationResult & { error?: string };

/**
 * Native Gemini media (images via generateContent, video via Veo predictLongRunning).
 * Uses the same platform key as chat (OPENAI_API_KEY / AI_API_KEY).
 *
 * Docs:
 * https://ai.google.dev/gemini-api/docs/image-generation
 * https://ai.google.dev/gemini-api/docs/video
 */
@Injectable()
export class GeminiProvider implements AIImageProvider, AIVideoProvider {
  readonly id = 'gemini';
  private readonly logger = new Logger(GeminiProvider.name);
  private readonly cache = new Map<string, CachedResult>();

  constructor(private readonly config: ConfigService) {}

  isConfigured(): boolean {
    return Boolean(this.apiKey());
  }

  private apiKey(): string {
    const dedicated = (this.config.get<string>('OPENAI_API_KEY') || '').trim();
    if (dedicated && dedicated !== 'not-configured') return dedicated;
    const shared = (this.config.get<string>('AI_API_KEY') || process.env.AI_API_KEY || '').trim();
    if (shared && shared !== 'not-configured') return shared;
    const numbered = (process.env.AI_API_KEY_1 || '').trim();
    return numbered && numbered !== 'not-configured' ? numbered : '';
  }

  private baseUrl(): string {
    return (
      this.config.get<string>('GEMINI_API_BASE_URL') ||
      process.env.GEMINI_API_BASE_URL ||
      'https://generativelanguage.googleapis.com/v1beta'
    ).replace(/\/$/, '');
  }

  imageModel(): string {
    return (
      this.config.get<string>('CREATIVE_GEMINI_IMAGE_MODEL')?.trim() ||
      process.env.CREATIVE_GEMINI_IMAGE_MODEL?.trim() ||
      'gemini-3.1-flash-image'
    );
  }

  videoModel(): string {
    return (
      this.config.get<string>('CREATIVE_GEMINI_VIDEO_MODEL')?.trim() ||
      process.env.CREATIVE_GEMINI_VIDEO_MODEL?.trim() ||
      'veo-3.1-generate-preview'
    );
  }

  private async request(path: string, init: RequestInit = {}): Promise<Response> {
    const key = this.apiKey();
    if (!key) throw new ProviderError(PROVIDER_NOT_CONFIGURED, 'Gemini is not configured.', 503);
    const headers = new Headers(init.headers);
    headers.set('x-goog-api-key', key);
    if (!headers.has('content-type') && init.body) headers.set('content-type', 'application/json');
    const url = path.startsWith('http') ? path : `${this.baseUrl()}/${path.replace(/^\//, '')}`;
    return fetch(url, { ...init, headers });
  }

  async authenticate(): Promise<ProviderAuthResult> {
    const res = await this.request('models?pageSize=20');
    if (!res.ok) {
      this.logger.warn(JSON.stringify({ event: 'GEMINI_AUTH_FAILED', status: res.status }));
      throw new ProviderError(PROVIDER_AUTH_FAILED, 'تعذر التحقق من اتصال Gemini.', 502);
    }
    const json = (await res.json()) as { models?: Array<{ name?: string }> };
    const modelsSample = (json.models ?? [])
      .map((m) => (m.name || '').replace(/^models\//, ''))
      .filter(Boolean)
      .slice(0, 8);
    return { ok: true, provider: this.id, modelsSample };
  }

  async createImageJob(input: ImageGenerateInput): Promise<GenerationJobHandle> {
    const model = (input.model || this.imageModel()).replace(/^models\//, '');
    const parts: Array<Record<string, unknown>> = [{ text: input.prompt }];
    for (const url of input.referenceImageUrls ?? []) {
      const parsed = this.parseDataUrl(url);
      if (parsed) parts.push({ inlineData: { mimeType: parsed.mimeType, data: parsed.data } });
    }

    const body: Record<string, unknown> = {
      contents: [{ role: 'user', parts }],
      generationConfig: {
        responseModalities: ['TEXT', 'IMAGE'],
        ...(input.aspectRatio
          ? { imageConfig: { aspectRatio: this.normalizeAspect(input.aspectRatio) } }
          : {}),
      },
    };

    const res = await this.request(`models/${model}:generateContent`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
    if (res.status === 429) {
      throw new ProviderError(PROVIDER_RATE_LIMITED, 'تجاوزت حد استخدام Gemini للصور. أعد المحاولة لاحقاً.', 429);
    }
    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      this.logger.warn(JSON.stringify({ event: 'GEMINI_IMAGE_FAILED', status: res.status, body: errBody.slice(0, 400) }));
      throw new ProviderError(PROVIDER_AUTH_FAILED, 'تعذر إنشاء الصورة عبر Gemini.', 502);
    }

    const json = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ inlineData?: { mimeType?: string; data?: string }; text?: string }> } }>;
    };
    const inline = json.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data)?.inlineData;
    if (!inline?.data) {
      throw new ProviderError(CAPABILITY_NOT_SUPPORTED, 'Gemini لم يُرجع بيانات صورة.', 502);
    }

    const id = `gemini-img-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    this.cache.set(id, {
      buffer: Buffer.from(inline.data, 'base64'),
      mimeType: inline.mimeType || 'image/png',
    });
    return { providerJobId: id, status: 'completed' };
  }

  async createVideoJob(input: VideoGenerateInput): Promise<GenerationJobHandle> {
    const model = (input.model || this.videoModel()).replace(/^models\//, '');
    const instance: Record<string, unknown> = { prompt: input.prompt };

    const frame = input.frameImageUrls?.[0] || input.referenceImageUrls?.[0];
    if (frame) {
      const parsed = this.parseDataUrl(frame);
      if (parsed) {
        instance.image = {
          bytesBase64Encoded: parsed.data,
          mimeType: parsed.mimeType,
        };
      }
    }

    const parameters: Record<string, unknown> = {};
    if (input.aspectRatio) parameters.aspectRatio = this.normalizeAspect(input.aspectRatio);
    if (input.durationSec && Number.isFinite(input.durationSec)) {
      // Veo commonly supports 4 / 6 / 8 seconds
      const allowed = [4, 6, 8];
      const nearest = allowed.reduce((a, b) =>
        Math.abs(b - Number(input.durationSec)) < Math.abs(a - Number(input.durationSec)) ? b : a,
      );
      parameters.durationSeconds = nearest;
    }

    const res = await this.request(`models/${model}:predictLongRunning`, {
      method: 'POST',
      body: JSON.stringify({ instances: [instance], parameters }),
    });
    if (res.status === 429) {
      throw new ProviderError(PROVIDER_RATE_LIMITED, 'تجاوزت حد استخدام Gemini للفيديو. أعد المحاولة لاحقاً.', 429);
    }
    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      this.logger.warn(JSON.stringify({ event: 'GEMINI_VIDEO_START_FAILED', status: res.status, body: errBody.slice(0, 400) }));
      throw new ProviderError(PROVIDER_AUTH_FAILED, 'تعذر بدء توليد الفيديو عبر Gemini.', 502);
    }

    const json = (await res.json()) as { name?: string };
    if (!json.name) {
      throw new ProviderError(CAPABILITY_NOT_SUPPORTED, 'Gemini لم يُرجع معرّف عملية الفيديو.', 502);
    }
    // Use the Google operation name as the job id so any worker process can poll it.
    return { providerJobId: json.name, status: 'in_progress', pollingUrl: json.name };
  }

  async getGenerationStatus(providerJobId: string): Promise<GenerationStatus> {
    if (this.cache.has(providerJobId)) {
      const cached = this.cache.get(providerJobId)!;
      if (cached.error) return { providerJobId, status: 'failed', error: cached.error };
      return { providerJobId, status: 'completed' };
    }

    // Image jobs are sync and cached; anything else is treated as a long-running operation name.
    if (providerJobId.startsWith('gemini-img-')) {
      return { providerJobId, status: 'failed', error: 'Unknown Gemini image job' };
    }

    const opName = providerJobId.startsWith('operations/')
      ? providerJobId
      : providerJobId.startsWith('models/')
        ? providerJobId
        : providerJobId;

    const res = await this.request(opName);
    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      this.logger.warn(JSON.stringify({ event: 'GEMINI_OP_POLL_FAILED', status: res.status, body: errBody.slice(0, 300) }));
      return { providerJobId, status: 'failed', error: 'فشل استعلام عملية Gemini' };
    }

    const json = (await res.json()) as {
      done?: boolean;
      error?: { message?: string };
      response?: Record<string, unknown>;
    };

    if (json.error?.message) {
      this.cache.set(providerJobId, { buffer: Buffer.alloc(0), mimeType: 'application/octet-stream', error: json.error.message });
      return { providerJobId, status: 'failed', error: json.error.message };
    }
    if (!json.done) return { providerJobId, status: 'in_progress' };

    try {
      const result = await this.extractVideoResult(json.response || {});
      this.cache.set(providerJobId, result);
      return { providerJobId, status: 'completed' };
    } catch (e) {
      const message = e instanceof Error ? e.message : 'تعذر استخراج فيديو Gemini';
      this.cache.set(providerJobId, { buffer: Buffer.alloc(0), mimeType: 'application/octet-stream', error: message });
      return { providerJobId, status: 'failed', error: message };
    }
  }

  async getGenerationResult(providerJobId: string): Promise<GenerationResult> {
    const cached = this.cache.get(providerJobId);
    if (cached?.error) throw new ProviderError(CAPABILITY_NOT_SUPPORTED, cached.error, 502);
    if (cached?.buffer?.length) return cached;

    // Force one status refresh for video jobs
    const status = await this.getGenerationStatus(providerJobId);
    if (status.status !== 'completed') {
      throw new ProviderError(CAPABILITY_NOT_SUPPORTED, status.error || 'Gemini job not ready.', 404);
    }
    const again = this.cache.get(providerJobId);
    if (!again?.buffer?.length) throw new ProviderError(CAPABILITY_NOT_SUPPORTED, 'Gemini video bytes missing.', 502);
    return again;
  }

  async cancelGenerationJob(providerJobId: string): Promise<void> {
    this.cache.delete(providerJobId);
  }

  private normalizeAspect(aspect: string): string {
    const a = aspect.trim();
    if (['1:1', '9:16', '16:9', '3:4', '4:3', '4:5', '5:4', '21:9'].includes(a)) return a;
    if (a === 'portrait') return '9:16';
    if (a === 'landscape') return '16:9';
    return '1:1';
  }

  private parseDataUrl(url: string): { mimeType: string; data: string } | null {
    const m = /^data:([^;]+);base64,(.+)$/i.exec(url);
    if (!m) return null;
    return { mimeType: m[1], data: m[2] };
  }

  private async extractVideoResult(response: Record<string, unknown>): Promise<GenerationResult> {
    const generateVideoResponse =
      (response.generateVideoResponse as Record<string, unknown> | undefined) ||
      (response as Record<string, unknown>);

    const samples =
      (generateVideoResponse.generatedSamples as Array<Record<string, unknown>> | undefined) ||
      (generateVideoResponse.generatedVideos as Array<Record<string, unknown>> | undefined) ||
      [];

    const first = samples[0] || {};
    const video = (first.video as Record<string, unknown> | undefined) || first;
    const inline =
      (video.bytesBase64Encoded as string | undefined) ||
      ((video.inlineData as { data?: string } | undefined)?.data);

    if (inline) {
      return {
        buffer: Buffer.from(inline, 'base64'),
        mimeType: ((video.mimeType as string) || (video.inlineData as { mimeType?: string })?.mimeType || 'video/mp4'),
      };
    }

    const uri = (video.uri as string | undefined) || (video.url as string | undefined);
    if (!uri) {
      throw new Error('Gemini video response missing uri/bytes');
    }

    const res = await this.request(uri);
    if (!res.ok) {
      throw new Error(`Failed to download Gemini video (${res.status})`);
    }
    const buffer = Buffer.from(await res.arrayBuffer());
    const mimeType = res.headers.get('content-type') || 'video/mp4';
    return { buffer, mimeType };
  }
}
