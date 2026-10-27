-- Add PENDING subscription status
ALTER TYPE "SubscriptionStatus" ADD VALUE IF NOT EXISTS 'PENDING';

-- Billing cycle on subscriptions
ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "billing_cycle" "BillingInterval" NOT NULL DEFAULT 'MONTHLY';

-- Chatloora SaaS plans (Basic / Professional / Business)
UPDATE "subscription_plans"
SET
  "slug" = 'basic',
  "name" = 'Basic',
  "description" = 'Essential messaging for small teams',
  "price_cents" = 1500,
  "trial_days" = 0,
  "features" = '["Unlimited messages","Unified inbox","Connect Facebook, Instagram and Telegram","1 WhatsApp Event number","1 user","Basic analytics","Standard support"]'::jsonb,
  "sort_order" = 1,
  "updated_at" = CURRENT_TIMESTAMP
WHERE "slug" = 'starter';

UPDATE "subscription_plans"
SET
  "slug" = 'professional',
  "name" = 'Professional',
  "description" = 'AI-powered support for growing teams',
  "price_cents" = 3900,
  "trial_days" = 0,
  "features" = '["Everything in Basic","3 WhatsApp Event numbers","Up to 5 users","AI Assistant","AI training on business data","Customer memory","Human handoff","Team collaboration","Advanced analytics","Priority support"]'::jsonb,
  "sort_order" = 2,
  "updated_at" = CURRENT_TIMESTAMP
WHERE "slug" = 'pro';

UPDATE "subscription_plans"
SET
  "slug" = 'business',
  "name" = 'Business',
  "description" = 'Scale with API access and advanced controls',
  "price_cents" = 7900,
  "trial_days" = 0,
  "features" = '["Everything in Professional","10 WhatsApp Event numbers","Up to 15 users","API Access","Webhooks","Advanced team management","Enterprise analytics","High priority support"]'::jsonb,
  "sort_order" = 3,
  "updated_at" = CURRENT_TIMESTAMP
WHERE "slug" = 'enterprise';

INSERT INTO "subscription_plans" ("id", "slug", "name", "description", "price_cents", "currency", "interval", "trial_days", "features", "is_active", "sort_order", "updated_at")
SELECT * FROM (VALUES
  ('plan_basic', 'basic', 'Basic', 'Essential messaging for small teams', 1500, 'USD', 'MONTHLY'::"BillingInterval", 0, '["Unlimited messages","Unified inbox","Connect Facebook, Instagram and Telegram","1 WhatsApp Event number","1 user","Basic analytics","Standard support"]'::jsonb, true, 1, CURRENT_TIMESTAMP),
  ('plan_professional', 'professional', 'Professional', 'AI-powered support for growing teams', 3900, 'USD', 'MONTHLY'::"BillingInterval", 0, '["Everything in Basic","3 WhatsApp Event numbers","Up to 5 users","AI Assistant","AI training on business data","Customer memory","Human handoff","Team collaboration","Advanced analytics","Priority support"]'::jsonb, true, 2, CURRENT_TIMESTAMP),
  ('plan_business', 'business', 'Business', 'Scale with API access and advanced controls', 7900, 'USD', 'MONTHLY'::"BillingInterval", 0, '["Everything in Professional","10 WhatsApp Event numbers","Up to 15 users","API Access","Webhooks","Advanced team management","Enterprise analytics","High priority support"]'::jsonb, true, 3, CURRENT_TIMESTAMP)
) AS v("id", "slug", "name", "description", "price_cents", "currency", "interval", "trial_days", "features", "is_active", "sort_order", "updated_at")
WHERE NOT EXISTS (SELECT 1 FROM "subscription_plans" WHERE "slug" IN ('basic', 'professional', 'business'));
