#!/usr/bin/env python3
import os, sys, paramiko, json
HOST = "161.97.140.171"
PASSWORD = os.environ.get("VPS_PASSWORD", "")
cmd = r"""
cd /root/whatsapp_GitHub/apps/api
node -e "
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const channels = await p.channel.findMany({
    where: { provider: 'WHATSAPP_BAILEYS' },
    include: { whatsAppSession: true, team: { select: { name: true } } },
    orderBy: { createdAt: 'desc' },
    take: 10,
  });
  const tracking = channels.filter(c => c.metadata && c.metadata.purpose === 'tracking');
  console.log(JSON.stringify(tracking.map(c => ({
    id: c.id,
    name: c.name,
    status: c.status,
    externalId: c.externalId,
    metadata: c.metadata,
    session: c.whatsAppSession ? {
      id: c.whatsAppSession.id,
      status: c.whatsAppSession.status,
      phoneNumber: c.whatsAppSession.phoneNumber,
      jid: c.whatsAppSession.jid,
      displayName: c.whatsAppSession.displayName,
      connectedAt: c.whatsAppSession.connectedAt,
    } : null,
    team: c.team?.name,
  })), null, 2));
  await p.\$disconnect();
})().catch(e => { console.error(e); process.exit(1); });
"
"""
client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(HOST, username='root', password=PASSWORD, timeout=60)
_, o, e = client.exec_command(cmd, timeout=120000)
print(o.read().decode('utf-8','replace'))
err = e.read().decode('utf-8','replace')
if err.strip(): print('ERR:', err)
client.close()
