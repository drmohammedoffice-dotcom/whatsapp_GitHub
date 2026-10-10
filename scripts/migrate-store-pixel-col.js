/** One-off: add StoreSettings.pixel_integration_id without full prisma db push. */
const path = require('path');
const { PrismaClient } = require(path.resolve(__dirname, '../packages/database/node_modules/@prisma/client'));

async function main() {
  const prisma = new PrismaClient();
  try {
    await prisma.$executeRawUnsafe(
      'ALTER TABLE "StoreSettings" ADD COLUMN IF NOT EXISTS pixel_integration_id TEXT',
    );
    await prisma.$executeRawUnsafe(
      'CREATE INDEX IF NOT EXISTS "StoreSettings_pixel_integration_id_idx" ON "StoreSettings"("pixel_integration_id")',
    );
    console.log('pixel_col_ok');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
