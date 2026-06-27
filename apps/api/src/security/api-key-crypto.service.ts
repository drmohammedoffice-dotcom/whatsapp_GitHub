import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { API_KEY_PREFIX } from '@watsapp/shared';
import { createHmac, randomBytes, timingSafeEqual } from 'crypto';

@Injectable()
export class ApiKeyCryptoService {
  private readonly pepper: string;

  constructor(config: ConfigService) {
    this.pepper = config.getOrThrow<string>('API_KEY_PEPPER');
  }

  create() {
    const secret = randomBytes(32).toString('base64url');
    const plaintext = `${API_KEY_PREFIX}_${secret}`;
    return { plaintext, prefix: plaintext.slice(0, 16), hash: this.hash(plaintext) };
  }

  hash(value: string) {
    return createHmac('sha256', this.pepper).update(value).digest('hex');
  }

  verify(value: string, hash: string) {
    const a = Buffer.from(this.hash(value));
    const b = Buffer.from(hash);
    return a.length === b.length && timingSafeEqual(a, b);
  }
}
