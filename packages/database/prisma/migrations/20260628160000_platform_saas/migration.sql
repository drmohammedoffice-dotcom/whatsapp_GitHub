-- Platform SaaS: multi-business, campaigns, WhatsApp Cloud, routing, webhooks

-- Permission enum extensions
ALTER TYPE "Permission" ADD VALUE IF NOT EXISTS 'BUSINESS_MANAGE';
ALTER TYPE "Permission" ADD VALUE IF NOT EXISTS 'CAMPAIGN_MANAGE';
ALTER TYPE "Permission" ADD VALUE IF NOT EXISTS 'WHATSAPP_CLOUD_MANAGE';
ALTER TYPE "Permission" ADD VALUE IF NOT EXISTS 'ROUTING_MANAGE';

-- Channel provider extension
ALTER TYPE "ChannelProvider" ADD VALUE IF NOT EXISTS 'WHATSAPP_CLOUD';

-- New enums
CREATE TYPE "CampaignSourceType" AS ENUM ('TIKTOK', 'FACEBOOK', 'INSTAGRAM', 'GOOGLE', 'LANDING_PAGE', 'SNAPCHAT', 'CUSTOM');
CREATE TYPE "WhatsAppRoutingStrategy" AS ENUM ('MANUAL', 'ROUND_ROBIN', 'RANDOM', 'PERCENTAGE', 'COUNTRY', 'CAMPAIGN', 'AI');
CREATE TYPE "WhatsAppCloudAccountStatus" AS ENUM ('PENDING', 'CONNECTING', 'CONNECTED', 'DISCONNECTED', 'FAILED', 'EXPIRED');
CREATE TYPE "WebhookProvider" AS ENUM ('TIKTOK', 'META', 'WHATSAPP_CLOUD', 'GOOGLE', 'CUSTOM');
CREATE TYPE "WebhookEventStatus" AS ENUM ('PENDING', 'PROCESSED', 'FAILED', 'SKIPPED');

-- AiAgent: allow multiple agents per team (drop unique on teamId+type)
DROP INDEX IF EXISTS "AiAgent_teamId_type_key";
CREATE INDEX IF NOT EXISTS "AiAgent_teamId_type_idx" ON "AiAgent"("teamId", "type");

-- Channel extensions
ALTER TABLE "Channel" ADD COLUMN IF NOT EXISTS "businessId" TEXT;
ALTER TABLE "Channel" ADD COLUMN IF NOT EXISTS "aiAgentId" TEXT;
ALTER TABLE "Channel" ADD COLUMN IF NOT EXISTS "whatsAppCloudAccountId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "Channel_whatsAppCloudAccountId_key" ON "Channel"("whatsAppCloudAccountId");
CREATE INDEX IF NOT EXISTS "Channel_teamId_businessId_idx" ON "Channel"("teamId", "businessId");
CREATE INDEX IF NOT EXISTS "Channel_aiAgentId_idx" ON "Channel"("aiAgentId");

-- TikTokCampaign → unified Campaign link
ALTER TABLE "TikTokCampaign" ADD COLUMN IF NOT EXISTS "platformCampaignId" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "TikTokCampaign_platformCampaignId_key" ON "TikTokCampaign"("platformCampaignId");

-- Business
CREATE TABLE "Business" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "industry" TEXT,
    "timezone" TEXT DEFAULT 'UTC',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Business_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Business_teamId_slug_key" ON "Business"("teamId", "slug");
CREATE INDEX "Business_teamId_idx" ON "Business"("teamId");

-- TrafficSource
CREATE TABLE "TrafficSource" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "type" "CampaignSourceType" NOT NULL,
    "name" TEXT NOT NULL,
    "externalId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TrafficSource_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "TrafficSource_teamId_type_idx" ON "TrafficSource"("teamId", "type");

