import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiProviderType } from '@watsapp/database';
import { AxiosInstance } from 'axios';
import { AiProviderConfigService, ProviderRuntimeConfig } from './ai-provider-config.service';
import { AiGatewayService } from './gateway/ai-gateway.service';

export type AiContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } };
export interface AiMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | AiContentPart[];
  name?: string;
}
export interface AiCompletion { content: string; promptTokens: number; completionTokens: number; raw: unknown; provider: string; model: string }

type TranscriptionTarget = { baseUrl: string; apiKey: string; model: string; provider: AiProviderType };

export type AiChatOptions = {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  json?: boolean;
  stream?: boolean;
  /** Auto-reply: keep failing over / retrying until a key succeeds */
  persistUntilSuccess?: boolean;
  correlationId?: string;
};

@Injectable()
export class AiProviderService {
  private readonly logger = new Logger(AiProviderService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly providerConfig: AiProviderConfigService,
    private readonly gateway: AiGatewayService,
  ) {}

  async chat(
    teamId: string,
    messages: AiMessage[],
    options: AiChatOptions = {},
  ): Promise<AiCompletion> {
    const runtime = await this.resolve(teamId);
    const model = options.model ?? runtime.model;
    const hasTeamKey = Boolean(runtime.apiKey && runtime.apiKey !== 'gateway');

    // Auto-reply: prefer the team's own key first for latency. Platform free-tier keys
    // often burn 5–30s failing over on 402 before the team key would have answered in ~1s.
    if (options.persistUntilSuccess && hasTeamKey) {
      try {
        return await this.chatViaTeamKey(runtime, model, messages, options);
      } catch (error) {
        this.logger.warn(
          `Team provider key failed (${error instanceof Error ? error.message : String(error)}) — trying platform gateway teamId=${teamId}`,
        );
      }
    }

    // Platform HA path — chat completions go through the AI Gateway when keys exist.
    if (this.gateway.isEnabled()) {
      try {
        const result = await this.gateway.chat({
          model,
          messages,
          temperature: options.temperature ?? runtime.temperature,
          maxTokens: options.maxTokens ?? runtime.maxTokens,
          topP: options.topP ?? runtime.topP,
          json: options.json,
          persistUntilSuccess: options.persistUntilSuccess,
          correlationId: options.correlationId ?? teamId,
        });
        return {
          content: result.content,
          promptTokens: result.promptTokens,
          completionTokens: result.completionTokens,
          raw: result.raw,
          provider: `gateway:${result.keyLabel}`,
          model: result.model,
        };
      } catch (error) {
        // If the team has its own working provider key, fall back to it so
        // customers still get replies even when platform keys are down/invalid.
        if (hasTeamKey && !options.persistUntilSuccess) {
          this.logger.warn(
            `Gateway exhausted (${error instanceof Error ? error.message : String(error)}) — falling back to team provider key teamId=${teamId}`,
          );
        } else if (!hasTeamKey) {
          throw error;
        } else {
          // Already tried team key first for persistUntilSuccess — rethrow.
          throw error;
        }
      }
    }

    // Per-team key path (gateway disabled, or gateway failed and team key exists)
    return this.chatViaTeamKey(runtime, model, messages, options);
  }

  private async chatViaTeamKey(
    runtime: ProviderRuntimeConfig,
    model: string,
    messages: AiMessage[],
    options: AiChatOptions,
    maxTokensOverride?: number,
  ): Promise<AiCompletion> {
    const client = this.clientFor(runtime);
    const maxTokens = maxTokensOverride ?? options.maxTokens ?? runtime.maxTokens;
    const resolvedModel = runtime.baseUrl.includes('openrouter.ai') && model && !model.includes('/')
      ? `openai/${model}`
      : model;
    let response;
    try {
      response = await client.post('/chat/completions', {
        model: resolvedModel,
        messages,
        temperature: options.temperature ?? runtime.temperature,
        max_tokens: maxTokens,
        top_p: options.topP ?? runtime.topP,
        stream: false,
        ...(options.json ? { response_format: { type: 'json_object' } } : {}),
      });
    } catch (error) {
      // OpenRouter free tier: 402 "You requested up to X tokens, but can only afford Y".
      // Retry once with an affordable max_tokens so replies keep flowing.
      const affordable = this.parseAffordableTokens(error);
      if (!maxTokensOverride && affordable && affordable > 32) {
        this.logger.warn(`Provider low on credits — retrying with max_tokens=${affordable}`);
        return this.chatViaTeamKey(runtime, model, messages, options, affordable);
      }
      throw error;
    }

    const data = response.data ?? {};
    if (data.error) {
      const message = typeof data.error === 'string' ? data.error : data.error?.message ?? JSON.stringify(data.error);
      throw new ServiceUnavailableException(`AI provider error: ${message}`);
    }
    const choice = data.choices?.[0];
    const content = choice?.message?.content ?? '';
    if (!content && choice?.finish_reason) {
      throw new ServiceUnavailableException(`AI provider returned empty content (finish_reason=${choice.finish_reason}). Check the model name and account credits.`);
    }

    return {
      content,
      promptTokens: data.usage?.prompt_tokens ?? 0,
      completionTokens: data.usage?.completion_tokens ?? 0,
      raw: data,
      provider: runtime.provider,
      model: resolvedModel,
    };
  }

