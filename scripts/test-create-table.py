#!/usr/bin/env python3
import os, paramiko
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('161.97.140.171', username='root', password=os.environ.get('VPS_PASSWORD',''), timeout=30)
JS = r"""
const { PrismaClient } = require('./node_modules/.pnpm/@prisma+client@6.19.3_prisma@6.19.3_typescript@6.0.3__typescript@6.0.3/node_modules/@prisma/client');
const p = new PrismaClient();
(async () => {
  try {
    await p.$executeRawUnsafe(`CREATE TABLE "tiktok_marketing_advertisers" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "user_id" TEXT NOT NULL,
      "advertiser_id" TEXT NOT NULL,
      "name" TEXT,
      "currency" TEXT,
      "timezone" TEXT,
      "status" TEXT,
      "raw" JSONB,
      "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`);
    console.log('CREATE OK');
  } catch (e) {
    console.log('CREATE ERR:', e.message);
  }
  const rows = await p.$queryRaw`SELECT tablename FROM pg_tables WHERE tablename = 'tiktok_marketing_advertisers'`;
  console.log('exists:', rows.length);
  await p.$disconnect();
})();
"""
sftp = c.open_sftp()
with sftp.file('/root/whatsapp_GitHub/test-create.js', 'w') as f:
    f.write(JS)
sftp.close()
_, o, _ = c.exec_command('cd /root/whatsapp_GitHub && node test-create.js', timeout=60000)
print(o.read().decode())
