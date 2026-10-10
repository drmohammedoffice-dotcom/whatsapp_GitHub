ALTER TABLE "tiktok_integrations"
ADD COLUMN "redirect_destination_type" TEXT NOT NULL DEFAULT 'WHATSAPP_NUMBER',
ADD COLUMN "external_redirect_url" TEXT;
