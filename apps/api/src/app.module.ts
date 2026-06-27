import { existsSync } from 'node:fs';
import path from 'node:path';
import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { ApiKeysModule } from './api-keys/api-keys.module';
import { AgentsModule } from './agents/agents.module';
import { AiModule } from './ai/ai.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { ChannelsModule } from './channels/channels.module';
import { envSchema } from './config/env';
import { ContactsModule } from './contacts/contacts.module';
import { ConversationsModule } from './conversations/conversations.module';
import { DepartmentsModule } from './departments/departments.module';
import { HealthModule } from './health/health.module';
import { MessagingModule } from './messaging/messaging.module';
import { NotificationsModule } from './notifications/notifications.module';
import { PrismaModule } from './prisma/prisma.module';
import { RealtimeModule } from './realtime/realtime.module';
import { SecurityModule } from './security/security.module';
import { SettingsModule } from './settings/settings.module';
import { StorageModule } from './storage/storage.module';
import { WebhooksModule } from './webhooks/webhooks.module';
import { ProductsModule } from './products/products.module';
import { BookingsModule } from './bookings/bookings.module';
import { WhatsAppModule } from './whatsapp/whatsapp.module';
import { TikTokModule } from './tiktok/tiktok.module';
import { IntegrationsModule } from './integrations/integrations.module';

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
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: resolveEnvFilePath(),
      validate: (env) => envSchema.parse(env),
    }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({ connection: { url: config.getOrThrow<string>('REDIS_URL') } }),
    }),
    PrismaModule,
    RealtimeModule,
    AuditModule,
    SecurityModule,
    StorageModule,
    HealthModule,
    AuthModule,
    ApiKeysModule,
    ChannelsModule,
    ContactsModule,
    NotificationsModule,
    WhatsAppModule,
    ConversationsModule,
    MessagingModule,
    AgentsModule,
    AiModule,
    ProductsModule,
    BookingsModule,
    DepartmentsModule,
    AnalyticsModule,
    SettingsModule,
    WebhooksModule,
    TikTokModule,
    IntegrationsModule,
  ],
})
export class AppModule {}
