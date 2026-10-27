ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "items" JSONB;

CREATE TABLE "StoreBanner" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT,
    "title" TEXT,
    "subtitle" TEXT,
    "linkUrl" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoreBanner_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "StoreBanner_teamId_position_idx" ON "StoreBanner"("teamId", "position");
ALTER TABLE "StoreBanner" ADD CONSTRAINT "StoreBanner_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
