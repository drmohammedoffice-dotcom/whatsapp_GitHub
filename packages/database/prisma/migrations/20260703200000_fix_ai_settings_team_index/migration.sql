-- Remove legacy unique index that blocks per-platform AiSettings rows
DROP INDEX IF EXISTS "AiSettings_teamId_key";
