-- Aligns databases created before the baseline (production) with schema.prisma.
-- Every statement is idempotent: on a database built from the baseline it is a no-op.

-- Missing unique/lookup indexes (names chosen not to clash with legacy tables).
CREATE UNIQUE INDEX IF NOT EXISTS "TikTokTrackingClick_click_token_key" ON "TikTokTrackingClick"("clickToken");
CREATE INDEX IF NOT EXISTS "TikTokTrackingClick_team_created_idx" ON "TikTokTrackingClick"("teamId", "createdAt");
CREATE INDEX IF NOT EXISTS "TikTokTrackingClick_campaign_idx" ON "TikTokTrackingClick"("campaignId");
CREATE INDEX IF NOT EXISTS "tiktok_campaigns_advertiser_id_idx" ON "tiktok_campaigns"("advertiser_id");
CREATE INDEX IF NOT EXISTS "tiktok_mkt_advertisers_user_idx" ON "tiktok_marketing_advertisers"("user_id");
CREATE UNIQUE INDEX IF NOT EXISTS "tiktok_mkt_advertisers_user_advertiser_key" ON "tiktok_marketing_advertisers"("user_id", "advertiser_id");

-- Leftover index of the removed Creative Studio feature.
DROP INDEX IF EXISTS "CreativeVideoVersion_teamId_projectId_idx";

-- Column defaults/types that Prisma manages itself.
ALTER TABLE "landing_page_config" ALTER COLUMN "id" SET DEFAULT 'default';
ALTER TABLE "landing_page_config" ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3);
ALTER TABLE "landing_page_config" ALTER COLUMN "updated_at" DROP DEFAULT;
ALTER TABLE "landing_page_config" ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3);
ALTER TABLE "tiktok_ads_balance_checkouts" ALTER COLUMN "updated_at" DROP DEFAULT;
ALTER TABLE "tiktok_marketing_advertisers" ALTER COLUMN "updated_at" DROP DEFAULT;

-- Same foreign key, adding ON UPDATE CASCADE like every other relation.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'domain_mailbox_messages_mailbox_id_fkey'
      AND pg_get_constraintdef(oid) NOT LIKE '%ON UPDATE CASCADE%'
  ) THEN
    ALTER TABLE "domain_mailbox_messages" DROP CONSTRAINT "domain_mailbox_messages_mailbox_id_fkey";
    ALTER TABLE "domain_mailbox_messages" ADD CONSTRAINT "domain_mailbox_messages_mailbox_id_fkey"
      FOREIGN KEY ("mailbox_id") REFERENCES "domain_mailboxes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Index names truncated differently by hand-made SQL (63-char limit): rename to Prisma's names.
DO $$
DECLARE
  pair text[];
  renames text[][] := ARRAY[
    ARRAY['subscription_notification_logs_subscription_id_notification_typ', 'subscription_notification_logs_subscription_id_notification_key'],
    ARRAY['tiktok_event_sets_workspace_id_advertiser_id_whatsapp_number_ke', 'tiktok_event_sets_workspace_id_advertiser_id_whatsapp_numbe_key'],
    ARRAY['tiktok_integration_conversions_integration_id_conversation_id_c', 'tiktok_integration_conversions_integration_id_conversation__idx'],
    ARRAY['tiktok_integration_conversions_integration_id_event_name_conver', 'tiktok_integration_conversions_integration_id_event_name_co_key'],
    ARRAY['tiktok_integration_conversions_integration_id_event_name_messag', 'tiktok_integration_conversions_integration_id_event_name_me_key'],
    ARRAY['tiktok_integration_conversions_integration_id_event_name_order_', 'tiktok_integration_conversions_integration_id_event_name_or_key'],
    ARRAY['tiktok_integration_conversions_integration_id_event_name_sent_a', 'tiktok_integration_conversions_integration_id_event_name_se_idx'],
    ARRAY['tiktok_integration_conversions_integration_id_whatsapp_phone_se', 'tiktok_integration_conversions_integration_id_whatsapp_phon_idx']
  ];
BEGIN
  FOREACH pair SLICE 1 IN ARRAY renames LOOP
    IF EXISTS (SELECT 1 FROM pg_class WHERE relname = pair[1] AND relkind = 'i')
       AND NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = pair[2]) THEN
      EXECUTE format('ALTER INDEX %I RENAME TO %I', pair[1], pair[2]);
    END IF;
  END LOOP;
END $$;
