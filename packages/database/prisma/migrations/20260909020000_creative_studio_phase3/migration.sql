-- Phase 3: Product Intelligence + real media generation (additive)

ALTER TYPE "CreativeJobStatus" ADD VALUE IF NOT EXISTS 'PROVIDER_SUBMITTED';
ALTER TYPE "CreativeJobStatus" ADD VALUE IF NOT EXISTS 'POLLING';
ALTER TYPE "CreativeJobStatus" ADD VALUE IF NOT EXISTS 'DOWNLOADING';
ALTER TYPE "CreativeJobStatus" ADD VALUE IF NOT EXISTS 'STORING';
ALTER TYPE "CreativeJobStatus" ADD VALUE IF NOT EXISTS 'QUALITY_CHECK';

ALTER TABLE "CreativeProductProfile" ADD COLUMN IF NOT EXISTS "category" TEXT;
ALTER TABLE "CreativeProductProfile" ADD COLUMN IF NOT EXISTS "brand" TEXT;
ALTER TABLE "CreativeProductProfile" ADD COLUMN IF NOT EXISTS "userClaims" TEXT;

ALTER TABLE "CreativeModelProfile" ADD COLUMN IF NOT EXISTS "expression" TEXT;
ALTER TABLE "CreativeModelProfile" ADD COLUMN IF NOT EXISTS "pose" TEXT;
ALTER TABLE "CreativeModelProfile" ADD COLUMN IF NOT EXISTS "profession" TEXT;
ALTER TABLE "CreativeModelProfile" ADD COLUMN IF NOT EXISTS "visualIdentity" TEXT;
ALTER TABLE "CreativeModelProfile" ADD COLUMN IF NOT EXISTS "environment" TEXT;

ALTER TABLE "CreativeGenerationAsset" ADD COLUMN IF NOT EXISTS "projectId" TEXT;
ALTER TABLE "CreativeGenerationAsset" ADD COLUMN IF NOT EXISTS "provider" TEXT;
ALTER TABLE "CreativeGenerationAsset" ADD COLUMN IF NOT EXISTS "model" TEXT;
ALTER TABLE "CreativeGenerationAsset" ADD COLUMN IF NOT EXISTS "requestedResolution" TEXT;
ALTER TABLE "CreativeGenerationAsset" ADD COLUMN IF NOT EXISTS "actualResolution" TEXT;
ALTER TABLE "CreativeGenerationAsset" ADD COLUMN IF NOT EXISTS "resolutionType" TEXT;

ALTER TABLE "CreativeUsageRecord" ADD COLUMN IF NOT EXISTS "costStatus" TEXT NOT NULL DEFAULT 'UNKNOWN';
ALTER TABLE "CreativeUsageRecord" ADD COLUMN IF NOT EXISTS "currency" TEXT;
ALTER TABLE "CreativeUsageRecord" ADD COLUMN IF NOT EXISTS "mediaType" TEXT;

ALTER TABLE "CreativeQualityCheck" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'COMPLETED';

CREATE TABLE IF NOT EXISTS "CreativeBrief" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "objective" TEXT,
    "audience" TEXT,
    "platform" TEXT,
    "aspectRatio" TEXT,
    "visualStyle" TEXT,
    "environment" TEXT,
    "lighting" TEXT,
    "cameraStyle" TEXT,
    "modelRequirements" TEXT,
    "productPlacement" TEXT,
    "messaging" TEXT,
    "restrictions" TEXT,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CreativeBrief_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CreativeConcept" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "selected" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL DEFAULT 0,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CreativeConcept_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CreativeBrief_projectId_key" ON "CreativeBrief"("projectId");
CREATE INDEX IF NOT EXISTS "CreativeBrief_teamId_idx" ON "CreativeBrief"("teamId");
CREATE INDEX IF NOT EXISTS "CreativeConcept_teamId_projectId_position_idx" ON "CreativeConcept"("teamId", "projectId", "position");

ALTER TABLE "CreativeBrief" DROP CONSTRAINT IF EXISTS "CreativeBrief_projectId_fkey";
ALTER TABLE "CreativeBrief" ADD CONSTRAINT "CreativeBrief_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "CreativeProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CreativeBrief" DROP CONSTRAINT IF EXISTS "CreativeBrief_teamId_fkey";
ALTER TABLE "CreativeBrief" ADD CONSTRAINT "CreativeBrief_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CreativeBrief" DROP CONSTRAINT IF EXISTS "CreativeBrief_userId_fkey";
ALTER TABLE "CreativeBrief" ADD CONSTRAINT "CreativeBrief_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CreativeConcept" DROP CONSTRAINT IF EXISTS "CreativeConcept_projectId_fkey";
ALTER TABLE "CreativeConcept" ADD CONSTRAINT "CreativeConcept_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "CreativeProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CreativeConcept" DROP CONSTRAINT IF EXISTS "CreativeConcept_teamId_fkey";
ALTER TABLE "CreativeConcept" ADD CONSTRAINT "CreativeConcept_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CreativeConcept" DROP CONSTRAINT IF EXISTS "CreativeConcept_userId_fkey";
ALTER TABLE "CreativeConcept" ADD CONSTRAINT "CreativeConcept_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
