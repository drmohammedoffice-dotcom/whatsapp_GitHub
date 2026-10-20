/**
 * Promote the earliest registered user to Super Admin (idempotent).
 */
import { AdminRole, PrismaClient } from '@watsapp/database';

const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findFirst({ orderBy: { createdAt: 'asc' } });
  if (!user) {
    console.log('No users found — register a customer account first.');
    return;
  }

  const admin = await prisma.adminUser.upsert({
    where: { userId: user.id },
    create: { userId: user.id, role: AdminRole.SUPER_ADMIN, isActive: true },
    update: { role: AdminRole.SUPER_ADMIN, isActive: true },
  });

  console.log(`Super Admin promoted: ${user.email} (adminUserId=${admin.id})`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
