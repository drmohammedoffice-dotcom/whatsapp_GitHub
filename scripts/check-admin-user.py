#!/usr/bin/env python3
import os, paramiko
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('161.97.140.171', username='root', password=os.environ.get('VPS_PASSWORD',''), timeout=30)
SEED = r"""
const { PrismaClient } = require('./node_modules/.pnpm/@prisma+client@6.19.3_prisma@6.19.3_typescript@6.0.3__typescript@6.0.3/node_modules/@prisma/client');
const p = new PrismaClient();
(async () => {
  const email = 'drmohammedoffice@gmail.com';
  const user = await p.user.findUnique({ where: { email }, include: { adminProfile: true } });
  if (!user) { console.log('USER_NOT_FOUND'); return; }
  console.log('user:', user.id, user.name);
  console.log('admin:', user.adminProfile ? { id: user.adminProfile.id, role: user.adminProfile.role, isActive: user.adminProfile.isActive } : null);
  const admins = await p.adminUser.findMany({ take: 5, include: { user: { select: { email: true } } } });
  console.log('all admins:', admins.map(a => ({ email: a.user.email, role: a.role, active: a.isActive })));
  await p.$disconnect();
})().catch(e => { console.error(e); process.exit(1); });
"""
sftp = c.open_sftp()
with sftp.file('/root/whatsapp_GitHub/check-admin.js', 'w') as f:
    f.write(SEED)
sftp.close()
_, o, _ = c.exec_command('cd /root/whatsapp_GitHub && node check-admin.js', timeout=60000)
print(o.read().decode())
