-- AlterTable
ALTER TABLE "StoreCategory" ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "StoreCategory_teamId_isActive_idx" ON "StoreCategory"("teamId", "isActive");
