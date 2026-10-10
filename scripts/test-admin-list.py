#!/usr/bin/env python3
import os, paramiko
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('161.97.140.171', username='root', password=os.environ.get('VPS_PASSWORD',''), timeout=30)
TEST = r"""
const { PrismaClient } = require('./node_modules/.pnpm/@prisma+client@6.19.3_prisma@6.19.3_typescript@6.0.3__typescript@6.0.3/node_modules/@prisma/client');
const p = new PrismaClient();
(async () => {
  const users = await p.user.findMany({
    take: 3,
    orderBy: { createdAt: 'desc' },
    include: {
      teamMembers: {
        include: {
          team: {
            select: {
              id: true, name: true, slug: true,
              subscriptions: { include: { plan: true }, take: 1 },
            },
          },
        },
      },
      adminProfile: true,
      ownedSubscriptions: { include: { plan: true } },
    },
  });
  console.log('OK users:', users.length);
  console.log('sample:', JSON.stringify({
    email: users[0]?.email,
    sub: users[0]?.teamMembers[0]?.team?.subscriptions?.[0]?.plan?.name ?? null,
  }));
  await p.$disconnect();
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
"""
sftp = c.open_sftp()
with sftp.file('/root/whatsapp_GitHub/test-admin-list.js', 'w') as f:
    f.write(TEST)
sftp.close()
_, o, e = c.exec_command('cd /root/whatsapp_GitHub && node test-admin-list.js', timeout=60000)
print(o.read().decode())
print(e.read().decode())
c.close()
