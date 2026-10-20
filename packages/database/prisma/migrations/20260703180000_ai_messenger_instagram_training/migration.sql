-- Split Meta AI training into Messenger (Facebook) and Instagram
ALTER TYPE "AiTrainingPlatform" ADD VALUE IF NOT EXISTS 'MESSENGER';
ALTER TYPE "AiTrainingPlatform" ADD VALUE IF NOT EXISTS 'INSTAGRAM';

-- Duplicate META workspace settings to INSTAGRAM, then rename META -> MESSENGER
INSERT INTO "AiSettings" (
  "id",
  "teamId",
  "platform",
  "enabled",
  "autoReplyEnabled",
  "confidenceThreshold",
  "greetingMessage",
  "outOfOfficeMessage",
  "businessHours",
  "holidayReplies",
  "transferOnLowConfidence",
  "transferOnComplaint",
  "transferOnRefund",
  "transferOnSensitive",
  "transferOnHumanRequest",
  "customTransferRules",
  "pauseAiOnHumanReply",
  "pauseAiOnAssignment",
  "monthlyBudgetCents",
  "systemPromptOverride",
  "createdAt",
  "updatedAt"
)
SELECT
  'cm' || substr(md5(random()::text || s."teamId" || 'instagram'), 1, 23),
  s."teamId",
  'INSTAGRAM'::"AiTrainingPlatform",
  s."enabled",
  s."autoReplyEnabled",
  s."confidenceThreshold",
  s."greetingMessage",
  s."outOfOfficeMessage",
  s."businessHours",
  s."holidayReplies",
  s."transferOnLowConfidence",
  s."transferOnComplaint",
  s."transferOnRefund",
  s."transferOnSensitive",
  s."transferOnHumanRequest",
  s."customTransferRules",
  s."pauseAiOnHumanReply",
  s."pauseAiOnAssignment",
  s."monthlyBudgetCents",
  s."systemPromptOverride",
  NOW(),
  NOW()
FROM "AiSettings" s
WHERE s.platform = 'META'
  AND NOT EXISTS (
    SELECT 1 FROM "AiSettings" i
    WHERE i."teamId" = s."teamId" AND i.platform = 'INSTAGRAM'
  );

UPDATE "AiSettings" SET platform = 'MESSENGER' WHERE platform = 'META';

-- Duplicate META training media to INSTAGRAM, then rename META -> MESSENGER
INSERT INTO "AiTrainingMedia" (
  "id",
  "teamId",
  "platform",
  "title",
  "productName",
  "description",
  "mediaType",
  "storageKey",
  "mimeType",
  "fileName",
  "sizeBytes",
  "tags",
  "createdAt",
  "updatedAt"
)
SELECT
  'cm' || substr(md5(random()::text || m."id" || 'instagram'), 1, 23),
  m."teamId",
  'INSTAGRAM'::"AiTrainingPlatform",
  m."title",
  m."productName",
  m."description",
  m."mediaType",
  m."storageKey",
  m."mimeType",
  m."fileName",
  m."sizeBytes",
  m.tags,
  m."createdAt",
  m."updatedAt"
FROM "AiTrainingMedia" m
WHERE m.platform = 'META';

UPDATE "AiTrainingMedia" SET platform = 'MESSENGER' WHERE platform = 'META';

-- Rename legacy training knowledge doc title
UPDATE "AiKnowledgeDocument"
SET title = '__ai_training_instructions__MESSENGER'
WHERE title = '__ai_training_instructions__META';
