import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().min(1),
  API_PORT: z.coerce.number().default(4000),
  API_PUBLIC_URL: z.string().url(),
  WEB_PUBLIC_URL: z.string().url(),
  CORS_ORIGINS: z.string().min(1),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_TTL: z.string().default('2h'),
  JWT_REFRESH_TTL_DAYS: z.coerce.number().int().positive().default(30),
  ENCRYPTION_KEY: z.string().min(32),
  API_KEY_PEPPER: z.string().min(32),
  WEBHOOK_SIGNING_SECRET: z.string().min(32),
  LOCAL_STORAGE_ROOT: z.string().default('./storage'),
  AI_API_BASE_URL: z.string().url().default('https://api.openai.com/v1'),
  AI_API_KEY: z.string().min(1).default('not-configured'),
  AI_CHAT_MODEL: z.string().default('gpt-4o-mini'),
  AI_EMBEDDING_MODEL: z.string().default('text-embedding-3-small'),
  AI_EMBEDDING_DIMENSIONS: z.coerce.number().int().positive().default(1536),
  AI_AUDIO_MODEL: z.string().default('whisper-1'),
  AI_TRANSCRIPTION_API_KEY: z.string().optional(),
  AI_TRANSCRIPTION_BASE_URL: z.string().url().optional(),
  AI_TRANSCRIPTION_MODEL: z.string().default('whisper-large-v3-turbo'),
  AI_TRANSCRIPTION_CHAT_MODEL: z.string().default('google/gemini-2.5-flash'),
  AI_TTS_MODEL: z.string().default('tts-1'),
  AI_MONTHLY_BUDGET_CENTS: z.coerce.number().int().nonnegative().default(10000),
  AI_RATE_LIMIT_PER_MINUTE: z.coerce.number().int().positive().default(60),
  TIKTOK_CLIENT_KEY: z.string().optional(),
  TIKTOK_CLIENT_SECRET: z.string().optional(),
  TIKTOK_REDIRECT_URI: z.string().url().optional(),
  /** Numeric Marketing API app_id from TikTok Developer Portal (separate from Login Kit client_key). */
  TIKTOK_BUSINESS_APP_ID: z.string().optional(),
  TIKTOK_BUSINESS_APP_SECRET: z.string().optional(),
  TIKTOK_BUSINESS_REDIRECT_URI: z.string().url().optional(),
  /** Chatloora SaaS ads — CompleteRegistration / Purchase for the platform product. */
  TIKTOK_PLATFORM_PIXEL_CODE: z.string().optional(),
  TIKTOK_PLATFORM_EVENTS_ACCESS_TOKEN: z.string().optional(),
  META_VERIFY_TOKEN: z.string().optional(),
  META_APP_ID: z.string().optional(),
  META_APP_SECRET: z.string().optional(),
  META_OAUTH_REDIRECT_URI: z.string().url().optional(),
  /** Production Facebook Login callback — defaults to /api/auth/meta/callback */
  META_AUTH_REDIRECT_URI: z.string().url().optional(),
  TELEGRAM_API_ID: z.coerce.number().optional(),
  TELEGRAM_API_HASH: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  RESEND_FROM_EMAIL: z.string().default('ChatLoora <onboarding@resend.dev>'),
  /** Set to false to skip OTP until Resend domain is verified */
  AUTH_OTP_ENABLED: z
    .string()
    .optional()
    .transform((v) => v !== 'false' && v !== '0'),
});
