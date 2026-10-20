-- AlterEnum
ALTER TYPE "ChannelProvider" ADD VALUE IF NOT EXISTS 'TELEGRAM_USER';

-- CreateEnum
CREATE TYPE "TelegramConnectionStatus" AS ENUM ('PENDING_CODE', 'PENDING_PASSWORD', 'CONNECTING', 'CONNECTED', 'DISCONNECTED', 'EXPIRED', 'FAILED');

-- AlterTable
ALTER TABLE "Channel" ADD COLUMN IF NOT EXISTS "telegramConnectionId" TEXT;

-- CreateTable
CREATE TABLE "TelegramConnection" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "connectedByUserId" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "telegramUserId" TEXT,
    "firstName" TEXT,
    "lastName" TEXT,
    "username" TEXT,
    "profilePhotoUrl" TEXT,
    "encryptedSession" TEXT,
    "status" "TelegramConnectionStatus" NOT NULL DEFAULT 'PENDING_CODE',
    "connectedAt" TIMESTAMP(3),
    "lastSyncAt" TIMESTAMP(3),
    "lastSeenAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TelegramConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TelegramAuthPending" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "encryptedTempSession" TEXT NOT NULL,
    "phoneCodeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TelegramAuthPending_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Channel_telegramConnectionId_key" ON "Channel"("telegramConnectionId");

-- CreateIndex
CREATE UNIQUE INDEX "TelegramConnection_teamId_phoneNumber_key" ON "TelegramConnection"("teamId", "phoneNumber");

-- CreateIndex
CREATE INDEX "TelegramConnection_teamId_status_idx" ON "TelegramConnection"("teamId", "status");

-- CreateIndex
CREATE INDEX "TelegramAuthPending_teamId_userId_idx" ON "TelegramAuthPending"("teamId", "userId");

-- CreateIndex
CREATE INDEX "TelegramAuthPending_expiresAt_idx" ON "TelegramAuthPending"("expiresAt");

-- AddForeignKey
ALTER TABLE "Channel" ADD CONSTRAINT "Channel_telegramConnectionId_fkey" FOREIGN KEY ("telegramConnectionId") REFERENCES "TelegramConnection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TelegramConnection" ADD CONSTRAINT "TelegramConnection_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
