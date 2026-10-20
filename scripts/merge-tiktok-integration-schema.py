#!/usr/bin/env python3
"""Append TikTok Integration models to Prisma schema if missing."""
from pathlib import Path
import re

SCHEMA = Path('packages/database/prisma/schema.prisma')
if not SCHEMA.exists():
    raise SystemExit('schema.prisma not found')

text = SCHEMA.read_text(encoding='utf-8')

# Clean broken partial state from failed merges
text = re.sub(r'\n  tikTokIntegrations TikTokIntegration\[\]', '', text)
text = re.sub(r'\n  tikTokIntegrations TikTokIntegration\[\]', '', text)

if 'model TikTokIntegration' in text:
    print('TikTokIntegration models already present')
    raise SystemExit(0)

ENUM_BLOCK = '''
enum TikTokOptimizationEvent {
  PageView
  ViewContent
  Lead
  CompleteRegistration
  Contact
  SubmitForm
  AddToCart
  InitiateCheckout
  Purchase
  Custom
}
'''

MODELS_BLOCK = '''
model TikTokIntegration {
  id                       String                  @id @default(cuid())
  userId                   String                  @map("user_id")
  teamId                   String                  @map("team_id")
  advertiserId             String?                 @map("advertiser_id")
  advertiserName           String?                 @map("advertiser_name")
  pixelId                  String?                 @map("pixel_id")
  pixelCode                String?                 @map("pixel_code")
  pixelName                String?                 @map("pixel_name")
  whatsappNumber           String?                 @map("whatsapp_number")
  redirectSlug             String                  @unique @map("redirect_slug")
  defaultOptimizationEvent TikTokOptimizationEvent @default(Lead) @map("default_optimization_event")
  customEventName          String?                 @map("custom_event_name")
  redirectMessage          String?                 @map("redirect_message")
  wizardStep               Int                     @default(1) @map("wizard_step")
  wizardCompleted          Boolean                 @default(false) @map("wizard_completed")
  createdAt                DateTime                @default(now()) @map("created_at")
  updatedAt                DateTime                @updatedAt @map("updated_at")
  user                     User                    @relation(fields: [userId], references: [id], onDelete: Cascade)
  team                     Team                    @relation(fields: [teamId], references: [id], onDelete: Cascade)
  eventConfigurations      TikTokEventConfiguration[]
  clicks                   TikTokIntegrationClick[]
  leads                    TikTokIntegrationLead[]

  @@unique([userId, teamId])
  @@index([teamId])
  @@map("tiktok_integrations")
}

model TikTokEventConfiguration {
  id            String                  @id @default(cuid())
  integrationId String                  @map("integration_id")
  eventName     TikTokOptimizationEvent @map("event_name")
  enabled       Boolean                 @default(false)
  createdAt     DateTime                @default(now()) @map("created_at")
  integration   TikTokIntegration       @relation(fields: [integrationId], references: [id], onDelete: Cascade)

  @@unique([integrationId, eventName])
  @@map("tiktok_event_configurations")
}

model TikTokIntegrationClick {
  id                    String               @id @default(cuid())
  integrationId         String               @map("integration_id")
  ttclid                String?
  campaignId            String?              @map("campaign_id")
  adgroupId             String?              @map("adgroup_id")
  adId                  String?              @map("ad_id")
  advertiserId          String?              @map("advertiser_id")
  ipAddress             String?              @map("ip_address")
  userAgent             String?              @map("user_agent")
  pageViewSent          Boolean              @default(false) @map("page_view_sent")
  optimizationEventSent Boolean              @default(false) @map("optimization_event_sent")
  eventsPayload         Json?                @map("events_payload")
  createdAt             DateTime             @default(now()) @map("created_at")
  integration           TikTokIntegration    @relation(fields: [integrationId], references: [id], onDelete: Cascade)
  lead                  TikTokIntegrationLead?

  @@index([integrationId, createdAt])
  @@index([campaignId])
  @@map("tiktok_integration_clicks")
}

model TikTokIntegrationLead {
  id            String               @id @default(cuid())
  integrationId String               @map("integration_id")
  clickId       String               @unique @map("click_id")
  createdAt     DateTime             @default(now()) @map("created_at")
  integration   TikTokIntegration    @relation(fields: [integrationId], references: [id], onDelete: Cascade)
  click         TikTokIntegrationClick @relation(fields: [clickId], references: [id], onDelete: Cascade)

  @@index([integrationId, createdAt])
  @@map("tiktok_integration_leads")
}
'''

text = text.rstrip() + '\n' + ENUM_BLOCK + MODELS_BLOCK + '\n'

if 'tikTokIntegrations TikTokIntegration[]' not in text:
    if 'tikTokMarketingConnection TikTokMarketingConnection?' in text:
        text = text.replace(
            'tikTokMarketingConnection TikTokMarketingConnection?',
            'tikTokMarketingConnection TikTokMarketingConnection?\n  tikTokIntegrations TikTokIntegration[]',
            1,
        )
    elif 'tikTokLoginAccount TikTokLoginAccount?' in text:
        text = text.replace(
            'tikTokLoginAccount TikTokLoginAccount?',
            'tikTokLoginAccount TikTokLoginAccount?\n  tikTokIntegrations TikTokIntegration[]',
            1,
        )
    else:
        text = re.sub(
            r'(model User \{.*?)(\n\})',
            r'\1\n  tikTokIntegrations TikTokIntegration[]\2',
            text,
            count=1,
            flags=re.DOTALL,
        )

if text.count('tikTokIntegrations TikTokIntegration[]') < 2:
    text = text.replace(
        'tikTokCampaigns TikTokCampaign[]',
        'tikTokCampaigns TikTokCampaign[]\n  tikTokIntegrations TikTokIntegration[]',
        1,
    )

SCHEMA.write_text(text, encoding='utf-8')
print('Merged TikTok Integration models into schema.prisma')
