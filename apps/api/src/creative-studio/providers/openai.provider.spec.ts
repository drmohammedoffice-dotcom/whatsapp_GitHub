import { ConfigService } from '@nestjs/config';
import { OpenAIProvider } from './openai.provider';
import { PROVIDER_NOT_CONFIGURED } from './provider-error';

describe('OpenAIProvider', () => {
  const fetchMock = jest.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock;
  });

  function provider(key?: string, extra: Record<string, string | undefined> = {}) {
    const config = {
      get: jest.fn((name: string) => {
        if (name === 'OPENAI_API_KEY') return key;
        if (name === 'OPENAI_API_BASE_URL') return extra.OPENAI_API_BASE_URL ?? 'https://api.openai.com/v1';
        if (name === 'AI_API_KEY') return extra.AI_API_KEY;
        if (name === 'AI_API_BASE_URL') return extra.AI_API_BASE_URL;
        return undefined;
      }),
    };
    return new OpenAIProvider(config as unknown as ConfigService);
  }

  it('uses shared AI_API_KEY when OPENAI_API_KEY is empty and the base is OpenAI', () => {
    const openai = provider('', { AI_API_KEY: 'sk-shared', AI_API_BASE_URL: 'https://api.openai.com/v1' });
    expect(openai.isConfigured()).toBe(true);
  });

  it('does not use the gateway placeholder key', () => {
    const openai = provider('', { AI_API_KEY: 'not-configured', AI_API_BASE_URL: 'https://api.openai.com/v1' });
    expect(openai.isConfigured()).toBe(false);
  });

  it('reports unconfigured without calling the network', async () => {
    const openai = provider('');
    expect(openai.isConfigured()).toBe(false);
    await expect(openai.authenticate()).rejects.toMatchObject({ code: PROVIDER_NOT_CONFIGURED });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('authenticates against GET /models without leaking the key into logs', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ data: [{ id: 'gpt-4o' }, { id: 'gpt-image-2' }] }),
    });
    const openai = provider('sk-test');
    await expect(openai.authenticate()).resolves.toEqual({
      ok: true,
      provider: 'openai',
      modelsSample: ['gpt-4o', 'gpt-image-2'],
    });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.openai.com/v1/models',
      expect.objectContaining({ headers: expect.any(Headers) }),
    );
    const headers = fetchMock.mock.calls[0][1].headers as Headers;
    expect(headers.get('Authorization')).toBe('Bearer sk-test');
  });
});
