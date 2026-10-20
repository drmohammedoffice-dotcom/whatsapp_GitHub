-- AlterTable
ALTER TABLE "StoreSettings" ADD COLUMN IF NOT EXISTS "promoEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "StoreSettings" ADD COLUMN IF NOT EXISTS "promoEndsAt" TIMESTAMP(3);
ALTER TABLE "StoreSettings" ADD COLUMN IF NOT EXISTS "promoText" TEXT;
ALTER TABLE "StoreSettings" ADD COLUMN IF NOT EXISTS "themeKey" TEXT NOT NULL DEFAULT 'emerald';
ALTER TABLE "StoreSettings" ADD COLUMN IF NOT EXISTS "themeColors" JSONB;

-- CreateTable
CREATE TABLE "StoreCategory" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "imageStorageKey" TEXT,
    "imageMimeType" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoreCategory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StoreTheme" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "colors" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoreTheme_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "categoryId" TEXT;

CREATE INDEX "StoreCategory_teamId_position_idx" ON "StoreCategory"("teamId", "position");
CREATE INDEX "StoreTheme_teamId_createdAt_idx" ON "StoreTheme"("teamId", "createdAt");
CREATE INDEX "Product_categoryId_idx" ON "Product"("categoryId");

ALTER TABLE "StoreCategory" ADD CONSTRAINT "StoreCategory_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StoreTheme" ADD CONSTRAINT "StoreTheme_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Product" ADD CONSTRAINT "Product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "StoreCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
