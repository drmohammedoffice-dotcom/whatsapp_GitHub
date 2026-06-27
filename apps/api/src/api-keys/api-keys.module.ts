import { Module } from '@nestjs/common';
import { SecurityModule } from '../security/security.module';
import { ApiKeyGuard } from './api-key.guard';
import { ApiKeysController } from './api-keys.controller';
import { ApiKeysService } from './api-keys.service';

@Module({
  imports: [SecurityModule],
  controllers: [ApiKeysController],
  providers: [ApiKeysService, ApiKeyGuard],
  exports: [ApiKeyGuard, ApiKeysService],
})
export class ApiKeysModule {}
