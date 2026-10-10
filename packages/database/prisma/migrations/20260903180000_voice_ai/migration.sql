CREATE TABLE IF NOT EXISTS "voice_agents" (
    "id" TEXT NOT NULL,
    "team_id" TEXT,
    "name" TEXT NOT NULL DEFAULT 'Chatloora Voice',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "language" TEXT NOT NULL DEFAULT 'ar-AE',
    "voice_name" TEXT NOT NULL DEFAULT 'Polly.Zeina',
    "greeting" TEXT NOT NULL,
    "unclear_message" TEXT NOT NULL,
    "hold_message" TEXT NOT NULL,
    "handoff_message" TEXT NOT NULL,
    "max_duration_sec" INTEGER NOT NULL DEFAULT 600,
    "recording_enabled" BOOLEAN NOT NULL DEFAULT false,
    "transcript_enabled" BOOLEAN NOT NULL DEFAULT true,
    "summary_enabled" BOOLEAN NOT NULL DEFAULT true,
    "minutes_limit" INTEGER NOT NULL DEFAULT -1,
    "minutes_used" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "voice_agents_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "voice_agents_team_id_idx" ON "voice_agents"("team_id");

CREATE TABLE IF NOT EXISTS "voice_phone_numbers" (
    "id" TEXT NOT NULL,
    "team_id" TEXT,
    "agent_id" TEXT NOT NULL,
    "e164" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'twilio',
    "twilio_sid" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "voice_phone_numbers_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "voice_phone_numbers_e164_key" ON "voice_phone_numbers"("e164");
CREATE INDEX IF NOT EXISTS "voice_phone_numbers_team_id_idx" ON "voice_phone_numbers"("team_id");

CREATE TABLE IF NOT EXISTS "voice_calls" (
    "id" TEXT NOT NULL,
    "team_id" TEXT,
    "agent_id" TEXT NOT NULL,
    "phone_number_id" TEXT,
    "provider_call_sid" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "caller_e164" TEXT NOT NULL,
    "called_e164" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ringing',
    "handled_by" TEXT NOT NULL DEFAULT 'AI',
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMP(3),
    "duration_sec" INTEGER,
    "outcome" TEXT,
    "recording_url" TEXT,
    "cost_cents" INTEGER,
    "summary" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "voice_calls_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "voice_calls_provider_call_sid_key" ON "voice_calls"("provider_call_sid");
CREATE INDEX IF NOT EXISTS "voice_calls_team_id_started_at_idx" ON "voice_calls"("team_id", "started_at");
CREATE INDEX IF NOT EXISTS "voice_calls_status_started_at_idx" ON "voice_calls"("status", "started_at");

CREATE TABLE IF NOT EXISTS "voice_transcript_turns" (
    "id" TEXT NOT NULL,
    "call_id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "voice_transcript_turns_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "voice_transcript_turns_call_id_created_at_idx" ON "voice_transcript_turns"("call_id", "created_at");

ALTER TABLE "voice_agents"
  DROP CONSTRAINT IF EXISTS "voice_agents_team_id_fkey",
  ADD CONSTRAINT "voice_agents_team_id_fkey"
  FOREIGN KEY ("team_id") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "voice_phone_numbers"
  DROP CONSTRAINT IF EXISTS "voice_phone_numbers_team_id_fkey",
  ADD CONSTRAINT "voice_phone_numbers_team_id_fkey"
  FOREIGN KEY ("team_id") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "voice_phone_numbers"
  DROP CONSTRAINT IF EXISTS "voice_phone_numbers_agent_id_fkey",
  ADD CONSTRAINT "voice_phone_numbers_agent_id_fkey"
  FOREIGN KEY ("agent_id") REFERENCES "voice_agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "voice_calls"
  DROP CONSTRAINT IF EXISTS "voice_calls_team_id_fkey",
  ADD CONSTRAINT "voice_calls_team_id_fkey"
  FOREIGN KEY ("team_id") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "voice_calls"
  DROP CONSTRAINT IF EXISTS "voice_calls_agent_id_fkey",
  ADD CONSTRAINT "voice_calls_agent_id_fkey"
  FOREIGN KEY ("agent_id") REFERENCES "voice_agents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "voice_calls"
  DROP CONSTRAINT IF EXISTS "voice_calls_phone_number_id_fkey",
  ADD CONSTRAINT "voice_calls_phone_number_id_fkey"
  FOREIGN KEY ("phone_number_id") REFERENCES "voice_phone_numbers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "voice_transcript_turns"
  DROP CONSTRAINT IF EXISTS "voice_transcript_turns_call_id_fkey",
  ADD CONSTRAINT "voice_transcript_turns_call_id_fkey"
  FOREIGN KEY ("call_id") REFERENCES "voice_calls"("id") ON DELETE CASCADE ON UPDATE CASCADE;
