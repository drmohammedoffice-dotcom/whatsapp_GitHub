import { existsSync } from 'node:fs';
import path from 'node:path';
import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuditModule } from '../../api/src/audit/audit.module';
import { envSchema } from '../../api/src/config/env';
import { CreativeStudioCoreModule } from '../../api/src/creative-studio/creative-studio.core.module';
import { PrismaModule } from '../../api/src/prisma/prisma.module';
import { QueuesModule } from '../../api/src/queues/queues.module';
import { StorageModule } from '../../api/src/storage/storage.module';
import { WebhooksWorkerModule } from '../../api/src/webhooks/worker/webhooks-worker.module';
import { CreativeStudioProcessor } from './creative-studio.processor';

function resolveEnvFilePath(): string {
  const candidates = [
    path.resolve(process.cwd(), '.env'),
    path.resolve(process.cwd(), '../../.env'),
    path.resolve(__dirname, '../../../.env'),
    path.resolve(__dirname, '../../../../../.env'),
  ];
  return candidates.find((file) => existsSync(file)) ?? candidates[0]!;
}

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: resolveEnvFilePath(), validate: (env) => envSchema.parse(env) }),
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({ connection: { url: config.getOrThrow<string>('REDIS_URL') } }),
    }),
    PrismaModule,
    AuditModule,
    QueuesModule,
    StorageModule,
    CreativeStudioCoreModule,
    WebhooksWorkerModule,
  ],
  providers: [CreativeStudioProcessor],
})
export class WorkerModule {}
