CREATE TABLE IF NOT EXISTS "landing_offers" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "title_ar" TEXT,
  "description" TEXT,
  "description_ar" TEXT,
  "badge_text" TEXT,
  "badge_text_ar" TEXT,
  "cta_label" TEXT,
  "cta_label_ar" TEXT,
  "cta_url" TEXT,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "starts_at" TIMESTAMP(3),
  "ends_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "landing_offers_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "landing_offers_is_active_sort_order_idx"
  ON "landing_offers"("is_active", "sort_order");
