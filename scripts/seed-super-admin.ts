/**
 * Seed the first Chatloora Super Admin.
 *
 * Usage (from repo root):
 *   $env:ADMIN_EMAIL="you@example.com"; $env:ADMIN_PASSWORD="secret"; pnpm exec tsx scripts/seed-super-admin.ts
 */
import { AdminRole, PrismaClient, TeamRole } from '@watsapp/database';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const email = process.env.ADMIN_EMAIL?.toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) {
    throw new Error('Set ADMIN_EMAIL and ADMIN_PASSWORD environment variables');
  }

  const passwordHash = await bcrypt.hash(password, 12);

  let user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        email,
        name: 'Super Admin',
        passwordHash,
        teamMembers: {
          create: {
            role: TeamRole.OWNER,
            team: { create: { name: 'Chatloora Admin', slug: `admin-${Date.now()}` } },
          },
        },
      },
    });
    console.log(`Created user ${email}`);
  }

  const admin = await prisma.adminUser.upsert({
    where: { userId: user.id },
    create: { userId: user.id, role: AdminRole.SUPER_ADMIN, isActive: true },
    update: { role: AdminRole.SUPER_ADMIN, isActive: true },
  });

  console.log(`Super Admin ready: ${email} (adminUserId=${admin.id})`);
  console.log('Login at /admin/login');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
