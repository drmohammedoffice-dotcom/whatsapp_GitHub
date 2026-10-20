-- AlterEnum: add STAFF for limited employee portal access
DO $$ BEGIN
  ALTER TYPE "AdminRole" ADD VALUE 'STAFF';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- AlterTable: employee residence/location
ALTER TABLE "admin_users" ADD COLUMN IF NOT EXISTS "residence" TEXT;
