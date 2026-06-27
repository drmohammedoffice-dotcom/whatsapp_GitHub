import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiProviderType } from '@watsapp/database';
import { AxiosInstance } from 'axios';
import { AiProviderConfigService, ProviderRuntimeConfig } from './ai-provider-config.service';

export interface AiMessage { role: 'system' | 'user' | 'assistant' | 'tool'; content: string; name?: string }
export interface AiCompletion { content: string; promptTokens: number; completionTokens: number; raw: unknown; provider: string; model: string }

@Injectable()
export class AiProviderService {
  constructor(
    private readonly config: ConfigService,
    private readonly providerConfig: AiProviderConfigService,
  ) {}

  async chat(
    teamId: string,
    messages: AiMessage[],
    options: { model?: string; temperature?: number; maxTokens?: number; topP?: number; json?: boolean; stream?: boolean } = {},
  ): Promise<AiCompletion> {
    const runtime = await this.resolve(teamId);
    const client = this.clientFor(runtime);
    const response = await client.post('/chat/completions', {
      model: options.model ?? runtime.model,
      messages,
      temperature: options.temperature ?? runtime.temperature,
      max_tokens: options.maxTokens ?? runtime.maxTokens,
      top_p: options.topP ?? runtime.topP,
      stream: options.stream ?? runtime.enableStreaming,
      ...(options.json ? { response_format: { type: 'json_object' } } : {}),
    });
    return {
      content: response.data.choices?.[0]?.message?.content ?? '',
      promptTokens: response.data.usage?.prompt_tokens ?? 0,
      completionTokens: response.data.usage?.completion_tokens ?? 0,
      raw: response.data,
      provider: runtime.provider,
      model: options.model ?? runtime.model,
    };
  }

  async embed(teamId: string, input: string[]): Promise<number[][]> {
    const runtime = await this.resolve(teamId);
    const client = this.clientFor(runtime);
    const response = await client.post('/embeddings', {
      model: this.config.getOrThrow<string>('AI_EMBEDDING_MODEL'),
      input,
      dimensions: this.config.get<number>('AI_EMBEDDING_DIMENSIONS', 1536),
    });
    return response.data.data.map((item: { embedding: number[] }) => item.embedding);
  }

  async speech(teamId: string, text: string): Promise<Buffer> {
    const runtime = await this.resolve(teamId);
    const client = this.clientFor(runtime);
    const response = await client.post('/audio/speech', { model: this.config.get<string>('AI_TTS_MODEL', 'tts-1'), voice: 'alloy', input: text }, { responseType: 'arraybuffer' });
    return Buffer.from(response.data);
  }

  async transcribe(teamId: string, file: { buffer: Buffer; originalname: string; mimetype: string }): Promise<string> {
    const runtime = await this.resolve(teamId);
    const client = this.clientFor(runtime);
    const form = new FormData();
    form.append('model', this.config.get<string>('AI_AUDIO_MODEL', 'whisper-1'));
    form.append('file', new Blob([new Uint8Array(file.buffer)], { type: file.mimetype }), file.originalname);
    const response = await client.post('/audio/transcriptions', form);
    return response.data.text ?? '';
  }

  private async resolve(teamId: string): Promise<ProviderRuntimeConfig> {
    const runtime = await this.providerConfig.resolveRuntime(teamId);
    if (!runtime) {
      this.ensureEnvConfigured();
      return {
        provider: AiProviderType.OPENAI_COMPATIBLE,
        baseUrl: this.config.getOrThrow<string>('AI_API_BASE_URL').replace(/\/$/, ''),
        apiKey: this.config.getOrThrow<string>('AI_API_KEY'),
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
    return runtime;
  }

  private clientFor(runtime: ProviderRuntimeConfig): AxiosInstance {
    if (!runtime.apiKey) throw new ServiceUnavailableException('AI provider API key is not configured');
    return this.providerConfig.createClient(runtime.baseUrl, runtime.apiKey, runtime.provider);
  }

  private ensureEnvConfigured() {
    if (this.config.get<string>('AI_API_KEY') === 'not-configured') {
      throw new ServiceUnavailableException('AI provider is not configured. Add an AI Provider in settings.');
    }
  }
}
