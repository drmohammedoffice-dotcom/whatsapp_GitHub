-- CreateTable
CREATE TABLE IF NOT EXISTS "platform_assistant_articles" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "title_ar" TEXT NOT NULL,
    "title_en" TEXT NOT NULL,
    "body_ar" TEXT NOT NULL,
    "body_en" TEXT NOT NULL,
    "keywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_builtin" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_assistant_articles_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "platform_assistant_articles_slug_key" ON "platform_assistant_articles"("slug");
CREATE INDEX IF NOT EXISTS "platform_assistant_articles_category_is_active_idx" ON "platform_assistant_articles"("category", "is_active");

CREATE TABLE IF NOT EXISTS "platform_assistant_conversations" (
    "id" TEXT NOT NULL,
    "team_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "title" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_assistant_conversations_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "platform_assistant_conversations_user_id_updated_at_idx" ON "platform_assistant_conversations"("user_id", "updated_at");
CREATE INDEX IF NOT EXISTS "platform_assistant_conversations_team_id_updated_at_idx" ON "platform_assistant_conversations"("team_id", "updated_at");

CREATE TABLE IF NOT EXISTS "platform_assistant_messages" (
    "id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "helpful" BOOLEAN,
    "unanswered" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_assistant_messages_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "platform_assistant_messages_conversation_id_created_at_idx" ON "platform_assistant_messages"("conversation_id", "created_at");

ALTER TABLE "platform_assistant_conversations"
  DROP CONSTRAINT IF EXISTS "platform_assistant_conversations_team_id_fkey",
  ADD CONSTRAINT "platform_assistant_conversations_team_id_fkey"
  FOREIGN KEY ("team_id") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "platform_assistant_conversations"
  DROP CONSTRAINT IF EXISTS "platform_assistant_conversations_user_id_fkey",
  ADD CONSTRAINT "platform_assistant_conversations_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "platform_assistant_messages"
  DROP CONSTRAINT IF EXISTS "platform_assistant_messages_conversation_id_fkey",
  ADD CONSTRAINT "platform_assistant_messages_conversation_id_fkey"
  FOREIGN KEY ("conversation_id") REFERENCES "platform_assistant_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
