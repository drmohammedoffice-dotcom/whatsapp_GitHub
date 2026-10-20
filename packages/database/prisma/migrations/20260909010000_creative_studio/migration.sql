-- Creative Studio foundation (no destructive changes)

CREATE TYPE "CreativeProjectStatus" AS ENUM ('DRAFT', 'ANALYZING', 'GENERATING', 'COMPLETED', 'FAILED');
CREATE TYPE "CreativeContentKind" AS ENUM ('PRODUCT_IMAGE', 'PRODUCT_MODEL', 'LIFESTYLE', 'SOCIAL_AD', 'UGC_VIDEO', 'COMMERCIAL', 'TALKING_MODEL', 'CINEMATIC');
CREATE TYPE "CreativeJobType" AS ENUM ('PROBE', 'TEXT', 'IMAGE', 'VIDEO', 'TTS', 'LIPSYNC', 'UPSCALE', 'COMPOSE', 'EDIT');
CREATE TYPE "CreativeJobStatus" AS ENUM ('QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELLED');
CREATE TYPE "CreativeAssetKind" AS ENUM ('PRODUCT_PHOTO', 'GENERATED_IMAGE', 'VIDEO', 'AUDIO', 'MUSIC', 'CAPTION');

CREATE TABLE "CreativeProject" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "CreativeProjectStatus" NOT NULL DEFAULT 'DRAFT',
    "contentKind" "CreativeContentKind",
    "aspectRatio" TEXT,
    "durationSec" INTEGER,
    "locale" TEXT NOT NULL DEFAULT 'ar-IQ',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CreativeProject_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CreativeProductProfile" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price" DOUBLE PRECISION,
    "currency" TEXT,
    "ingredients" TEXT,
    "benefits" TEXT,
    "usage" TEXT,
    "targetAudience" TEXT,
    "extra" TEXT,
    "intelligence" JSONB,
    "analyzedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CreativeProductProfile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CreativeProductAsset" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileName" TEXT,
    "sizeBytes" INTEGER,
    "checksum" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "position" INTEGER NOT NULL DEFAULT 0,
    "isMain" BOOLEAN NOT NULL DEFAULT false,
    "kind" TEXT NOT NULL DEFAULT 'PRODUCT_PHOTO',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CreativeProductAsset_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CreativeVoiceProfile" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "gender" TEXT,
    "age" TEXT,
    "style" TEXT,
    "language" TEXT NOT NULL DEFAULT 'ar-IQ',
    "provider" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CreativeVoiceProfile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CreativeModelProfile" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "gender" TEXT,
    "ageRange" TEXT,
    "skinTone" TEXT,
    "hair" TEXT,
    "hairStyle" TEXT,
    "eyeColor" TEXT,
    "bodyType" TEXT,
    "persona" TEXT,
    "personality" TEXT,
    "clothing" TEXT,
    "clothingCustom" TEXT,
    "appearance" TEXT,
    "faceStorageKey" TEXT,
    "voiceProfileId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CreativeModelProfile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CreativeScript" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'ar-IQ',
    "tone" TEXT,
    "durationSec" INTEGER,
    "hook" TEXT,
    "body" TEXT,
    "cta" TEXT,
    "rawText" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CreativeScript_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CreativeScriptScene" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "scriptId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "startSec" DOUBLE PRECISION,
    "endSec" DOUBLE PRECISION,
    "visual" TEXT,
    "voiceover" TEXT,
    "camera" TEXT,
    "lighting" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CreativeScriptScene_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CreativeGenerationJob" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "type" "CreativeJobType" NOT NULL,
    "status" "CreativeJobStatus" NOT NULL DEFAULT 'QUEUED',
    "provider" TEXT NOT NULL,
    "model" TEXT,
    "idempotencyKey" TEXT,
    "payload" JSONB,
    "result" JSONB,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "providerJobId" TEXT,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CreativeGenerationJob_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CreativeGenerationAsset" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "kind" "CreativeAssetKind" NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER,
    "checksum" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "durationSec" DOUBLE PRECISION,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CreativeGenerationAsset_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CreativeVideoVersion" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "jobId" TEXT,
    "assetId" TEXT,
    "version" INTEGER NOT NULL,
    "label" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CreativeVideoVersion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CreativeEditRequest" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "jobId" TEXT,
    "instruction" TEXT NOT NULL,
    "parsedPlan" JSONB,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CreativeEditRequest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CreativeMusicTrack" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "style" TEXT,
    "licenseSource" TEXT,
    "licenseNote" TEXT,
    "storageKey" TEXT,
    "mimeType" TEXT,
    "durationSec" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CreativeMusicTrack_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CreativeUsageRecord" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "jobId" TEXT,
    "provider" TEXT NOT NULL,
    "model" TEXT,
    "operation" TEXT NOT NULL,
    "durationSec" DOUBLE PRECISION,
    "resolution" TEXT,
    "estimatedCost" DOUBLE PRECISION,
    "actualCost" DOUBLE PRECISION,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CreativeUsageRecord_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CreativeQualityCheck" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "passed" BOOLEAN NOT NULL,
    "score" DOUBLE PRECISION,
    "findings" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CreativeQualityCheck_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CreativeProductProfile_projectId_key" ON "CreativeProductProfile"("projectId");
