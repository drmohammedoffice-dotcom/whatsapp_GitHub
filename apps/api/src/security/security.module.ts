import { Global, Module } from '@nestjs/common';
import { ApiKeyCryptoService } from './api-key-crypto.service';
import { EncryptionService } from './encryption.service';
import { PasswordService } from './password.service';
import { TokenHashService } from './token-hash.service';

@Global()
@Module({
  providers: [EncryptionService, PasswordService, TokenHashService, ApiKeyCryptoService],
  exports: [EncryptionService, PasswordService, TokenHashService, ApiKeyCryptoService],
})
export class SecurityModule {}
