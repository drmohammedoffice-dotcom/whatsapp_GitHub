import { Injectable } from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';

@Injectable()
export class TokenHashService {
  createOpaqueToken(byteLength = 32) {
    return randomBytes(byteLength).toString('base64url');
  }

  hash(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }
}
