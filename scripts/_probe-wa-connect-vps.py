#!/usr/bin/env python3
import sys
import paramiko

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("161.97.140.171", username="root", password="", timeout=60)
cmd = r"""
echo '--- recent WA logs ---'
grep -E 'WA embedded|WA customer|WA cloud' /root/.pm2/logs/api-out.log | tail -n 40
echo '--- recent WA errors ---'
grep -E 'embedded signup|connect-shared|WhatsApp Cloud|Failed to exchange' /root/.pm2/logs/api-error.log | tail -n 30
cd /root/whatsapp_GitHub
node <<'JS'
const { PrismaClient } = require('./node_modules/.pnpm/@prisma+client@6.19.3_prisma@6.19.3_typescript@6.0.3__typescript@6.0.3/node_modules/@prisma/client');
const p = new PrismaClient();
(async () => {
  const rows = await p.whatsAppCloudAccount.findMany({
    orderBy: { updatedAt: 'desc' },
    take: 8,
    select: {
      id: true, teamId: true, name: true, phoneNumber: true, phoneNumberId: true, wabaId: true,
      status: true, connectedAt: true, updatedAt: true, failureReason: true, metadata: true,
    },
  });
  console.log('ACCOUNTS', JSON.stringify(rows, null, 2));
  const channels = await p.channel.findMany({
    where: { provider: 'WHATSAPP_CLOUD' },
    orderBy: { updatedAt: 'desc' },
    take: 8,
    select: { id: true, teamId: true, name: true, status: true, externalId: true, whatsAppCloudAccountId: true, metadata: true, updatedAt: true },
  });
  console.log('CHANNELS', JSON.stringify(channels, null, 2));
  await p.$disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
JS
"""
_, o, e = c.exec_command(cmd, timeout=90)
print(o.read().decode("utf-8", "replace"))
err = e.read().decode("utf-8", "replace")
if err.strip():
    print("STDERR:", err[-2000:])
c.close()
