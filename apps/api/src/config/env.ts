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
  /** Optional numbered platform keys for AI Gateway HA (any count via process.env AI_API_KEY_N). */
  AI_API_KEY_1: z.string().optional(),
  AI_API_KEY_2: z.string().optional(),
  AI_API_KEY_3: z.string().optional(),
  AI_API_KEY_4: z.string().optional(),
  AI_API_KEY_5: z.string().optional(),
  AI_API_KEY_6: z.string().optional(),
  AI_API_KEY_7: z.string().optional(),
  AI_API_KEY_8: z.string().optional(),
  AI_API_KEY_9: z.string().optional(),
  AI_API_KEY_10: z.string().optional(),
  /** JSON array or comma-separated OpenRouter keys (used when AI_API_KEY_N are unset). */
  OPENROUTER_KEYS: z.string().optional(),
  /** Base URL used by the AI Gateway for platform keys (e.g. https://openrouter.ai/api/v1). */
  AI_GATEWAY_BASE_URL: z.string().url().optional(),
  /** Model the gateway always uses with platform keys (e.g. gemini-3-flash). */
  AI_GATEWAY_CHAT_MODEL: z.string().optional(),
  /** Load-balancing: least_used | round_robin | weighted_round_robin */
  AI_GATEWAY_STRATEGY: z.string().optional(),
  AI_GATEWAY_COOLDOWN_MS: z.coerce.number().int().positive().optional(),
  AI_GATEWAY_COOLDOWN_MAX_MS: z.coerce.number().int().positive().optional(),
  AI_GATEWAY_CIRCUIT_FAILURES: z.coerce.number().int().positive().optional(),
  AI_GATEWAY_MAX_RETRIES: z.coerce.number().int().positive().optional(),
  AI_GATEWAY_HEALTH_INTERVAL_MS: z.coerce.number().int().positive().optional(),
  AI_GATEWAY_TIMEOUT_MS: z.coerce.number().int().positive().optional(),
  AI_GATEWAY_RPM: z.coerce.number().int().positive().optional(),
  AI_GATEWAY_RPH: z.coerce.number().int().positive().optional(),
  AI_GATEWAY_RPD: z.coerce.number().int().positive().optional(),
  AI_GATEWAY_QUEUE_WAIT_MS: z.coerce.number().int().positive().optional(),
  AI_GATEWAY_QUEUE_POLL_MS: z.coerce.number().int().positive().optional(),
  AI_GATEWAY_SLOW_MS: z.coerce.number().int().positive().optional(),
  AI_CHAT_MODEL: z.string().default('gpt-4o-mini'),
  AI_EMBEDDING_MODEL: z.string().default('text-embedding-3-small'),
  AI_EMBEDDING_DIMENSIONS: z.coerce.number().int().positive().default(1536),
  AI_AUDIO_MODEL: z.string().default('whisper-1'),
  AI_TRANSCRIPTION_API_KEY: z.string().optional(),
  AI_TRANSCRIPTION_BASE_URL: z.string().url().optional(),
  AI_TRANSCRIPTION_MODEL: z.string().default('whisper-large-v3-turbo'),
  AI_TRANSCRIPTION_CHAT_MODEL: z.string().default('google/gemini-2.5-flash'),
  AI_VISION_MODEL: z.string().optional(),
  AI_TTS_MODEL: z.string().default('tts-1'),
  AI_MONTHLY_BUDGET_CENTS: z.coerce.number().int().nonnegative().default(10000),
  AI_RATE_LIMIT_PER_MINUTE: z.coerce.number().int().positive().default(60),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_REDIRECT_URI: z.string().url().optional(),
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
  /** Set true only after Meta App Review approves comment moderation scopes. */
  META_OAUTH_INCLUDE_COMMENT_SCOPES: z.enum(['true', 'false']).optional(),
  /** Comma-separated extra OAuth scopes (advanced / custom approvals). */
  META_OAUTH_EXTRA_SCOPES: z.string().optional(),
  /** Production Facebook Login callback — defaults to /api/auth/meta/callback */
  META_AUTH_REDIRECT_URI: z.string().url().optional(),
  /** WhatsApp Cloud API (Meta App Review / TSP demo) — phone_number_id from API Setup */
  META_WA_PHONE_NUMBER_ID: z.string().optional(),
  META_WA_WABA_ID: z.string().optional(),
  META_WA_ACCESS_TOKEN: z.string().optional(),
  META_WA_DISPLAY_PHONE: z.string().optional(),
  /** WhatsApp Embedded Signup configuration_id from Meta Developer Console */
  META_WA_EMBEDDED_CONFIG_ID: z.string().optional(),
  /** Official Chatloora WhatsApp sender (Admin OTP / subscription notices). Never used for customer inbox. */
  CHATLOORA_WHATSAPP_WABA_ID: z.string().optional(),
  CHATLOORA_WHATSAPP_PHONE_NUMBER_ID: z.string().optional(),
  CHATLOORA_WHATSAPP_ACCESS_TOKEN: z.string().optional(),
  CHATLOORA_WHATSAPP_OTP_TEMPLATE: z.string().optional(),
  CHATLOORA_WHATSAPP_SUBSCRIPTION_EXPIRY_TEMPLATE: z.string().optional(),
  CHATLOORA_WHATSAPP_SUBSCRIPTION_EXPIRED_TEMPLATE: z.string().optional(),
  /** Instagram API with Instagram Login (chatloora-IG app) */
  INSTAGRAM_API_APP_ID: z.string().optional(),
  INSTAGRAM_API_APP_SECRET: z.string().optional(),
  TELEGRAM_API_ID: z.coerce.number().optional(),
  TELEGRAM_API_HASH: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  RESEND_FROM_EMAIL: z.string().default('ChatLoora <onboarding@resend.dev>'),
  /** Signing secret from Resend webhook endpoint (email.received) */
  RESEND_WEBHOOK_SECRET: z.string().optional(),
  /** Webmail (@chatloora.com) via Resend send + inbound webhook */
  MAIL_DOMAIN: z.string().default('chatloora.com'),
  MAIL_WEBMAIL_JWT_TTL: z.string().default('12h'),
  /** Optional legacy Private Email IMAP/SMTP (unused when Resend webmail is active) */
  MAIL_IMAP_HOST: z.string().optional(),
  MAIL_IMAP_PORT: z.coerce.number().int().positive().optional(),
  MAIL_SMTP_HOST: z.string().optional(),
  MAIL_SMTP_PORT: z.coerce.number().int().positive().optional(),
  /** Set to false to skip OTP until Resend domain is verified */
  AUTH_OTP_ENABLED: z
    .string()
    .optional()
    .transform((v) => v !== 'false' && v !== '0'),
  ENABLE_SWAGGER: z.enum(['true', 'false']).optional(),
  /** Wayl payment gateway integration */
  WAYL_API_KEY: z.string().min(1).default('not-configured'),
  WAYL_API_BASE_URL: z.string().url().default('https://api.thewayl.com'),
  WAYL_WEBHOOK_SECRET: z.string().min(10).default('wayl-webhook-secret'),
  WAYL_ENV: z.enum(['live', 'test']).default('test'),
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_PHONE_NUMBER: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_API_BASE_URL: z.string().url().optional(),
  OPENROUTER_API_KEY: z.string().optional(),
  OPENROUTER_API_BASE_URL: z.string().url().optional(),
  CREATIVE_OPENAI_TEXT_MODEL: z.string().optional(),
  CREATIVE_OPENAI_IMAGE_MODEL: z.string().optional(),
  CREATIVE_GEMINI_IMAGE_MODEL: z.string().optional(),
  CREATIVE_GEMINI_VIDEO_MODEL: z.string().optional(),
  GEMINI_API_BASE_URL: z.string().url().optional(),
  VOICE_AI_ENABLED: z.string().optional(),
  VOICE_AI_PROVIDER: z.string().optional(),
  VOICE_AI_MODEL: z.string().optional(),
  VOICE_HANDOFF_NUMBER: z.string().optional(),
  VOICE_TWILIO_SKIP_SIGNATURE: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;


/**
 * Docker Compose / Coolify pass unset `${VAR}` references as empty strings. Treat those
 * as missing so schema defaults apply instead of failing validation (e.g. min length).
 */
export function parseEnv(env: Record<string, unknown>) {
  const cleaned = Object.fromEntries(Object.entries(env).filter(([, value]) => value !== ''));
  return envSchema.parse(cleaned);
}