CREATE UNIQUE INDEX "CreativeGenerationJob_teamId_idempotencyKey_key" ON "CreativeGenerationJob"("teamId", "idempotencyKey");
CREATE UNIQUE INDEX "CreativeVideoVersion_projectId_version_key" ON "CreativeVideoVersion"("projectId", "version");
CREATE INDEX "CreativeProject_teamId_updatedAt_idx" ON "CreativeProject"("teamId", "updatedAt");
CREATE INDEX "CreativeProject_userId_createdAt_idx" ON "CreativeProject"("userId", "createdAt");
CREATE INDEX "CreativeProductProfile_teamId_idx" ON "CreativeProductProfile"("teamId");
CREATE INDEX "CreativeProductAsset_teamId_projectId_position_idx" ON "CreativeProductAsset"("teamId", "projectId", "position");
CREATE INDEX "CreativeModelProfile_teamId_createdAt_idx" ON "CreativeModelProfile"("teamId", "createdAt");
CREATE INDEX "CreativeScript_teamId_projectId_idx" ON "CreativeScript"("teamId", "projectId");
CREATE INDEX "CreativeScriptScene_scriptId_position_idx" ON "CreativeScriptScene"("scriptId", "position");
CREATE INDEX "CreativeGenerationJob_teamId_status_createdAt_idx" ON "CreativeGenerationJob"("teamId", "status", "createdAt");
CREATE INDEX "CreativeGenerationJob_projectId_createdAt_idx" ON "CreativeGenerationJob"("projectId", "createdAt");
CREATE INDEX "CreativeGenerationAsset_teamId_jobId_idx" ON "CreativeGenerationAsset"("teamId", "jobId");
CREATE INDEX "CreativeVideoVersion_teamId_projectId_idx" ON "CreativeVideoVersion"("teamId", "projectId");
CREATE INDEX "CreativeEditRequest_teamId_projectId_idx" ON "CreativeEditRequest"("teamId", "projectId");
CREATE INDEX "CreativeVoiceProfile_teamId_createdAt_idx" ON "CreativeVoiceProfile"("teamId", "createdAt");
CREATE INDEX "CreativeMusicTrack_teamId_createdAt_idx" ON "CreativeMusicTrack"("teamId", "createdAt");
CREATE INDEX "CreativeUsageRecord_teamId_createdAt_idx" ON "CreativeUsageRecord"("teamId", "createdAt");
CREATE INDEX "CreativeUsageRecord_jobId_idx" ON "CreativeUsageRecord"("jobId");
CREATE INDEX "CreativeQualityCheck_teamId_jobId_idx" ON "CreativeQualityCheck"("teamId", "jobId");

