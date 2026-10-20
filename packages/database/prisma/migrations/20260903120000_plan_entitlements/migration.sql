-- AlterTable
ALTER TABLE "subscription_plans"
  ADD COLUMN IF NOT EXISTS "name_ar" TEXT,
  ADD COLUMN IF NOT EXISTS "name_en" TEXT,
  ADD COLUMN IF NOT EXISTS "description_ar" TEXT,
  ADD COLUMN IF NOT EXISTS "description_en" TEXT,
  ADD COLUMN IF NOT EXISTS "is_recommended" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "accent_color" TEXT;

UPDATE "subscription_plans"
SET
  "name_en" = COALESCE("name_en", "name"),
  "name_ar" = COALESCE("name_ar", "name"),
  "description_en" = COALESCE("description_en", "description"),
  "description_ar" = COALESCE("description_ar", "description"),
  "is_recommended" = CASE WHEN "slug" = 'professional' THEN true ELSE "is_recommended" END;

-- CreateTable
CREATE TABLE IF NOT EXISTS "feature_definitions" (
    "key" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "value_type" TEXT NOT NULL,
    "name_ar" TEXT NOT NULL,
    "name_en" TEXT NOT NULL,
    "description_ar" TEXT,
    "description_en" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "feature_definitions_pkey" PRIMARY KEY ("key")
);

CREATE INDEX IF NOT EXISTS "feature_definitions_category_sort_order_idx" ON "feature_definitions"("category", "sort_order");

