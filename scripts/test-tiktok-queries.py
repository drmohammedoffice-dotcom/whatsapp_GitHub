#!/usr/bin/env python3
import os, paramiko
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('161.97.140.171', username='root', password=os.environ.get('VPS_PASSWORD',''), timeout=30)
JS = r"""
const { PrismaClient } = require('./node_modules/.pnpm/@prisma+client@6.19.3_prisma@6.19.3_typescript@6.0.3__typescript@6.0.3/node_modules/@prisma/client');
const p = new PrismaClient();
(async () => {
  const campaigns = await p.tikTokCampaign.findMany({ take: 1, include: { clicks: true } });
  const mkt = await p.tikTokMarketingConnection.findFirst({ include: { advertisers: true } });
  console.log('campaigns OK:', campaigns.length);
  console.log('marketing OK:', mkt ? 'connected user ' + mkt.userId : 'no connection');
  await p.$disconnect();
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
"""
sftp = c.open_sftp()
with sftp.file('/root/whatsapp_GitHub/test-tiktok.js', 'w') as f: f.write(JS)
sftp.close()
_, o, _ = c.exec_command('cd /root/whatsapp_GitHub && node test-tiktok.js', timeout=60000)
import sys; sys.stdout.reconfigure(encoding='utf-8', errors='replace')
print(o.read().decode('utf-8', errors='replace'))
