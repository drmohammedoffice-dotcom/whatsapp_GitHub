#!/usr/bin/env python3
import os, sys
import paramiko

sys.stdout.reconfigure(encoding='utf-8', errors='replace')

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('161.97.140.171', username='root', password=os.environ.get('VPS_PASSWORD', ''), timeout=30)

node_script = r'''
const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();
(async () => {
  const team = await p.team.findFirst({ where: { slug: "ahmed" } });
  console.log("team", team?.id);
  const settings = await p.aiSettings.findMany({ where: { teamId: team.id } });
  console.log("aiSettings", JSON.stringify(settings.map(s => ({
    platform: s.platform, enabled: s.enabled, autoReply: s.autoReplyEnabled,
    ooo: s.outOfOfficeMessage, bh: s.businessHours
  })), null, 2));
  const channels = await p.channel.findMany({
    where: { teamId: team.id, provider: { in: ["META_MESSENGER","META_INSTAGRAM","TELEGRAM","TELEGRAM_USER"] } },
    include: { channelToken: true },
  });
  for (const ch of channels) {
    const meta = ch.metadata;
    console.log("channel", {
      id: ch.id, provider: ch.provider, status: ch.status, externalId: ch.externalId,
      hasTokenRow: Boolean(ch.channelToken),
      hasTokenEnc: Boolean(meta && typeof meta === "object" && !Array.isArray(meta) && meta.tokenEnc),
      pageId: meta && typeof meta === "object" && !Array.isArray(meta) ? meta.pageId : null,
    });
  }
  for (const cid of ["cmr67lwlq0006kbzjnka96q5p", "cmr67xudn002gkbvtev4kaaxi"]) {
    const ch = await p.channel.findUnique({ where: { id: cid }, include: { channelToken: true } });
    console.log("problem channel", cid, JSON.stringify({
      provider: ch?.provider, status: ch?.status, externalId: ch?.externalId,
      metadata: ch?.metadata,
      hasTokenRow: Boolean(ch?.channelToken),
    }));
  }
  await p.$disconnect();
})().catch(e => { console.error(e); process.exit(1); });
'''

cmd = f"cd /root/whatsapp_GitHub/apps/api && node -e {repr(node_script)}"
_, o, e = c.exec_command(cmd, timeout=60)
print(o.read().decode('utf-8', 'replace'))
err = e.read().decode('utf-8', 'replace')
if err.strip():
    print('STDERR:', err[:2000])

c.close()
