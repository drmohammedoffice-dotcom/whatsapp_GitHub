-- AlterEnum
ALTER TYPE "ChannelStatus" ADD VALUE IF NOT EXISTS 'EXPIRED';

-- CreateEnum
CREATE TYPE "OAuthSessionStatus" AS ENUM ('PENDING', 'COMPLETED', 'EXPIRED', 'FAILED');

-- CreateTable
CREATE TABLE "ChannelToken" (
    "id" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "encryptedAccessToken" TEXT NOT NULL,
    "encryptedRefreshToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scopes" TEXT,
    "lastRefreshedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChannelToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SocialOAuthSession" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "status" "OAuthSessionStatus" NOT NULL DEFAULT 'PENDING',
    "encryptedPayload" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SocialOAuthSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ChannelToken_channelId_key" ON "ChannelToken"("channelId");

-- CreateIndex
CREATE INDEX "SocialOAuthSession_teamId_provider_status_idx" ON "SocialOAuthSession"("teamId", "provider", "status");

-- CreateIndex
CREATE INDEX "SocialOAuthSession_expiresAt_idx" ON "SocialOAuthSession"("expiresAt");

-- AddForeignKey
ALTER TABLE "ChannelToken" ADD CONSTRAINT "ChannelToken_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocialOAuthSession" ADD CONSTRAINT "SocialOAuthSession_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
