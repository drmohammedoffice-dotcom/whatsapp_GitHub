-- AlterTable
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "position" INTEGER NOT NULL DEFAULT 0;

-- Backfill positions from newest-first catalog order (existing UX)
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY "teamId" ORDER BY "createdAt" DESC) - 1 AS pos
  FROM "Product"
)
UPDATE "Product" p
SET "position" = ranked.pos
FROM ranked
WHERE p.id = ranked.id;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Product_teamId_position_idx" ON "Product"("teamId", "position");