  /** Extract the affordable token count from an OpenRouter 402 credit error. */
  private parseAffordableTokens(error: unknown): number | null {
    const data = (error as { response?: { data?: unknown } })?.response?.data;
    const blob = typeof data === 'string' ? data : JSON.stringify(data ?? '');
    const match = /can only afford (\d+)/i.exec(blob);
    if (!match) return null;
    const affordable = Number(match[1]);
    // Leave headroom so the request stays under the balance.
    return Number.isFinite(affordable) ? Math.max(0, affordable - 16) : null;
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
    const whisperTarget = await this.resolveWhisperTarget(teamId);
    if (whisperTarget) {
      try {
        const text = await this.transcribeViaWhisper(whisperTarget, file);
        if (text.trim()) return text.trim();
      } catch (error) {
        this.logger.warn(`Whisper transcription failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    return this.transcribeViaChat(teamId, file);
  }

  private async transcribeViaWhisper(target: TranscriptionTarget, file: { buffer: Buffer; originalname: string; mimetype: string }): Promise<string> {
    const client = this.providerConfig.createClient(target.baseUrl, target.apiKey, target.provider);
    const form = new FormData();
    form.append('model', target.model);
    form.append('response_format', 'json');
    const fileName = this.normalizeAudioFileName(file.originalname, file.mimetype);
    form.append('file', new Blob([new Uint8Array(file.buffer)], { type: file.mimetype }), fileName);
    const response = await client.post('/audio/transcriptions', form);
    return response.data?.text ?? '';
  }

  private async transcribeViaChat(teamId: string, file: { buffer: Buffer; originalname: string; mimetype: string }): Promise<string> {
    const runtime = await this.resolve(teamId);
    const transcriptionModel = runtime.provider === AiProviderType.OPENROUTER
      ? this.config.get<string>('AI_TRANSCRIPTION_CHAT_MODEL', 'google/gemini-2.5-flash')
      : runtime.model;

    const base64 = file.buffer.toString('base64');
    const mime = file.mimetype.split(';')[0]?.trim() || 'audio/ogg';
    const dataUri = `data:${mime};base64,${base64}`;

    // Prefer gateway for multimodal transcription when platform keys exist
    if (this.gateway.isEnabled()) {
      const result = await this.gateway.chat({
        model: transcriptionModel,
        temperature: 0,
        maxTokens: 1024,
        persistUntilSuccess: true,
        correlationId: `transcribe:${teamId}`,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Transcribe this voice message exactly. Return ONLY the spoken words in the original language (Arabic, English, Iraqi dialect, Kurdish, etc.). No commentary or translation.',
              },
              { type: 'image_url', image_url: { url: dataUri } },
            ],
          },
        ],
      });
      if (!result.content.trim()) {
        throw new ServiceUnavailableException('Voice transcription returned empty text');
      }
      return result.content.trim();
    }

    const client = this.providerConfig.createClient(runtime.baseUrl, runtime.apiKey, runtime.provider);
    const response = await client.post('/chat/completions', {
      model: transcriptionModel,
      temperature: 0,
      max_tokens: 1024,
      stream: false,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Transcribe this voice message exactly. Return ONLY the spoken words in the original language (Arabic, English, Iraqi dialect, Kurdish, etc.). No commentary or translation.',
            },
            { type: 'image_url', image_url: { url: dataUri } },
          ],
        },
      ],
    });

    const content = response.data?.choices?.[0]?.message?.content ?? '';
    if (!content.trim()) {
      throw new ServiceUnavailableException('Voice transcription returned empty text');
    }
    return content.trim();
  }

  private async resolveWhisperTarget(teamId: string): Promise<TranscriptionTarget | null> {
    const envKey = this.config.get<string>('AI_TRANSCRIPTION_API_KEY')?.trim();
    const envBase = this.config.get<string>('AI_TRANSCRIPTION_BASE_URL')?.trim();
    if (envKey && envBase) {
      return {
        baseUrl: envBase.replace(/\/$/, ''),
        apiKey: envKey,
        model: this.config.get<string>('AI_TRANSCRIPTION_MODEL', 'whisper-large-v3-turbo'),
        provider: envBase.includes('groq.com') ? AiProviderType.GROQ : AiProviderType.OPENAI_COMPATIBLE,
      };
    }

    const runtime = await this.providerConfig.resolveRuntime(teamId);
    if (!runtime) return null;

    if (runtime.provider === AiProviderType.GROQ) {
      return { baseUrl: runtime.baseUrl, apiKey: runtime.apiKey, model: 'whisper-large-v3-turbo', provider: runtime.provider };
    }
    if (runtime.baseUrl.includes('api.openai.com')) {
      return { baseUrl: runtime.baseUrl, apiKey: runtime.apiKey, model: 'whisper-1', provider: runtime.provider };
    }
    return null;
  }

  private normalizeAudioFileName(originalname: string, mimetype: string): string {
    if (originalname && /\.[a-z0-9]+$/i.test(originalname)) return originalname;
    if (mimetype.includes('ogg')) return 'voice.ogg';
    if (mimetype.includes('mpeg') || mimetype.includes('mp3')) return 'voice.mp3';
    if (mimetype.includes('webm')) return 'voice.webm';
    if (mimetype.includes('mp4') || mimetype.includes('m4a')) return 'voice.m4a';
    return 'voice.ogg';
  }

  private async resolve(teamId: string): Promise<ProviderRuntimeConfig> {
    const runtime = await this.providerConfig.resolveRuntime(teamId);
    if (!runtime) {
      // When gateway is enabled, team DB key is optional — model/settings still needed
      if (this.gateway.isEnabled()) {
        return {
          provider: this.gateway.isOpenRouter() ? AiProviderType.OPENROUTER : AiProviderType.OPENAI_COMPATIBLE,
          baseUrl: this.gateway.getBaseUrl(),
          apiKey: 'gateway',
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
