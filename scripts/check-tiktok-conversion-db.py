#!/usr/bin/env python3
import json
import os
import paramiko

HOST = "161.97.140.171"
USER = "root"
PASSWORD = os.environ.get("VPS_PASSWORD", "")
PROJECT = "/root/whatsapp_GitHub"

script = r"""
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const integrations = await p.tikTokIntegration.findMany({
    orderBy: { updatedAt: 'desc' },
    take: 5,
    select: {
      id: true, teamId: true, name: true, whatsappNumber: true, pixelCode: true,
      pixelStatus: true, redirectSlug: true, wizardCompleted: true,
      defaultOptimizationEvent: true, userId: true,
    },
  });
  const conversions = await p.tikTokIntegrationConversion.findMany({ orderBy: { sentAt: 'desc' }, take: 10 });
  const leads = await p.tikTokIntegrationLead.findMany({
    orderBy: { createdAt: 'desc' },
    take: 8,
    include: { click: { select: { id: true, ttclid: true, createdAt: true } } },
  });
  const channels = await p.channel.findMany({
    where: { provider: 'WHATSAPP' },
    take: 5,
    include: { whatsAppSession: { select: { phoneNumber: true, status: true } } },
  });
  const marketing = await p.tikTokMarketingConnection.findMany({
    take: 3,
    select: { userId: true, advertiserId: true, accessTokenExpiresAt: true, updatedAt: true },
  });
  console.log(JSON.stringify({ integrations, conversions, leads, channels, marketing }, null, 2));
  await p.$disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
"""

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(HOST, username=USER, password=PASSWORD, timeout=30)
cmd = f"cd {PROJECT} && node -e {json.dumps(script)}"
_, stdout, stderr = client.exec_command(cmd, timeout=120000)
print(stdout.read().decode("utf-8", errors="replace"))
err = stderr.read().decode("utf-8", errors="replace")
if err.strip():
    print("STDERR:", err)
client.close()
