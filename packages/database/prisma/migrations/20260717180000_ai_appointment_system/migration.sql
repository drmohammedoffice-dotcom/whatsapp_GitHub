-- AlterEnum Permission
ALTER TYPE "Permission" ADD VALUE 'APPOINTMENT_READ';
ALTER TYPE "Permission" ADD VALUE 'APPOINTMENT_MANAGE';
ALTER TYPE "Permission" ADD VALUE 'APPOINTMENT_CALENDAR';
ALTER TYPE "Permission" ADD VALUE 'APPOINTMENT_REMINDERS';

-- CreateEnum
CREATE TYPE "AppointmentVertical" AS ENUM ('GENERIC', 'CLINIC', 'SALON', 'WORKSHOP', 'OFFICE');
CREATE TYPE "AppointmentStatus" AS ENUM ('PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED', 'NO_SHOW', 'RESCHEDULED');
CREATE TYPE "AppointmentSource" AS ENUM ('AI', 'HUMAN', 'API');
CREATE TYPE "AppointmentReminderKind" AS ENUM ('H24', 'H2');
CREATE TYPE "AppointmentReminderStatus" AS ENUM ('SCHEDULED', 'SENT', 'FAILED', 'CANCELLED', 'SKIPPED');
CREATE TYPE "GoogleCalendarConnectionStatus" AS ENUM ('DISCONNECTED', 'CONNECTING', 'CONNECTED', 'EXPIRED', 'FAILED');

-- CreateTable
CREATE TABLE "AppointmentBusinessProfile" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "vertical" "AppointmentVertical" NOT NULL DEFAULT 'CLINIC',
    "orgName" TEXT,
    "description" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Baghdad',
    "defaultDurationMin" INTEGER NOT NULL DEFAULT 30,
    "bufferMin" INTEGER NOT NULL DEFAULT 0,
    "bookingWindowDays" INTEGER NOT NULL DEFAULT 30,
    "instructions" TEXT,
    "faqJson" JSONB,
    "businessHours" JSONB,
    "aiCanReply" BOOLEAN NOT NULL DEFAULT true,
    "aiCanCreate" BOOLEAN NOT NULL DEFAULT true,
    "aiCanUpdate" BOOLEAN NOT NULL DEFAULT true,
    "aiCanCancel" BOOLEAN NOT NULL DEFAULT true,
    "aiCanReadCalendar" BOOLEAN NOT NULL DEFAULT true,
    "aiCanSendReminders" BOOLEAN NOT NULL DEFAULT true,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppointmentBusinessProfile_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AppointmentBusinessProfile_teamId_key" ON "AppointmentBusinessProfile"("teamId");

CREATE TABLE "AppointmentStaff" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "title" TEXT,
    "specialty" TEXT,
    "bio" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppointmentStaff_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AppointmentStaff_teamId_isActive_sortOrder_idx" ON "AppointmentStaff"("teamId", "isActive", "sortOrder");
CREATE INDEX "AppointmentStaff_profileId_idx" ON "AppointmentStaff"("profileId");

CREATE TABLE "AppointmentServiceOffer" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "staffId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "durationMin" INTEGER NOT NULL DEFAULT 30,
    "priceCents" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'IQD',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppointmentServiceOffer_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AppointmentServiceOffer_teamId_isActive_sortOrder_idx" ON "AppointmentServiceOffer"("teamId", "isActive", "sortOrder");
CREATE INDEX "AppointmentServiceOffer_profileId_idx" ON "AppointmentServiceOffer"("profileId");
CREATE INDEX "AppointmentServiceOffer_staffId_idx" ON "AppointmentServiceOffer"("staffId");

CREATE TABLE "GoogleCalendarConnection" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "status" "GoogleCalendarConnectionStatus" NOT NULL DEFAULT 'DISCONNECTED',
    "googleAccountEmail" TEXT,
    "calendarId" TEXT NOT NULL DEFAULT 'primary',
    "calendarSummary" TEXT,
    "connectedAt" TIMESTAMP(3),
    "lastSyncAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GoogleCalendarConnection_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "GoogleCalendarConnection_teamId_key" ON "GoogleCalendarConnection"("teamId");

CREATE TABLE "GoogleCalendarToken" (
    "id" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "encryptedAccessToken" TEXT NOT NULL,
    "encryptedRefreshToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "scopes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GoogleCalendarToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "GoogleCalendarToken_connectionId_key" ON "GoogleCalendarToken"("connectionId");

CREATE TABLE "Appointment" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "conversationId" TEXT,
    "contactId" TEXT,
    "staffId" TEXT,
    "serviceId" TEXT,
    "customerName" TEXT,
    "customerPhone" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "status" "AppointmentStatus" NOT NULL DEFAULT 'PENDING',
    "source" "AppointmentSource" NOT NULL DEFAULT 'AI',
    "googleEventId" TEXT,
    "googleCalendarId" TEXT,
    "notes" TEXT,
    "cancelReason" TEXT,
    "confirmationSentAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Appointment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Appointment_teamId_startsAt_idx" ON "Appointment"("teamId", "startsAt");
CREATE INDEX "Appointment_teamId_status_startsAt_idx" ON "Appointment"("teamId", "status", "startsAt");
CREATE INDEX "Appointment_conversationId_idx" ON "Appointment"("conversationId");
CREATE INDEX "Appointment_contactId_idx" ON "Appointment"("contactId");
CREATE INDEX "Appointment_googleEventId_idx" ON "Appointment"("googleEventId");

CREATE TABLE "AppointmentReminder" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "appointmentId" TEXT NOT NULL,
    "kind" "AppointmentReminderKind" NOT NULL,
    "status" "AppointmentReminderStatus" NOT NULL DEFAULT 'SCHEDULED',
    "scheduledFor" TIMESTAMP(3) NOT NULL,
    "sentAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "jobId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppointmentReminder_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AppointmentReminder_appointmentId_kind_key" ON "AppointmentReminder"("appointmentId", "kind");
CREATE INDEX "AppointmentReminder_teamId_status_scheduledFor_idx" ON "AppointmentReminder"("teamId", "status", "scheduledFor");
CREATE INDEX "AppointmentReminder_scheduledFor_status_idx" ON "AppointmentReminder"("scheduledFor", "status");

-- ForeignKeys
ALTER TABLE "AppointmentBusinessProfile" ADD CONSTRAINT "AppointmentBusinessProfile_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AppointmentStaff" ADD CONSTRAINT "AppointmentStaff_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AppointmentStaff" ADD CONSTRAINT "AppointmentStaff_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "AppointmentBusinessProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AppointmentServiceOffer" ADD CONSTRAINT "AppointmentServiceOffer_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AppointmentServiceOffer" ADD CONSTRAINT "AppointmentServiceOffer_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "AppointmentBusinessProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AppointmentServiceOffer" ADD CONSTRAINT "AppointmentServiceOffer_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "AppointmentStaff"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "GoogleCalendarConnection" ADD CONSTRAINT "GoogleCalendarConnection_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GoogleCalendarToken" ADD CONSTRAINT "GoogleCalendarToken_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "GoogleCalendarConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "AppointmentStaff"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "AppointmentServiceOffer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AppointmentReminder" ADD CONSTRAINT "AppointmentReminder_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AppointmentReminder" ADD CONSTRAINT "AppointmentReminder_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
