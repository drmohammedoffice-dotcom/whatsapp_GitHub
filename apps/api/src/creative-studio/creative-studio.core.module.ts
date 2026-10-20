import { Module } from '@nestjs/common';
import { QueuesModule } from '../queues/queues.module';
import { StorageModule } from '../storage/storage.module';
import { CreativeEntitlementsModule } from './creative-entitlements.module';
import { CreativeStudioService } from './creative-studio.service';
import { FfmpegComposeService } from './ffmpeg.service';
import { CreativeGenerationService } from './generation.service';
import { ProductIntelligenceService } from './product-intelligence.service';
import {
  FalProvider,
  IraqiTTSProvider,
  LicensedMusicProvider,
  LipSyncProvider,
  RunwayProvider,
  UpscaleProvider,
} from './providers/future.providers';
import { GeminiProvider } from './providers/gemini.provider';
import { OpenAIProvider } from './providers/openai.provider';
import { OpenRouterProvider } from './providers/openrouter.provider';
import { ProviderRegistry } from './providers/provider-registry';

@Module({
  imports: [QueuesModule, StorageModule, CreativeEntitlementsModule],
  providers: [
    OpenAIProvider,
    OpenRouterProvider,
    GeminiProvider,
    FalProvider,
    RunwayProvider,
    IraqiTTSProvider,
    LipSyncProvider,
    UpscaleProvider,
    LicensedMusicProvider,
    ProviderRegistry,
    ProductIntelligenceService,
    FfmpegComposeService,
    CreativeGenerationService,
    CreativeStudioService,
  ],
  exports: [
    CreativeStudioService,
    CreativeGenerationService,
    ProviderRegistry,
    OpenAIProvider,
    OpenRouterProvider,
    GeminiProvider,
    FfmpegComposeService,
  ],
})
export class CreativeStudioCoreModule {}
