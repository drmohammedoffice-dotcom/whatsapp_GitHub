-- Per-tenant TikTok Developer app credentials (encrypted)

CREATE TABLE "TikTokAppCredentials" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "encryptedClientKey" TEXT NOT NULL,
    "encryptedClientSecret" TEXT NOT NULL,
    "redirectUri" TEXT,
    "clientKeyHint" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TikTokAppCredentials_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TikTokAppCredentials_teamId_key" ON "TikTokAppCredentials"("teamId");
CREATE INDEX "TikTokAppCredentials_teamId_idx" ON "TikTokAppCredentials"("teamId");

ALTER TABLE "TikTokAppCredentials" ADD CONSTRAINT "TikTokAppCredentials_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
