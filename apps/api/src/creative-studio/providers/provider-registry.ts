import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GeminiProvider } from './gemini.provider';
import { OpenAIProvider } from './openai.provider';
import { OpenRouterProvider } from './openrouter.provider';
import { CAPABILITY_NOT_SUPPORTED, INVALID_MODEL, ProviderError } from './provider-error';
import type { AIModelCapabilities, RegisteredModel } from './types';

/**
 * Central model IDs — do not scatter IDs across the app.
 * Gemini is the default media provider for Creative Studio (images + video).
 */
@Injectable()
export class ProviderRegistry {
  constructor(
    private readonly config: ConfigService,
    private readonly openai: OpenAIProvider,
    private readonly openrouter: OpenRouterProvider,
    private readonly gemini: GeminiProvider,
  ) {}

  openaiTextModel(): string {
    return this.config.get<string>('CREATIVE_OPENAI_TEXT_MODEL')?.trim() || 'gemini-3.6-flash';
  }

  openaiImageModel(): string {
    return this.config.get<string>('CREATIVE_OPENAI_IMAGE_MODEL')?.trim() || 'gpt-image-2';
  }

  configured(): RegisteredModel[] {
    const rows: RegisteredModel[] = [
      {
        provider: 'gemini',
        model: this.gemini.imageModel(),
        enabled: this.gemini.isConfigured(),
        priority: 5,
        source: 'config',
        capabilities: {
          imageGeneration: true,
          imageEditing: true,
          referenceImage: true,
          resolutions: ['1024x1024', '1024x1536', '1536x1024'],
          aspectRatios: ['1:1', '9:16', '16:9', '3:4', '4:3'],
        },
      },
      {
        provider: 'gemini',
        model: this.gemini.videoModel(),
        enabled: this.gemini.isConfigured(),
        priority: 6,
        source: 'config',
        capabilities: {
          textToVideo: true,
          imageToVideo: true,
          referenceImage: true,
          aspectRatios: ['16:9', '9:16'],
          maxDurationSeconds: 8,
        },
      },
      {
        provider: 'openai',
        model: this.openaiTextModel(),
        enabled: this.openai.isConfigured(),
        priority: 10,
        source: 'config',
        capabilities: { text: true, vision: true },
      },
      {
        provider: 'openai',
        model: this.openaiImageModel(),
        enabled: this.openai.isConfigured(),
        priority: 40,
        source: 'config',
        capabilities: {
          imageGeneration: true,
          imageEditing: false,
          referenceImage: false,
          resolutions: ['1024x1024', '1024x1536', '1536x1024'],
          aspectRatios: ['1:1', '9:16', '16:9'],
        },
      },
      {
        provider: 'fal',
        model: '',
        enabled: false,
        priority: 90,
        source: 'config',
        capabilities: { imageGeneration: true, imageToVideo: true, textToVideo: true },
      },
      {
        provider: 'runway',
        model: '',
        enabled: false,
        priority: 91,
        source: 'config',
        capabilities: { imageToVideo: true, textToVideo: true },
      },
      {
        provider: 'iraqi-tts',
        model: '',
        enabled: false,
        priority: 92,
        source: 'config',
        capabilities: { tts: true, audioGeneration: true },
      },
      {
        provider: 'lipsync',
        model: '',
        enabled: false,
        priority: 93,
        source: 'config',
        capabilities: { lipSync: true },
      },
      {
        provider: 'upscale',
        model: '',
        enabled: false,
        priority: 94,
        source: 'config',
        capabilities: { upscaling: true },
      },
    ];
    return rows;
  }

  async snapshot(): Promise<{
    openaiConfigured: boolean;
    openrouterConfigured: boolean;
    geminiConfigured: boolean;
    models: RegisteredModel[];
    openrouterImageModels: string[];
    openrouterVideoModels: string[];
  }> {
    const models = this.configured();
    let openrouterImageModels: string[] = [];
    let openrouterVideoModels: string[] = [];
    // Prefer Gemini for media; still discover OpenRouter as optional fallback when Gemini is off.
    if (this.openrouter.isConfigured() && !this.gemini.isConfigured()) {
      try {
        const images = await this.openrouter.listImageModels();
        openrouterImageModels = images.map((m) => m.id);
        for (const image of images) {
          models.push(this.fromOpenRouterImage(image.id, image.supported));
        }
      } catch {
        /* discovery optional during status */
      }
      try {
        const videos = await this.openrouter.listVideoModels();
        openrouterVideoModels = videos.map((m) => m.id);
        for (const video of videos) {
          models.push(this.fromOpenRouterVideo(video));
        }
      } catch {
        /* discovery optional */
      }
    }
    return {
      openaiConfigured: this.openai.isConfigured(),
      openrouterConfigured: this.openrouter.isConfigured(),
      geminiConfigured: this.gemini.isConfigured(),
      models,
      openrouterImageModels,
      openrouterVideoModels,
    };
  }

