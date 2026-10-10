export type AIModelCapabilities = {
  text?: boolean;
  vision?: boolean;
  imageGeneration?: boolean;
  imageEditing?: boolean;
  imageToVideo?: boolean;
  textToVideo?: boolean;
  referenceImage?: boolean;
  characterReference?: boolean;
  audioGeneration?: boolean;
  tts?: boolean;
  lipSync?: boolean;
  upscaling?: boolean;
  resolutions?: string[];
  aspectRatios?: string[];
  maxDurationSeconds?: number;
};

export type RegisteredModel = {
  provider: string;
  model: string;
  enabled: boolean;
  priority: number;
  capabilities: AIModelCapabilities;
  source: 'config' | 'discovery';
};

export type ProviderAuthResult = {
  ok: true;
  provider: string;
  modelsSample: string[];
};

export type GenerationJobHandle = {
  providerJobId: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  pollingUrl?: string;
};

export type GenerationStatus = {
  providerJobId: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled' | 'expired';
  error?: string;
  costUsd?: number;
};

export type GenerationResult = {
  buffer: Buffer;
  mimeType: string;
  width?: number;
  height?: number;
  durationSec?: number;
};

export type ImageGenerateInput = {
  model: string;
  prompt: string;
  aspectRatio?: string;
  resolution?: string;
  quality?: string;
  referenceImageUrls?: string[];
};

export type VideoGenerateInput = {
  model: string;
  prompt: string;
  durationSec?: number;
  aspectRatio?: string;
  resolution?: string;
  frameImageUrls?: string[];
  referenceImageUrls?: string[];
};

export type TextCompleteInput = {
  model: string;
  system: string;
  user: string;
  images?: Array<{ mimeType: string; dataBase64: string }>;
  json?: boolean;
};

export interface AIConfigured {
  readonly id: string;
  isConfigured(): boolean;
  authenticate(): Promise<ProviderAuthResult>;
}

export interface AITextProvider extends AIConfigured {
  completeText(input: TextCompleteInput): Promise<{ text: string; model: string; promptTokens?: number; completionTokens?: number }>;
}

export interface AIImageProvider extends AIConfigured {
  createImageJob(input: ImageGenerateInput): Promise<GenerationJobHandle>;
  getGenerationStatus(providerJobId: string): Promise<GenerationStatus>;
  getGenerationResult(providerJobId: string): Promise<GenerationResult>;
  cancelGenerationJob?(providerJobId: string): Promise<void>;
}

export interface AIVideoProvider extends AIConfigured {
  createVideoJob(input: VideoGenerateInput): Promise<GenerationJobHandle>;
  getGenerationStatus(providerJobId: string): Promise<GenerationStatus>;
  getGenerationResult(providerJobId: string): Promise<GenerationResult>;
  cancelGenerationJob?(providerJobId: string): Promise<void>;
}

export type TtsInput = {
  model?: string;
  text: string;
  voice?: string;
  language?: string;
  dialect?: string;
  speed?: number;
  gender?: string;
};

export interface AITTSProvider extends AIConfigured {
  synthesize(input: TtsInput): Promise<GenerationResult & { dialect?: string; voice?: string; sampleRate?: number }>;
}

export interface AIMusicProvider extends AIConfigured {
  recommend(input: { mood?: string; durationSec?: number; genre?: string }): Promise<Array<{ id: string; title: string; mood?: string }>>;
}

export interface AILipSyncProvider extends AIConfigured {
  createLipSyncJob(input: { model: string; videoRef: string; audioRef: string }): Promise<GenerationJobHandle>;
}

export interface AIUpscaleProvider extends AIConfigured {
  upscale(input: { model: string; sourceRef: string; target?: string }): Promise<GenerationJobHandle>;
}
