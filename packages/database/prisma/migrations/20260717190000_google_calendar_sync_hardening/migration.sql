-- Google Calendar production hardening: M30 reminders, working-hours knobs, two-way sync token.

DO $$ BEGIN
  ALTER TYPE "AppointmentReminderKind" ADD VALUE 'M30';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "AppointmentBusinessProfile" ADD COLUMN IF NOT EXISTS "bufferBeforeMin" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "AppointmentBusinessProfile" ADD COLUMN IF NOT EXISTS "bufferAfterMin" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "AppointmentBusinessProfile" ADD COLUMN IF NOT EXISTS "breakMin" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "AppointmentBusinessProfile" ADD COLUMN IF NOT EXISTS "maxDailyAppointments" INTEGER;

ALTER TABLE "GoogleCalendarConnection" ADD COLUMN IF NOT EXISTS "syncToken" TEXT;

ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "syncOrigin" TEXT;
