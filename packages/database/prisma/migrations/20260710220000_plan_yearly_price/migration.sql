ALTER TABLE "subscription_plans" ADD COLUMN IF NOT EXISTS "yearly_price_cents" INTEGER;

UPDATE "subscription_plans"
SET "yearly_price_cents" = ROUND("price_cents" * 12 * 0.8)
WHERE "yearly_price_cents" IS NULL;
