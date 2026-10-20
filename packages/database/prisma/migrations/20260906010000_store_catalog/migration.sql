-- CreateEnum
CREATE TYPE "ProductMediaKind" AS ENUM ('IMAGE', 'VIDEO');

-- CreateTable
CREATE TABLE "StoreSettings" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "brandName" TEXT NOT NULL,
    "logoStorageKey" TEXT,
    "logoMimeType" TEXT,
    "deliveryMode" TEXT NOT NULL DEFAULT 'FIXED',
    "deliveryFee" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "deliveryRates" JSONB,
    "giftWhatsappPhone" TEXT,
    "defaultLocale" TEXT NOT NULL DEFAULT 'ar',
    "currency" TEXT NOT NULL DEFAULT 'IQD',
    "isPublished" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoreSettings_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "unitPrice" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "quantity" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "outOfStockManual" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Product" ALTER COLUMN "currency" SET DEFAULT 'IQD';

UPDATE "Product" SET "unitPrice" = COALESCE("priceCents", 0) WHERE "unitPrice" = 0 AND "priceCents" IS NOT NULL;

-- AlterTable
ALTER TABLE "ProductImage" ADD COLUMN IF NOT EXISTS "kind" "ProductMediaKind" NOT NULL DEFAULT 'IMAGE';
ALTER TABLE "ProductImage" ADD COLUMN IF NOT EXISTS "mimeType" TEXT;
ALTER TABLE "ProductImage" ADD COLUMN IF NOT EXISTS "fileName" TEXT;

-- CreateTable
CREATE TABLE "ProductStockMovement" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "bookingId" TEXT,
    "delta" INTEGER NOT NULL,
    "quantityAfter" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductStockMovement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StoreSettings_teamId_key" ON "StoreSettings"("teamId");
CREATE UNIQUE INDEX "StoreSettings_slug_key" ON "StoreSettings"("slug");
CREATE INDEX "StoreSettings_slug_idx" ON "StoreSettings"("slug");
CREATE INDEX "ProductStockMovement_teamId_createdAt_idx" ON "ProductStockMovement"("teamId", "createdAt");
CREATE INDEX "ProductStockMovement_productId_createdAt_idx" ON "ProductStockMovement"("productId", "createdAt");
CREATE INDEX "ProductStockMovement_bookingId_idx" ON "ProductStockMovement"("bookingId");

-- AddForeignKey
ALTER TABLE "StoreSettings" ADD CONSTRAINT "StoreSettings_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductStockMovement" ADD CONSTRAINT "ProductStockMovement_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductStockMovement" ADD CONSTRAINT "ProductStockMovement_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductStockMovement" ADD CONSTRAINT "ProductStockMovement_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;