-- WhatsAppRoutingRule (before Campaign FK)
CREATE TABLE "WhatsAppRoutingRule" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "strategy" "WhatsAppRoutingStrategy" NOT NULL DEFAULT 'MANUAL',
    "config" JSONB,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WhatsAppRoutingRule_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "WhatsAppRoutingRule_teamId_active_idx" ON "WhatsAppRoutingRule"("teamId", "active");

-- WhatsAppCloudAccount (before Campaign FK)
CREATE TABLE "WhatsAppCloudAccount" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "businessId" TEXT,
    "aiAgentId" TEXT,
    "name" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "phoneNumberId" TEXT NOT NULL,
    "wabaId" TEXT NOT NULL,
    "encryptedAccessToken" TEXT NOT NULL,
    "encryptedVerifyToken" TEXT,
    "status" "WhatsAppCloudAccountStatus" NOT NULL DEFAULT 'PENDING',
    "defaultInboxLabel" TEXT,
    "connectedAt" TIMESTAMP(3),
    "lastSyncAt" TIMESTAMP(3),
    "lastSeenAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WhatsAppCloudAccount_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "WhatsAppCloudAccount_teamId_phoneNumberId_key" ON "WhatsAppCloudAccount"("teamId", "phoneNumberId");
CREATE INDEX "WhatsAppCloudAccount_teamId_status_idx" ON "WhatsAppCloudAccount"("teamId", "status");
CREATE INDEX "WhatsAppCloudAccount_businessId_idx" ON "WhatsAppCloudAccount"("businessId");
CREATE INDEX "WhatsAppCloudAccount_aiAgentId_idx" ON "WhatsAppCloudAccount"("aiAgentId");

-- Campaign
CREATE TABLE "Campaign" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "businessId" TEXT,
    "trafficSourceId" TEXT,
    "routingRuleId" TEXT,
    "aiAgentId" TEXT,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "whatsAppCloudAccountId" TEXT,
    "whatsAppSessionId" TEXT,
    "redirectMessage" TEXT,
    "utmDefaults" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Campaign_teamId_slug_key" ON "Campaign"("teamId", "slug");
CREATE INDEX "Campaign_teamId_active_idx" ON "Campaign"("teamId", "active");
CREATE INDEX "Campaign_businessId_idx" ON "Campaign"("businessId");

