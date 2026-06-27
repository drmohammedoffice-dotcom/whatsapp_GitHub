import { ConfigService } from '@nestjs/config';
import { EncryptionService } from './encryption.service';

describe('EncryptionService', () => {
  it('round trips encrypted JSON without storing plaintext', () => {
    const service = new EncryptionService({ getOrThrow: () => 'a-secure-test-key-with-32-characters' } as unknown as ConfigService);
    const encrypted = service.encryptJson({ token: 'secret' });
    expect(encrypted).not.toContain('secret');
    expect(service.decryptJson(encrypted)).toEqual({ token: 'secret' });
  });
});
