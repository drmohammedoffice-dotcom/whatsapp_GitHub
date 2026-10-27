import { ConfigService } from '@nestjs/config';
import { OpenRouterProvider } from './openrouter.provider';
import { PROVIDER_NOT_CONFIGURED } from './provider-error';

describe('OpenRouterProvider', () => {
  const fetchMock = jest.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock;
  });

  function provider(key?: string) {
    const config = {
      get: jest.fn((name: string) => {
        if (name === 'OPENROUTER_API_KEY') return key;
        if (name === 'OPENROUTER_API_BASE_URL') return 'https://openrouter.ai/api/v1';
        if (name === 'API_PUBLIC_URL') return 'https://almutamayiziq.com';
        return undefined;
      }),
    };
    return new OpenRouterProvider(config as unknown as ConfigService);
  }

  it('fails closed when the key is missing', async () => {
    const openrouter = provider('');
    expect(openrouter.isConfigured()).toBe(false);
    await expect(openrouter.authenticate()).rejects.toMatchObject({ code: PROVIDER_NOT_CONFIGURED });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('authenticates against GET /models', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ data: [{ id: 'openai/gpt-4o' }] }),
    });
    const openrouter = provider('sk-or-test');
    await expect(openrouter.authenticate()).resolves.toMatchObject({ ok: true, provider: 'openrouter' });
    expect(fetchMock.mock.calls[0][0]).toBe('https://openrouter.ai/api/v1/models');
  });

  it('does not invent a video cancel endpoint', async () => {
    const openrouter = provider('sk-or-test');
    await expect(openrouter.cancelGenerationJob()).rejects.toMatchObject({ code: 'CAPABILITY_NOT_SUPPORTED' });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
