import { existsSync } from 'node:fs';
import path from 'node:path';
import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { MulterModule } from '@nestjs/platform-express';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { AccountModule } from './account/account.module';
import { ChannelsModule } from './channels/channels.module';
import { envSchema } from './config/env';
import { ContactsModule } from './contacts/contacts.module';
import { ConversationsModule } from './conversations/conversations.module';
import { HealthModule } from './health/health.module';
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
import { TikTokIntegrationModule } from './tiktok-integration/tiktok-integration.module';
import { IntegrationsModule } from './integrations/integrations.module';
import { MetaPublicModule } from './integrations/meta/meta-public.module';
import { PlatformModule } from './platform/platform.module';
import { AdminModule } from './admin/admin.module';
import { BillingModule } from './billing/billing.module';
import { LandingModule } from './landing/landing.module';
import { InstantFormsModule } from './instant-forms/instant-forms.module';
import { OfficialWhatsAppModule } from './official-whatsapp/official-whatsapp.module';
import { WebmailModule } from './webmail/webmail.module';

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
      validate: (env) => {
        const parsed = envSchema.parse(env);

        const extras: Record<string, string> = {};
        for (const [key, value] of Object.entries(env)) {
          if (
            (/^AI_API_KEY_\d+$/.test(key) ||
              /^AI_API_KEY_WEIGHT_\d+$/.test(key) ||
              key === 'OPENROUTER_KEYS') &&
            typeof value === 'string' &&
            value.trim()
          ) {
            extras[key] = value.trim();
          }
        }
        return { ...parsed, ...extras };
      },
    }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot({
      throttlers: [{ ttl: 60_000, limit: 240 }],
      skipIf: (ctx) => {
        if (ctx.getType() !== 'http') return true;
        const req = ctx.switchToHttp().getRequest<{ originalUrl?: string; url?: string }>();
        const url = `${req.originalUrl ?? req.url ?? ''}`;
        return /\/(webhooks|wayl-return|health|sdk-config|webhooks\/resend)\b/i.test(url);
      },
    }),
    MulterModule.register({
      limits: { fileSize: 25 * 1024 * 1024, files: 1 },
    }),
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
    AccountModule,
    ChannelsModule,
    ContactsModule,
    NotificationsModule,
    WhatsAppModule,
    ConversationsModule,
    ProductsModule,
    BookingsModule,
    SettingsModule,
    WebhooksModule,
    TikTokModule,
    TikTokIntegrationModule,
    IntegrationsModule,
    MetaPublicModule,
    PlatformModule,
    AdminModule,
    BillingModule,
    LandingModule,
    InstantFormsModule,
    OfficialWhatsAppModule,
    WebmailModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
