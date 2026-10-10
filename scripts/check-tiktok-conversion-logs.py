#!/usr/bin/env python3
import os
import paramiko

HOST = "161.97.140.171"
USER = "root"
PASSWORD = os.environ.get("VPS_PASSWORD", "")

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(HOST, username=USER, password=PASSWORD, timeout=30)

queries = [
    "pm2 logs api --lines 400 --nostream 2>&1 | grep TikTokConversion | tail -40",
    """cd /root/whatsapp_GitHub && node -e "
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const integrations = await p.tikTokIntegration.findMany({
    orderBy: { updatedAt: 'desc' },
    take: 5,
    select: { id: true, name: true, whatsappNumber: true, pixelCode: true, pixelStatus: true, redirectSlug: true, wizardCompleted: true, defaultOptimizationEvent: true }
  });
  console.log('INTEGRATIONS', JSON.stringify(integrations, null, 2));
  const conversions = await p.tikTokIntegrationConversion.findMany({ orderBy: { sentAt: 'desc' }, take: 10 });
  console.log('CONVERSIONS', JSON.stringify(conversions, null, 2));
  const leads = await p.tikTokIntegrationLead.findMany({ orderBy: { createdAt: 'desc' }, take: 5, include: { click: true } });
  console.log('LEADS', JSON.stringify(leads, null, 2));
  const channels = await p.channel.findMany({
    where: { provider: 'WHATSAPP' },
    take: 5,
    include: { whatsAppSession: { select: { phoneNumber: true, status: true } } }
  });
  console.log('WA_CHANNELS', JSON.stringify(channels, null, 2));
  await p.$disconnect();
})().catch(e => { console.error(e); process.exit(1); });
" """,
]

for q in queries:
    print("\n" + "=" * 60)
    print(q[:120])
    _, stdout, stderr = client.exec_command(q, timeout=120000)
    print(stdout.read().decode("utf-8", errors="replace"))
    err = stderr.read().decode("utf-8", errors="replace")
    if err.strip():
        print("STDERR:", err[-2000:])

client.close()
