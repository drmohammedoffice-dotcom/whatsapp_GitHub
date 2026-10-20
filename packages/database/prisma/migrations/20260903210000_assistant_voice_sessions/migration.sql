-- In-app realtime Voice-to-Voice sessions (OpenAI Realtime / WebRTC).
-- Audio itself is not stored; transcript/summary/usage are optional metadata.

CREATE TABLE "assistant_voice_sessions" (
    "id" TEXT NOT NULL,
    "team_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "conversation_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'created',
    "provider" TEXT NOT NULL DEFAULT 'openai',
    "model" TEXT NOT NULL,
    "voice" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'ar',
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMP(3),
    "duration_sec" INTEGER,
    "transcript" JSONB,
    "summary" TEXT,
    "usage" JSONB,
    "cost_millis" INTEGER,
    "handoff_requested" BOOLEAN NOT NULL DEFAULT false,
    "failure_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assistant_voice_sessions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "assistant_voice_sessions_team_id_started_at_idx" ON "assistant_voice_sessions"("team_id", "started_at");
CREATE INDEX "assistant_voice_sessions_user_id_started_at_idx" ON "assistant_voice_sessions"("user_id", "started_at");
CREATE INDEX "assistant_voice_sessions_status_started_at_idx" ON "assistant_voice_sessions"("status", "started_at");

ALTER TABLE "assistant_voice_sessions" ADD CONSTRAINT "assistant_voice_sessions_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "assistant_voice_sessions" ADD CONSTRAINT "assistant_voice_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "assistant_voice_sessions" ADD CONSTRAINT "assistant_voice_sessions_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "platform_assistant_conversations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
