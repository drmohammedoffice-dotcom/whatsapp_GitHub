-- Instant Lead Form Builder

CREATE TYPE "InstantFormStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');
CREATE TYPE "InstantFormAdPlatform" AS ENUM ('TIKTOK', 'FACEBOOK', 'INSTAGRAM', 'GOOGLE', 'SNAPCHAT', 'OTHER');
CREATE TYPE "InstantFormOrderStatus" AS ENUM ('NEW', 'CONTACTED', 'CONFIRMED', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'SPAM');

CREATE TABLE "instant_forms" (
    "id" TEXT NOT NULL,
    "team_id" TEXT NOT NULL,
    "created_by_user_id" TEXT,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "short_code" TEXT NOT NULL,
    "ad_platform" "InstantFormAdPlatform" NOT NULL DEFAULT 'TIKTOK',
    "ad_account_label" TEXT,
    "status" "InstantFormStatus" NOT NULL DEFAULT 'DRAFT',
    "template_key" TEXT,
    "draft_document" JSONB NOT NULL,
    "published_document" JSONB,
    "published_at" TIMESTAMP(3),
    "whatsapp_number" TEXT,
    "pixel_integration_id" TEXT,
    "seo_title" TEXT,
    "seo_description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "instant_forms_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "instant_form_versions" (
    "id" TEXT NOT NULL,
    "form_id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "label" TEXT,
    "document" JSONB NOT NULL,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "instant_form_versions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "instant_form_orders" (
    "id" TEXT NOT NULL,
    "team_id" TEXT NOT NULL,
    "form_id" TEXT NOT NULL,
    "order_number" TEXT NOT NULL,
    "status" "InstantFormOrderStatus" NOT NULL DEFAULT 'NEW',
    "customer_name" TEXT,
    "customer_phone" TEXT,
    "customer_whatsapp" TEXT,
    "customer_email" TEXT,
    "city" TEXT,
    "governorate" TEXT,
    "address" TEXT,
    "product_name" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unit_price" DECIMAL(12,2),
    "total_price" DECIMAL(12,2),
    "currency" TEXT NOT NULL DEFAULT 'IQD',
    "answers" JSONB NOT NULL,
    "notes" TEXT,
    "internal_notes" TEXT,
    "ad_platform" "InstantFormAdPlatform",
    "ad_account_label" TEXT,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "device_type" TEXT,
    "browser" TEXT,
    "utm_source" TEXT,
    "utm_medium" TEXT,
    "utm_campaign" TEXT,
    "utm_content" TEXT,
    "utm_term" TEXT,
    "ttclid" TEXT,
    "fbclid" TEXT,
    "gclid" TEXT,
    "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "instant_form_orders_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "instant_forms_slug_key" ON "instant_forms"("slug");
CREATE UNIQUE INDEX "instant_forms_short_code_key" ON "instant_forms"("short_code");
CREATE INDEX "instant_forms_team_id_status_updated_at_idx" ON "instant_forms"("team_id", "status", "updated_at");
CREATE INDEX "instant_forms_team_id_created_at_idx" ON "instant_forms"("team_id", "created_at");

CREATE UNIQUE INDEX "instant_form_versions_form_id_version_key" ON "instant_form_versions"("form_id", "version");
CREATE INDEX "instant_form_versions_form_id_created_at_idx" ON "instant_form_versions"("form_id", "created_at");

CREATE UNIQUE INDEX "instant_form_orders_team_id_order_number_key" ON "instant_form_orders"("team_id", "order_number");
CREATE INDEX "instant_form_orders_team_id_submitted_at_idx" ON "instant_form_orders"("team_id", "submitted_at");
CREATE INDEX "instant_form_orders_form_id_submitted_at_idx" ON "instant_form_orders"("form_id", "submitted_at");
CREATE INDEX "instant_form_orders_team_id_status_submitted_at_idx" ON "instant_form_orders"("team_id", "status", "submitted_at");
CREATE INDEX "instant_form_orders_customer_phone_idx" ON "instant_form_orders"("customer_phone");

ALTER TABLE "instant_forms" ADD CONSTRAINT "instant_forms_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "instant_form_versions" ADD CONSTRAINT "instant_form_versions_form_id_fkey" FOREIGN KEY ("form_id") REFERENCES "instant_forms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "instant_form_orders" ADD CONSTRAINT "instant_form_orders_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "instant_form_orders" ADD CONSTRAINT "instant_form_orders_form_id_fkey" FOREIGN KEY ("form_id") REFERENCES "instant_forms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
