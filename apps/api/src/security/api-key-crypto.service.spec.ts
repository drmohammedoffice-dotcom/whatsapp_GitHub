import { ConfigService } from '@nestjs/config';
import { ApiKeyCryptoService } from './api-key-crypto.service';

describe('ApiKeyCryptoService', () => {
  it('creates verifiable API keys without keeping plaintext in the hash', () => {
    const service = new ApiKeyCryptoService({ getOrThrow: () => 'a-secure-test-pepper-with-32-characters' } as unknown as ConfigService);
    const key = service.create();
    expect(key.plaintext).toMatch(/^wsp_live_/);
    expect(key.hash).not.toContain(key.plaintext);
    expect(service.verify(key.plaintext, key.hash)).toBe(true);
    expect(service.verify(`${key.plaintext}x`, key.hash)).toBe(false);
  });
});
