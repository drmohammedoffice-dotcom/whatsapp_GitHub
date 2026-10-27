-- CreateEnum
CREATE TYPE "TikTokOptimizationEvent" AS ENUM (
  'PageView',
  'ViewContent',
  'Lead',
  'CompleteRegistration',
  'Contact',
  'SubmitForm',
  'AddToCart',
  'InitiateCheckout',
  'Purchase',
  'Custom'
);

-- CreateTable
CREATE TABLE "tiktok_integrations" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "team_id" TEXT NOT NULL,
    "advertiser_id" TEXT,
    "advertiser_name" TEXT,
    "pixel_id" TEXT,
    "pixel_code" TEXT,
    "pixel_name" TEXT,
    "whatsapp_number" TEXT,
    "redirect_slug" TEXT NOT NULL,
    "default_optimization_event" "TikTokOptimizationEvent" NOT NULL DEFAULT 'Lead',
    "custom_event_name" TEXT,
    "redirect_message" TEXT,
    "wizard_step" INTEGER NOT NULL DEFAULT 1,
    "wizard_completed" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tiktok_integrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tiktok_event_configurations" (
    "id" TEXT NOT NULL,
    "integration_id" TEXT NOT NULL,
    "event_name" "TikTokOptimizationEvent" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tiktok_event_configurations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tiktok_integration_clicks" (
    "id" TEXT NOT NULL,
    "integration_id" TEXT NOT NULL,
    "ttclid" TEXT,
    "campaign_id" TEXT,
    "adgroup_id" TEXT,
    "ad_id" TEXT,
    "advertiser_id" TEXT,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "page_view_sent" BOOLEAN NOT NULL DEFAULT false,
    "optimization_event_sent" BOOLEAN NOT NULL DEFAULT false,
    "events_payload" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tiktok_integration_clicks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tiktok_integration_leads" (
    "id" TEXT NOT NULL,
    "integration_id" TEXT NOT NULL,
    "click_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tiktok_integration_leads_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tiktok_integrations_redirect_slug_key" ON "tiktok_integrations"("redirect_slug");

-- CreateIndex
CREATE UNIQUE INDEX "tiktok_integrations_user_id_team_id_key" ON "tiktok_integrations"("user_id", "team_id");

-- CreateIndex
CREATE INDEX "tiktok_integrations_team_id_idx" ON "tiktok_integrations"("team_id");

-- CreateIndex
CREATE UNIQUE INDEX "tiktok_event_configurations_integration_id_event_name_key" ON "tiktok_event_configurations"("integration_id", "event_name");

-- CreateIndex
CREATE INDEX "tiktok_integration_clicks_integration_id_created_at_idx" ON "tiktok_integration_clicks"("integration_id", "created_at");

-- CreateIndex
CREATE INDEX "tiktok_integration_clicks_campaign_id_idx" ON "tiktok_integration_clicks"("campaign_id");

-- CreateIndex
CREATE UNIQUE INDEX "tiktok_integration_leads_click_id_key" ON "tiktok_integration_leads"("click_id");

-- CreateIndex
CREATE INDEX "tiktok_integration_leads_integration_id_created_at_idx" ON "tiktok_integration_leads"("integration_id", "created_at");

-- AddForeignKey
ALTER TABLE "tiktok_integrations" ADD CONSTRAINT "tiktok_integrations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tiktok_integrations" ADD CONSTRAINT "tiktok_integrations_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tiktok_event_configurations" ADD CONSTRAINT "tiktok_event_configurations_integration_id_fkey" FOREIGN KEY ("integration_id") REFERENCES "tiktok_integrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tiktok_integration_clicks" ADD CONSTRAINT "tiktok_integration_clicks_integration_id_fkey" FOREIGN KEY ("integration_id") REFERENCES "tiktok_integrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tiktok_integration_leads" ADD CONSTRAINT "tiktok_integration_leads_integration_id_fkey" FOREIGN KEY ("integration_id") REFERENCES "tiktok_integrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tiktok_integration_leads" ADD CONSTRAINT "tiktok_integration_leads_click_id_fkey" FOREIGN KEY ("click_id") REFERENCES "tiktok_integration_clicks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
