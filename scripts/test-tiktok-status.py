#!/usr/bin/env python3
import os, paramiko
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('161.97.140.171', username='root', password=os.environ.get('VPS_PASSWORD',''), timeout=30)
JS = r"""
const { PrismaClient } = require('./node_modules/.pnpm/@prisma+client@6.19.3_prisma@6.19.3_typescript@6.0.3__typescript@6.0.3/node_modules/@prisma/client');
const p = new PrismaClient();
(async () => {
  const userId = 'cmqwrykfu0007kbi7rpurdadf';
  const teamMember = await p.teamMember.findFirst({ where: { userId } });
  const teamId = teamMember?.teamId;
  const configured = await p.tikTokAppCredentials.findFirst({ where: { teamId } });
  const marketing = await p.tikTokMarketingConnection.findUnique({
    where: { userId },
    include: { advertisers: { orderBy: { name: 'asc' } } },
  });
  const account = await p.tikTokAccount.findUnique({ where: { teamId }, include: { _count: { select: { advertisers: true, businessCenters: true, events: true, campaigns: true } } } });
  const campaigns = await p.tikTokCampaign.findMany({ where: { teamId }, include: { _count: { select: { clicks: true } } }, take: 5 });
  console.log(JSON.stringify({
    teamId,
    configured: !!configured,
    marketing: !!marketing,
    advertisers: marketing?.advertisers?.length ?? 0,
    accountStatus: account?.status ?? 'none',
    campaigns: campaigns.length,
  }, null, 2));
  await p.$disconnect();
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
"""
sftp = c.open_sftp()
with sftp.file('/root/whatsapp_GitHub/test-status.js', 'w') as f: f.write(JS)
sftp.close()
_, o, _ = c.exec_command('cd /root/whatsapp_GitHub && node test-status.js', timeout=60000)
import sys; sys.stdout.reconfigure(encoding='utf-8', errors='replace')
print(o.read().decode('utf-8', errors='replace'))
