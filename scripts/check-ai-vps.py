#!/usr/bin/env python3
import os, sys
import paramiko

sys.stdout.reconfigure(encoding='utf-8', errors='replace')

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('161.97.140.171', username='root', password=os.environ.get('VPS_PASSWORD', ''), timeout=30)

cmds = [
    'pm2 status',
    'pm2 logs worker --lines 40 --nostream 2>&1 | tail -25',
    "pm2 logs api --lines 80 --nostream 2>&1 | grep -E 'AI skipped|AI inbound|Failed to send AI|ai-inbound' | tail -20",
    """cd /root/whatsapp_GitHub && node -e "
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const team = await p.team.findFirst({ where: { slug: 'ahmed' }, select: { id: true, name: true } });
  if (!team) { console.log('team not found'); return; }
  console.log('team', team);
  const settings = await p.aiSettings.findMany({ where: { teamId: team.id } });
  console.log('aiSettings', JSON.stringify(settings, null, 2));
  const convs = await p.conversation.findMany({
    where: { teamId: team.id, channel: { type: { in: ['META_MESSENGER','META_INSTAGRAM','TELEGRAM'] } } },
    orderBy: { updatedAt: 'desc' },
    take: 5,
    select: { id: true, aiMode: true, greetingSentAt: true, channel: { select: { type: true, status: true } } }
  });
  console.log('recent social convs', JSON.stringify(convs, null, 2));
  await p.\\$disconnect();
})().catch(e => { console.error(e); process.exit(1); });
" 2>&1""",
]

for cmd in cmds:
    print('===', cmd[:80], '===')
    _, o, e = c.exec_command(cmd, timeout=60)
    out = o.read().decode('utf-8', 'replace')
    err = e.read().decode('utf-8', 'replace')
    print(out)
    if err.strip():
        print('STDERR:', err)

c.close()