-- CreateTable
CREATE TABLE IF NOT EXISTS "plan_entitlements" (
    "id" TEXT NOT NULL,
    "plan_id" TEXT NOT NULL,
    "feature_key" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "limit_value" INTEGER,

    CONSTRAINT "plan_entitlements_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "plan_entitlements_plan_id_feature_key_key" ON "plan_entitlements"("plan_id", "feature_key");
CREATE INDEX IF NOT EXISTS "plan_entitlements_feature_key_idx" ON "plan_entitlements"("feature_key");

ALTER TABLE "plan_entitlements"
  DROP CONSTRAINT IF EXISTS "plan_entitlements_plan_id_fkey",
  ADD CONSTRAINT "plan_entitlements_plan_id_fkey"
    FOREIGN KEY ("plan_id") REFERENCES "subscription_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "plan_entitlements"
  DROP CONSTRAINT IF EXISTS "plan_entitlements_feature_key_fkey",
  ADD CONSTRAINT "plan_entitlements_feature_key_fkey"
    FOREIGN KEY ("feature_key") REFERENCES "feature_definitions"("key") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "feature_definitions" ("key", "category", "value_type", "name_ar", "name_en", "description_ar", "description_en", "sort_order")
VALUES
  ('whatsapp_enabled', 'whatsapp', 'BOOLEAN', 'تفعيل واتساب', 'Enable WhatsApp', 'السماح بربط أرقام واتساب لصندوق الوارد', 'Allow connecting WhatsApp numbers for the inbox', 10),
  ('maximum_whatsapp_numbers', 'whatsapp', 'LIMIT', 'الحد الأقصى لأرقام واتساب', 'Maximum WhatsApp numbers', 'عدد أرقام واتساب المسموح ربطها لصندوق الوارد', 'How many inbox WhatsApp numbers can be connected', 20),
  ('tiktok_integration_enabled', 'tiktok', 'BOOLEAN', 'تكامل TikTok', 'TikTok integration', 'السماح بربط TikTok والبكسلات', 'Allow TikTok ads, pixels, and tracking', 30),
  ('maximum_tiktok_whatsapp_numbers', 'tiktok', 'LIMIT', 'أرقام واتساب لتتبع TikTok', 'TikTok WhatsApp numbers', 'عدد أرقام واتساب المخصصة لتتبع إعلانات TikTok', 'WhatsApp numbers that can be used for TikTok pixel tracking', 40),
  ('maximum_tiktok_pixels', 'tiktok', 'LIMIT', 'الحد الأقصى لبكسلات TikTok', 'Maximum TikTok pixels', 'عدد بكسلات TikTok المسموح إنشاؤها', 'How many TikTok pixels can be created', 50),
  ('maximum_pixels', 'tiktok', 'LIMIT', 'الحد الأقصى للبكسلات', 'Maximum pixels', 'حد البكسلات العام', 'Overall pixel cap', 55),
  ('whatsapp_api_enabled', 'whatsapp_api', 'BOOLEAN', 'WhatsApp API', 'WhatsApp API', 'السماح بربط WhatsApp Cloud API', 'Allow WhatsApp Cloud API connections', 60),
  ('facebook_integration_enabled', 'social', 'BOOLEAN', 'فيسبوك', 'Facebook', 'ربط صفحات فيسبوك وماسنجر', 'Facebook Pages and Messenger', 70),
  ('instagram_integration_enabled', 'social', 'BOOLEAN', 'إنستغرام', 'Instagram', 'ربط إنستغرام للأعمال', 'Instagram Business integration', 80),
  ('telegram_integration_enabled', 'social', 'BOOLEAN', 'تيليغرام', 'Telegram', 'ربط تيليغرام', 'Telegram integration', 90),
  ('ai_reply_enabled', 'ai', 'BOOLEAN', 'الرد الذكي بالذكاء الاصطناعي', 'AI auto reply', 'تفعيل الردود الآلية بالذكاء الاصطناعي', 'Enable AI auto-replies and automation', 100),
  ('appointments_enabled', 'other', 'BOOLEAN', 'نظام المواعيد', 'Appointments', 'المواعيد وربط تقويم Google', 'Appointments and Google Calendar', 110),
  ('maximum_team_members', 'team', 'LIMIT', 'أعضاء الفريق', 'Maximum team members', 'عدد أعضاء مساحة العمل', 'Workspace team member cap', 120)
ON CONFLICT ("key") DO UPDATE SET
  "category" = EXCLUDED."category",
  "value_type" = EXCLUDED."value_type",
  "name_ar" = EXCLUDED."name_ar",
  "name_en" = EXCLUDED."name_en",
  "description_ar" = EXCLUDED."description_ar",
  "description_en" = EXCLUDED."description_en",
  "sort_order" = EXCLUDED."sort_order";

INSERT INTO "plan_entitlements" ("id", "plan_id", "feature_key", "enabled", "limit_value")
SELECT
  md5(p.id || f.key),
  p.id,
  f.key,
  CASE f.key
    WHEN 'whatsapp_enabled' THEN true
    WHEN 'tiktok_integration_enabled' THEN true
    WHEN 'whatsapp_api_enabled' THEN (p.slug IN ('professional', 'business', 'pro', 'enterprise'))
    WHEN 'facebook_integration_enabled' THEN (p.slug IN ('professional', 'business', 'pro', 'enterprise'))
    WHEN 'instagram_integration_enabled' THEN (p.slug IN ('professional', 'business', 'pro', 'enterprise'))
    WHEN 'telegram_integration_enabled' THEN (p.slug IN ('professional', 'business', 'pro', 'enterprise'))
    WHEN 'ai_reply_enabled' THEN (p.slug IN ('professional', 'business', 'pro', 'enterprise'))
    WHEN 'appointments_enabled' THEN (p.slug IN ('professional', 'business', 'pro', 'enterprise'))
    ELSE true
  END,
  CASE f.key
    WHEN 'maximum_whatsapp_numbers' THEN CASE WHEN p.slug IN ('business', 'enterprise') THEN 10 WHEN p.slug IN ('professional', 'pro') THEN 5 ELSE 1 END
    WHEN 'maximum_tiktok_whatsapp_numbers' THEN CASE WHEN p.slug IN ('business', 'enterprise') THEN 10 WHEN p.slug IN ('professional', 'pro') THEN 5 ELSE 1 END
    WHEN 'maximum_tiktok_pixels' THEN CASE WHEN p.slug IN ('business', 'enterprise') THEN 10 WHEN p.slug IN ('professional', 'pro') THEN 5 ELSE 1 END
    WHEN 'maximum_pixels' THEN CASE WHEN p.slug IN ('business', 'enterprise') THEN 10 WHEN p.slug IN ('professional', 'pro') THEN 5 ELSE 1 END
    WHEN 'maximum_team_members' THEN CASE WHEN p.slug IN ('business', 'enterprise') THEN 10 WHEN p.slug IN ('professional', 'pro') THEN 5 ELSE 1 END
    ELSE NULL
  END
FROM "subscription_plans" p
CROSS JOIN "feature_definitions" f
ON CONFLICT ("plan_id", "feature_key") DO NOTHING;
