#!/usr/bin/env python3
import os, paramiko
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('161.97.140.171', username='root', password=os.environ.get('VPS_PASSWORD',''), timeout=30)
JS = r"""
const { PrismaClient } = require('./node_modules/.pnpm/@prisma+client@6.19.3_prisma@6.19.3_typescript@6.0.3__typescript@6.0.3/node_modules/@prisma/client');
const p = new PrismaClient();
(async () => {
  for (const t of ['tiktok_whatsapp_mappings','tiktok_adgroups','tiktok_ads']) {
    const cols = await p.$queryRawUnsafe(`SELECT column_name FROM information_schema.columns WHERE table_name='${t}' ORDER BY ordinal_position`);
    console.log(t, cols.map(c=>c.column_name).join(', '));
  }
  await p.$disconnect();
})();
"""
sftp = c.open_sftp()
with sftp.file('/root/whatsapp_GitHub/col-check.js','w') as f: f.write(JS)
sftp.close()
_, o, _ = c.exec_command('cd /root/whatsapp_GitHub && node col-check.js', timeout=60000)
print(o.read().decode())
