import { ConfigService } from '@nestjs/config';
import { ProviderRegistry } from './provider-registry';
import { OpenAIProvider } from './openai.provider';
import { OpenRouterProvider } from './openrouter.provider';

describe('ProviderRegistry', () => {
  it('keeps OpenAI model IDs in one place and ignores disabled future providers for fallback', () => {
    const config = {
      get: jest.fn((key: string) => {
        if (key === 'CREATIVE_OPENAI_TEXT_MODEL') return 'gpt-4o';
        if (key === 'CREATIVE_OPENAI_IMAGE_MODEL') return 'gpt-image-2';
        return undefined;
      }),
    };
    const openai = { isConfigured: () => true } as OpenAIProvider;
    const openrouter = { isConfigured: () => false } as OpenRouterProvider;
    const gemini = {
      isConfigured: () => false,
      imageModel: () => 'gemini-3.1-flash-image',
      videoModel: () => 'veo-3.1-generate-preview',
    } as never;
    const registry = new ProviderRegistry(config as unknown as ConfigService, openai, openrouter, gemini);
    expect(registry.openaiImageModel()).toBe('gpt-image-2');
    const fallback = registry.pickFallback('imageGeneration', { resolution: '1024x1024' });
    expect(fallback?.provider).toBe('openai');
    expect(registry.pickFallback('lipSync')).toBeNull();
  });
});
