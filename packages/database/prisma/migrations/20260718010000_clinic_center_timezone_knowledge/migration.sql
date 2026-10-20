ALTER TABLE "AppointmentBusinessProfile"
ADD COLUMN "clinicKnowledge" JSONB;

ALTER TABLE "GoogleCalendarConnection"
ADD COLUMN "calendarTimeZone" TEXT;
