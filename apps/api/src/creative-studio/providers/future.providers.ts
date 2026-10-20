import { Injectable } from '@nestjs/common';
import {
  CAPABILITY_NOT_SUPPORTED,
  FOUR_K_UPSCALE_NOT_CONFIGURED,
  IRAQI_TTS_NOT_CONFIGURED,
  LIPSYNC_NOT_CONFIGURED,
  MUSIC_NOT_CONFIGURED,
  PROVIDER_NOT_CONFIGURED,
  ProviderError,
} from './provider-error';
import type {
  AILipSyncProvider,
  AIMusicProvider,
  AITTSProvider,
  AIUpscaleProvider,
  ProviderAuthResult,
} from './types';

abstract class UnconfiguredProvider {
  abstract readonly id: string;
  isConfigured(): boolean {
    return false;
  }
  async authenticate(): Promise<ProviderAuthResult> {
    throw new ProviderError(PROVIDER_NOT_CONFIGURED, `${this.id} is not configured.`, 503);
  }
}

@Injectable()
export class FalProvider extends UnconfiguredProvider {
  readonly id = 'fal';
}

@Injectable()
export class RunwayProvider extends UnconfiguredProvider {
  readonly id = 'runway';
}

@Injectable()
export class IraqiTTSProvider implements AITTSProvider {
  readonly id = 'iraqi-tts';
  isConfigured(): boolean {
    return false;
  }
  async authenticate(): Promise<ProviderAuthResult> {
    throw new ProviderError(PROVIDER_NOT_CONFIGURED, 'Iraqi TTS provider is not configured.', 503);
  }
  async synthesize(): Promise<never> {
    throw new ProviderError(IRAQI_TTS_NOT_CONFIGURED, 'Iraqi Arabic TTS is not configured. OpenAI TTS is not Iraqi dialect.', 501);
  }
}

@Injectable()
export class LipSyncProvider implements AILipSyncProvider {
  readonly id = 'lipsync';
  isConfigured(): boolean {
    return false;
  }
  async authenticate(): Promise<ProviderAuthResult> {
    throw new ProviderError(PROVIDER_NOT_CONFIGURED, 'Lip-sync provider is not configured.', 503);
  }
  async createLipSyncJob(): Promise<never> {
    throw new ProviderError(LIPSYNC_NOT_CONFIGURED, 'Lip-sync provider is not configured.', 501);
  }
}

@Injectable()
export class UpscaleProvider implements AIUpscaleProvider {
  readonly id = 'upscale';
  isConfigured(): boolean {
    return false;
  }
  async authenticate(): Promise<ProviderAuthResult> {
    throw new ProviderError(PROVIDER_NOT_CONFIGURED, 'Upscale provider is not configured.', 503);
  }
  async upscale(): Promise<never> {
    throw new ProviderError(FOUR_K_UPSCALE_NOT_CONFIGURED, '4K upscaling is not configured.', 501);
  }
}

@Injectable()
export class LicensedMusicProvider implements AIMusicProvider {
  readonly id = 'licensed-music';
  isConfigured(): boolean {
    return false;
  }
  async authenticate(): Promise<ProviderAuthResult> {
    throw new ProviderError(PROVIDER_NOT_CONFIGURED, 'No licensed music catalog is configured.', 503);
  }
  async recommend(): Promise<never> {
    throw new ProviderError(MUSIC_NOT_CONFIGURED, 'No licensed music provider or catalog is configured. Upload a track with confirmed rights.', 501);
  }
}