-- WhatsAppRoutingPoolMember
CREATE TABLE "WhatsAppRoutingPoolMember" (
    "id" TEXT NOT NULL,
    "routingRuleId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "weight" INTEGER NOT NULL DEFAULT 1,
    "countryCodes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WhatsAppRoutingPoolMember_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "WhatsAppRoutingPoolMember_routingRuleId_accountId_key" ON "WhatsAppRoutingPoolMember"("routingRuleId", "accountId");
CREATE INDEX "WhatsAppRoutingPoolMember_routingRuleId_idx" ON "WhatsAppRoutingPoolMember"("routingRuleId");

-- RedirectLog
CREATE TABLE "RedirectLog" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "clickToken" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "device" TEXT,
    "referrer" TEXT,
    "utmSource" TEXT,
    "utmMedium" TEXT,
    "utmCampaign" TEXT,
    "utmTerm" TEXT,
    "utmContent" TEXT,
    "resolvedAccountId" TEXT,
    "redirectedTo" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RedirectLog_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "RedirectLog_clickToken_key" ON "RedirectLog"("clickToken");
CREATE INDEX "RedirectLog_teamId_createdAt_idx" ON "RedirectLog"("teamId", "createdAt");
CREATE INDEX "RedirectLog_campaignId_idx" ON "RedirectLog"("campaignId");

-- IntegrationWebhookEvent (incoming provider webhooks)
CREATE TABLE "IntegrationWebhookEvent" (
    "id" TEXT NOT NULL,
    "teamId" TEXT,
    "provider" "WebhookProvider" NOT NULL,
    "eventType" TEXT NOT NULL,
    "externalId" TEXT,
    "payload" JSONB NOT NULL,
    "status" "WebhookEventStatus" NOT NULL DEFAULT 'PENDING',
    "error" TEXT,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "IntegrationWebhookEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "IntegrationWebhookEvent_teamId_provider_createdAt_idx" ON "IntegrationWebhookEvent"("teamId", "provider", "createdAt");
CREATE INDEX "IntegrationWebhookEvent_status_createdAt_idx" ON "IntegrationWebhookEvent"("status", "createdAt");
CREATE INDEX "IntegrationWebhookEvent_externalId_idx" ON "IntegrationWebhookEvent"("externalId");

-- MetaConnection
CREATE TABLE "MetaConnection" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "businessId" TEXT,
    "channelId" TEXT,
    "pageId" TEXT,
    "instagramId" TEXT,
    "pageName" TEXT,
    "instagramHandle" TEXT,
    "profilePictureUrl" TEXT,
    "connectionSource" TEXT DEFAULT 'oauth',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MetaConnection_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "MetaConnection_channelId_key" ON "MetaConnection"("channelId");
CREATE INDEX "MetaConnection_teamId_idx" ON "MetaConnection"("teamId");

-- Foreign keys
ALTER TABLE "Channel" ADD CONSTRAINT "Channel_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Channel" ADD CONSTRAINT "Channel_aiAgentId_fkey" FOREIGN KEY ("aiAgentId") REFERENCES "AiAgent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Channel" ADD CONSTRAINT "Channel_whatsAppCloudAccountId_fkey" FOREIGN KEY ("whatsAppCloudAccountId") REFERENCES "WhatsAppCloudAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Business" ADD CONSTRAINT "Business_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TrafficSource" ADD CONSTRAINT "TrafficSource_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_trafficSourceId_fkey" FOREIGN KEY ("trafficSourceId") REFERENCES "TrafficSource"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_routingRuleId_fkey" FOREIGN KEY ("routingRuleId") REFERENCES "WhatsAppRoutingRule"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_aiAgentId_fkey" FOREIGN KEY ("aiAgentId") REFERENCES "AiAgent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_whatsAppCloudAccountId_fkey" FOREIGN KEY ("whatsAppCloudAccountId") REFERENCES "WhatsAppCloudAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_whatsAppSessionId_fkey" FOREIGN KEY ("whatsAppSessionId") REFERENCES "WhatsAppSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "WhatsAppCloudAccount" ADD CONSTRAINT "WhatsAppCloudAccount_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WhatsAppCloudAccount" ADD CONSTRAINT "WhatsAppCloudAccount_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WhatsAppCloudAccount" ADD CONSTRAINT "WhatsAppCloudAccount_aiAgentId_fkey" FOREIGN KEY ("aiAgentId") REFERENCES "AiAgent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "WhatsAppRoutingRule" ADD CONSTRAINT "WhatsAppRoutingRule_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WhatsAppRoutingPoolMember" ADD CONSTRAINT "WhatsAppRoutingPoolMember_routingRuleId_fkey" FOREIGN KEY ("routingRuleId") REFERENCES "WhatsAppRoutingRule"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WhatsAppRoutingPoolMember" ADD CONSTRAINT "WhatsAppRoutingPoolMember_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "WhatsAppCloudAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RedirectLog" ADD CONSTRAINT "RedirectLog_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RedirectLog" ADD CONSTRAINT "RedirectLog_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RedirectLog" ADD CONSTRAINT "RedirectLog_resolvedAccountId_fkey" FOREIGN KEY ("resolvedAccountId") REFERENCES "WhatsAppCloudAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "IntegrationWebhookEvent" ADD CONSTRAINT "IntegrationWebhookEvent_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "MetaConnection" ADD CONSTRAINT "MetaConnection_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MetaConnection" ADD CONSTRAINT "MetaConnection_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MetaConnection" ADD CONSTRAINT "MetaConnection_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "TikTokCampaign" ADD CONSTRAINT "TikTokCampaign_platformCampaignId_fkey" FOREIGN KEY ("platformCampaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;
