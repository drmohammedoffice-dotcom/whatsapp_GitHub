-- AlterTable
ALTER TABLE "sales_partners" ADD COLUMN "user_id" TEXT;
ALTER TABLE "sales_partners" ADD COLUMN "age" INTEGER;
ALTER TABLE "sales_partners" ADD COLUMN "city" TEXT;
ALTER TABLE "sales_partners" ADD COLUMN "avatar_key" TEXT;
ALTER TABLE "sales_partners" ADD COLUMN "join_code_hash" TEXT;
ALTER TABLE "sales_partners" ADD COLUMN "join_code_expires_at" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "sales_partners_user_id_key" ON "sales_partners"("user_id");

-- AddForeignKey
ALTER TABLE "sales_partners" ADD CONSTRAINT "sales_partners_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateEnum
CREATE TYPE "SalesPayoutMethod" AS ENUM ('ZAIN_CASH', 'MASTERCARD');

-- AlterTable
ALTER TABLE "sales_payout_requests" ADD COLUMN "account_name" TEXT;
ALTER TABLE "sales_payout_requests" ADD COLUMN "method" "SalesPayoutMethod";
ALTER TABLE "sales_payout_requests" ADD COLUMN "fee_cents" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "sales_payout_requests" ADD COLUMN "net_cents" INTEGER NOT NULL DEFAULT 0;