ALTER TABLE "CreativeProject" ADD CONSTRAINT "CreativeProject_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CreativeProject" ADD CONSTRAINT "CreativeProject_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CreativeProductProfile" ADD CONSTRAINT "CreativeProductProfile_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "CreativeProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CreativeProductProfile" ADD CONSTRAINT "CreativeProductProfile_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CreativeProductProfile" ADD CONSTRAINT "CreativeProductProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CreativeProductAsset" ADD CONSTRAINT "CreativeProductAsset_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "CreativeProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CreativeProductAsset" ADD CONSTRAINT "CreativeProductAsset_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CreativeProductAsset" ADD CONSTRAINT "CreativeProductAsset_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CreativeVoiceProfile" ADD CONSTRAINT "CreativeVoiceProfile_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CreativeVoiceProfile" ADD CONSTRAINT "CreativeVoiceProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CreativeModelProfile" ADD CONSTRAINT "CreativeModelProfile_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CreativeModelProfile" ADD CONSTRAINT "CreativeModelProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CreativeModelProfile" ADD CONSTRAINT "CreativeModelProfile_voiceProfileId_fkey" FOREIGN KEY ("voiceProfileId") REFERENCES "CreativeVoiceProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CreativeScript" ADD CONSTRAINT "CreativeScript_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "CreativeProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CreativeScript" ADD CONSTRAINT "CreativeScript_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CreativeScript" ADD CONSTRAINT "CreativeScript_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CreativeScriptScene" ADD CONSTRAINT "CreativeScriptScene_scriptId_fkey" FOREIGN KEY ("scriptId") REFERENCES "CreativeScript"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CreativeScriptScene" ADD CONSTRAINT "CreativeScriptScene_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CreativeScriptScene" ADD CONSTRAINT "CreativeScriptScene_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CreativeGenerationJob" ADD CONSTRAINT "CreativeGenerationJob_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "CreativeProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CreativeGenerationJob" ADD CONSTRAINT "CreativeGenerationJob_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CreativeGenerationJob" ADD CONSTRAINT "CreativeGenerationJob_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CreativeGenerationAsset" ADD CONSTRAINT "CreativeGenerationAsset_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "CreativeGenerationJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CreativeGenerationAsset" ADD CONSTRAINT "CreativeGenerationAsset_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CreativeGenerationAsset" ADD CONSTRAINT "CreativeGenerationAsset_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CreativeVideoVersion" ADD CONSTRAINT "CreativeVideoVersion_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "CreativeProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CreativeVideoVersion" ADD CONSTRAINT "CreativeVideoVersion_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "CreativeGenerationJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CreativeVideoVersion" ADD CONSTRAINT "CreativeVideoVersion_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "CreativeGenerationAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CreativeVideoVersion" ADD CONSTRAINT "CreativeVideoVersion_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CreativeVideoVersion" ADD CONSTRAINT "CreativeVideoVersion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CreativeEditRequest" ADD CONSTRAINT "CreativeEditRequest_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "CreativeProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CreativeEditRequest" ADD CONSTRAINT "CreativeEditRequest_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "CreativeGenerationJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CreativeEditRequest" ADD CONSTRAINT "CreativeEditRequest_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CreativeEditRequest" ADD CONSTRAINT "CreativeEditRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CreativeMusicTrack" ADD CONSTRAINT "CreativeMusicTrack_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CreativeMusicTrack" ADD CONSTRAINT "CreativeMusicTrack_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CreativeUsageRecord" ADD CONSTRAINT "CreativeUsageRecord_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "CreativeGenerationJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CreativeUsageRecord" ADD CONSTRAINT "CreativeUsageRecord_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CreativeUsageRecord" ADD CONSTRAINT "CreativeUsageRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CreativeQualityCheck" ADD CONSTRAINT "CreativeQualityCheck_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "CreativeGenerationJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CreativeQualityCheck" ADD CONSTRAINT "CreativeQualityCheck_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CreativeQualityCheck" ADD CONSTRAINT "CreativeQualityCheck_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
