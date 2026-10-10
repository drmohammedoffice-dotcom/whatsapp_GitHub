-- Official Chatloora WhatsApp sender (admin-only) vs customer WhatsAppCloudAccount.
-- Backward-compatible: existing customer connections and email OTP are unchanged.

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "phone" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "phoneVerifiedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX IF NOT EXISTS "User_phone_key" ON "User"("phone");

CREATE TYPE "OfficialWhatsAppSenderStatus" AS ENUM ('DISCONNECTED', 'CONNECTED', 'DISABLED', 'FAILED');
CREATE TYPE "OfficialNotificationType" AS ENUM (
  'ACCOUNT_VERIFICATION_OTP',
  'LOGIN_OTP',
  'PASSWORD_RESET_OTP',
  'SUBSCRIPTION_EXPIRING',
  'SUBSCRIPTION_EXPIRING_SOON',
  'SUBSCRIPTION_EXPIRED',
  'PAYMENT_SUCCESSFUL',
  'SUBSCRIPTION_ACTIVATED',
  'SUBSCRIPTION_RENEWAL',
  'SYSTEM_NOTIFICATION'
);
CREATE TYPE "OfficialNotificationStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'SKIPPED');

CREATE TABLE "official_whatsapp_senders" (
  "id" TEXT NOT NULL DEFAULT 'chatloora-official',
  "waba_id" TEXT NOT NULL DEFAULT '',
  "phone_number_id" TEXT NOT NULL DEFAULT '',
  "display_phone_number" TEXT NOT NULL DEFAULT '',
  "display_name" TEXT NOT NULL DEFAULT '',
  "encrypted_access_token" TEXT NOT NULL DEFAULT '',
  "status" "OfficialWhatsAppSenderStatus" NOT NULL DEFAULT 'DISCONNECTED',
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "webhook_status" TEXT NOT NULL DEFAULT 'unknown',
  "last_tested_at" TIMESTAMP(3),
  "last_error" TEXT,
  "metadata" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "official_whatsapp_senders_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "official_whatsapp_templates" (
  "id" TEXT NOT NULL,
  "type" "OfficialNotificationType" NOT NULL,
  "name" TEXT NOT NULL,
  "language" TEXT NOT NULL DEFAULT 'en',
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "official_whatsapp_templates_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "official_whatsapp_templates_type_key" ON "official_whatsapp_templates"("type");

CREATE TABLE "official_whatsapp_otp_config" (
  "id" TEXT NOT NULL DEFAULT 'otp',
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "login_enabled" BOOLEAN NOT NULL DEFAULT false,
  "password_reset_enabled" BOOLEAN NOT NULL DEFAULT false,
  "template_name" TEXT NOT NULL DEFAULT '',
  "language" TEXT NOT NULL DEFAULT 'en',
  "expiry_seconds" INTEGER NOT NULL DEFAULT 600,
  "resend_cooldown_seconds" INTEGER NOT NULL DEFAULT 60,
  "max_attempts" INTEGER NOT NULL DEFAULT 5,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "official_whatsapp_otp_config_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "official_subscription_notify_config" (
  "id" TEXT NOT NULL DEFAULT 'subscription',
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "reminder1_days" INTEGER NOT NULL DEFAULT 7,
  "reminder1_enabled" BOOLEAN NOT NULL DEFAULT true,
  "reminder2_days" INTEGER NOT NULL DEFAULT 1,
  "reminder2_enabled" BOOLEAN NOT NULL DEFAULT true,
  "expired_enabled" BOOLEAN NOT NULL DEFAULT true,
  "payment_enabled" BOOLEAN NOT NULL DEFAULT false,
  "activated_enabled" BOOLEAN NOT NULL DEFAULT false,
  "renewal_enabled" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "official_subscription_notify_config_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "subscription_notification_logs" (
  "id" TEXT NOT NULL,
  "user_id" TEXT,
  "subscription_id" TEXT NOT NULL,
  "team_id" TEXT,
  "notification_type" "OfficialNotificationType" NOT NULL,
  "template_name" TEXT NOT NULL,
  "status" "OfficialNotificationStatus" NOT NULL DEFAULT 'PENDING',
  "provider_message_id" TEXT,
  "scheduled_date" DATE NOT NULL,
  "phone" TEXT,
  "sent_at" TIMESTAMP(3),
  "failure_reason" TEXT,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "subscription_notification_logs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "subscription_notification_logs_subscription_id_notification_type_scheduled_date_key"
  ON "subscription_notification_logs"("subscription_id", "notification_type", "scheduled_date");
CREATE INDEX "subscription_notification_logs_status_created_at_idx" ON "subscription_notification_logs"("status", "created_at");
CREATE INDEX "subscription_notification_logs_user_id_idx" ON "subscription_notification_logs"("user_id");

ALTER TABLE "subscription_notification_logs"
  ADD CONSTRAINT "subscription_notification_logs_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "phone_otp_verifications" (
  "id" TEXT NOT NULL,
  "user_id" TEXT,
  "phone" TEXT NOT NULL,
  "email" TEXT,
  "purpose" TEXT NOT NULL,
  "otp_hash" TEXT NOT NULL,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "max_attempts" INTEGER NOT NULL DEFAULT 5,
  "verified_at" TIMESTAMP(3),
  "last_sent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "metadata" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "phone_otp_verifications_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "phone_otp_verifications_phone_purpose_idx" ON "phone_otp_verifications"("phone", "purpose");
CREATE INDEX "phone_otp_verifications_email_purpose_idx" ON "phone_otp_verifications"("email", "purpose");

ALTER TABLE "phone_otp_verifications"
  ADD CONSTRAINT "phone_otp_verifications_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "official_whatsapp_senders" ("id", "updated_at")
VALUES ('chatloora-official', CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "official_whatsapp_otp_config" ("id", "updated_at")
VALUES ('otp', CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "official_subscription_notify_config" ("id", "updated_at")
VALUES ('subscription', CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;
