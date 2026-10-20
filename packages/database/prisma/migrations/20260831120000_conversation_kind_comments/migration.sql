-- Separate Meta page/IG DMs from public post comments in the inbox.
CREATE TYPE "ConversationKind" AS ENUM ('DIRECT_MESSAGE', 'COMMENT');

ALTER TABLE "Conversation"
  ADD COLUMN IF NOT EXISTS "kind" "ConversationKind" NOT NULL DEFAULT 'DIRECT_MESSAGE',
  ADD COLUMN IF NOT EXISTS "metadata" JSONB;

CREATE INDEX IF NOT EXISTS "Conversation_teamId_kind_lastMessageAt_idx"
  ON "Conversation"("teamId", "kind", "lastMessageAt");
