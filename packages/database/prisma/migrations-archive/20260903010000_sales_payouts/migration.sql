-- CreateEnum
CREATE TYPE "SalesPayoutStatus" AS ENUM ('AWAITING_EMAIL', 'SUBMITTED', 'APPROVED', 'PAID', 'REJECTED', 'CANCELLED');

-- AlterTable
ALTER TABLE "sales_partners" ADD COLUMN "password_encrypted" TEXT;

-- CreateTable
CREATE TABLE "sales_payout_requests" (
    "id" TEXT NOT NULL,
    "partner_id" TEXT NOT NULL,
    "amount_cents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'IQD',
    "account_number" TEXT NOT NULL,
    "account_image_key" TEXT,
    "receipt_image_key" TEXT,
    "email_code_hash" TEXT,
    "email_code_expires_at" TIMESTAMP(3),
    "email_verified_at" TIMESTAMP(3),
    "status" "SalesPayoutStatus" NOT NULL DEFAULT 'AWAITING_EMAIL',
    "admin_note" TEXT,
    "paid_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sales_payout_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sales_payout_requests_partner_id_created_at_idx" ON "sales_payout_requests"("partner_id", "created_at");

-- CreateIndex
CREATE INDEX "sales_payout_requests_status_created_at_idx" ON "sales_payout_requests"("status", "created_at");

-- AddForeignKey
ALTER TABLE "sales_payout_requests" ADD CONSTRAINT "sales_payout_requests_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "sales_partners"("id") ON DELETE CASCADE ON UPDATE CASCADE;
