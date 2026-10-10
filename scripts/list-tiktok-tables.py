#!/usr/bin/env python3
import os, paramiko
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('161.97.140.171', username='root', password=os.environ.get('VPS_PASSWORD',''), timeout=30)
TEST = r"""
const { PrismaClient } = require('./node_modules/.pnpm/@prisma+client@6.19.3_prisma@6.19.3_typescript@6.0.3__typescript@6.0.3/node_modules/@prisma/client');
const p = new PrismaClient();
(async () => {
  const rows = await p.$queryRaw`
    SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename ILIKE '%tiktok%' ORDER BY 1`;
  console.log(rows.map(r => r.tablename).join('\n'));
  await p.$disconnect();
})().catch(e => { console.error(e.message); process.exit(1); });
"""
sftp = c.open_sftp()
with sftp.file('/root/whatsapp_GitHub/list-tables.js', 'w') as f:
    f.write(TEST)
sftp.close()
_, o, _ = c.exec_command('cd /root/whatsapp_GitHub && node list-tables.js', timeout=60000)
print(o.read().decode())