  pickFallback(
    capability: keyof AIModelCapabilities,
    required?: { aspectRatio?: string; resolution?: string; durationSec?: number },
  ): RegisteredModel | null {
    const ranked = this.configured()
      .filter((m) => m.enabled && m.capabilities[capability])
      .sort((a, b) => a.priority - b.priority);
    for (const model of ranked) {
      if (
        required?.aspectRatio &&
        model.capabilities.aspectRatios?.length &&
        !model.capabilities.aspectRatios.includes(required.aspectRatio)
      ) {
        continue;
      }
      if (
        required?.resolution &&
        model.capabilities.resolutions?.length &&
        !model.capabilities.resolutions.includes(required.resolution)
      ) {
        continue;
      }
      if (
        required?.durationSec &&
        model.capabilities.maxDurationSeconds &&
        required.durationSec > model.capabilities.maxDurationSeconds
      ) {
        continue;
      }
      return model;
    }
    return ranked[0] ?? null;
  }

  async selectModel(input: {
    capability: keyof AIModelCapabilities;
    provider?: string;
    model?: string;
    aspectRatio?: string;
    resolution?: string;
    durationSec?: number;
    requireReference?: boolean;
  }): Promise<RegisteredModel> {
    const snap = await this.snapshot();
    const eligible = snap.models.filter((m) => {
      if (!m.enabled || !m.model) return false;
      if (input.provider && m.provider !== input.provider) return false;
      if (input.model && m.model !== input.model) return false;
      if (!m.capabilities[input.capability]) return false;
      if (input.requireReference && !m.capabilities.referenceImage) return false;
      if (
        input.aspectRatio &&
        m.capabilities.aspectRatios?.length &&
        !m.capabilities.aspectRatios.includes(input.aspectRatio)
      ) {
        return false;
      }
      if (
        input.resolution &&
        m.capabilities.resolutions?.length &&
        !m.capabilities.resolutions.includes(input.resolution)
      ) {
        return false;
      }
      if (
        input.durationSec &&
        m.capabilities.maxDurationSeconds &&
        input.durationSec > m.capabilities.maxDurationSeconds
      ) {
        return false;
      }
      return true;
    });
    eligible.sort((a, b) => a.priority - b.priority);
    const chosen = eligible[0];
    if (!chosen) {
      throw new ProviderError(
        input.model ? INVALID_MODEL : CAPABILITY_NOT_SUPPORTED,
        'لا يوجد نموذج مُعدّ يدعم المطلوب (النسبة/الدقة/الصور المرجعية).',
        400,
      );
    }
    return chosen;
  }

  private fromOpenRouterImage(id: string, supported?: Record<string, unknown>): RegisteredModel {
    const caps: AIModelCapabilities = {
      imageGeneration: true,
      referenceImage: Boolean(supported && 'input_references' in supported),
      imageEditing: Boolean(supported && 'input_references' in supported),
    };
    const resolution = supported?.resolution as { values?: string[] } | undefined;
    const aspect = supported?.aspect_ratio as { values?: string[] } | undefined;
    if (resolution?.values) caps.resolutions = resolution.values;
    if (aspect?.values) caps.aspectRatios = aspect.values;
    return { provider: 'openrouter', model: id, enabled: true, priority: 50, capabilities: caps, source: 'discovery' };
  }

  private fromOpenRouterVideo(row: {
    id: string;
    supported_durations?: number[];
    supported_resolutions?: string[];
    supported_aspect_ratios?: string[];
    supported_parameters?: Record<string, unknown>;
  }): RegisteredModel {
    const params = row.supported_parameters ?? {};
    return {
      provider: 'openrouter',
      model: row.id,
      enabled: true,
      priority: 51,
      source: 'discovery',
      capabilities: {
        textToVideo: true,
        imageToVideo: Boolean(params.frame_images),
        referenceImage: Boolean(params.input_references),
        resolutions: row.supported_resolutions,
        aspectRatios: row.supported_aspect_ratios,
        maxDurationSeconds: row.supported_durations?.length ? Math.max(...row.supported_durations) : undefined,
      },
    };
  }
}
