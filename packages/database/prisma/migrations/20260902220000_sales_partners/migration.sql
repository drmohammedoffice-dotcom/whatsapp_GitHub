-- CreateEnum
CREATE TYPE "SalesPartnerStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "SalesReferralSource" AS ENUM ('CODE', 'LINK');

-- CreateEnum
CREATE TYPE "SalesCommissionKind" AS ENUM ('FIRST', 'RENEWAL');

-- CreateEnum
CREATE TYPE "SalesCommissionStatus" AS ENUM ('PENDING', 'APPROVED', 'PAID', 'REJECTED');

-- CreateEnum
CREATE TYPE "SalesCommissionMode" AS ENUM ('PERCENT', 'FIXED');

-- CreateTable
CREATE TABLE "sales_partners" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "SalesPartnerStatus" NOT NULL DEFAULT 'PENDING',
    "referral_code" TEXT,
    "password_hash" TEXT,
    "notes" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "reviewed_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sales_partners_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_commission_rules" (
    "id" TEXT NOT NULL,
    "plan_id" TEXT NOT NULL,
    "mode" "SalesCommissionMode" NOT NULL DEFAULT 'PERCENT',
    "percent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "fixed_cents" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sales_commission_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_referrals" (
    "id" TEXT NOT NULL,
    "partner_id" TEXT NOT NULL,
    "team_id" TEXT NOT NULL,
    "user_id" TEXT,
    "source" "SalesReferralSource" NOT NULL,
    "code_used" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sales_referrals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_commissions" (
    "id" TEXT NOT NULL,
    "partner_id" TEXT NOT NULL,
    "referral_id" TEXT NOT NULL,
    "payment_id" TEXT NOT NULL,
    "subscription_id" TEXT NOT NULL,
    "team_id" TEXT NOT NULL,
    "plan_id" TEXT NOT NULL,
    "kind" "SalesCommissionKind" NOT NULL,
    "status" "SalesCommissionStatus" NOT NULL DEFAULT 'PENDING',
    "amount_cents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'IQD',
    "sale_cents" INTEGER NOT NULL,
    "note" TEXT,
    "approved_at" TIMESTAMP(3),
    "paid_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sales_commissions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sales_partners_email_key" ON "sales_partners"("email");

-- CreateIndex
CREATE UNIQUE INDEX "sales_partners_referral_code_key" ON "sales_partners"("referral_code");

-- CreateIndex
CREATE INDEX "sales_partners_status_created_at_idx" ON "sales_partners"("status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "sales_commission_rules_plan_id_key" ON "sales_commission_rules"("plan_id");

-- CreateIndex
CREATE UNIQUE INDEX "sales_referrals_team_id_key" ON "sales_referrals"("team_id");

-- CreateIndex
CREATE INDEX "sales_referrals_partner_id_created_at_idx" ON "sales_referrals"("partner_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "sales_commissions_payment_id_key" ON "sales_commissions"("payment_id");

-- CreateIndex
CREATE INDEX "sales_commissions_partner_id_status_idx" ON "sales_commissions"("partner_id", "status");

-- CreateIndex
CREATE INDEX "sales_commissions_partner_id_created_at_idx" ON "sales_commissions"("partner_id", "created_at");

-- AddForeignKey
ALTER TABLE "sales_commission_rules" ADD CONSTRAINT "sales_commission_rules_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "subscription_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_referrals" ADD CONSTRAINT "sales_referrals_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "sales_partners"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_referrals" ADD CONSTRAINT "sales_referrals_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_referrals" ADD CONSTRAINT "sales_referrals_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_commissions" ADD CONSTRAINT "sales_commissions_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "sales_partners"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_commissions" ADD CONSTRAINT "sales_commissions_referral_id_fkey" FOREIGN KEY ("referral_id") REFERENCES "sales_referrals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_commissions" ADD CONSTRAINT "sales_commissions_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_commissions" ADD CONSTRAINT "sales_commissions_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
