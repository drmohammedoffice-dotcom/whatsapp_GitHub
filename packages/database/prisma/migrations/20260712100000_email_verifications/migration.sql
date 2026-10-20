-- Email OTP verification for signup and login
CREATE TYPE "EmailVerificationType" AS ENUM ('SIGNUP', 'LOGIN');

CREATE TABLE "email_verifications" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "email" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" "EmailVerificationType" NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_verifications_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "email_verifications_email_type_idx" ON "email_verifications"("email", "type");
CREATE INDEX "email_verifications_user_id_idx" ON "email_verifications"("user_id");

ALTER TABLE "email_verifications" ADD CONSTRAINT "email_verifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Grandfather existing users so they are not blocked by the new OTP login flow
UPDATE "User" SET "emailVerifiedAt" = NOW() WHERE "emailVerifiedAt" IS NULL;
