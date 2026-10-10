#!/usr/bin/env python3
import os, sys, tarfile, tempfile
from pathlib import Path
import paramiko

HOST = "161.97.140.171"
USER = "root"
PASSWORD = os.environ.get("VPS_PASSWORD", "")
PROJECT_DIR = "/root/whatsapp_GitHub"

script = """
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const team = await p.team.findFirst({ where: { slug: 'ahmed' } });
  console.log('team', team?.id);
  const settings = await p.aiSettings.findMany({ where: { teamId: team.id } });
  console.log('aiSettings', JSON.stringify(settings.map(s => ({
    platform: s.platform, enabled: s.enabled, autoReply: s.autoReplyEnabled,
  })), null, 2));
  const channels = await p.channel.findMany({
    where: { teamId: team.id, provider: { in: ['META_MESSENGER','META_INSTAGRAM','TELEGRAM','TELEGRAM_USER'] } },
    include: { channelToken: true },
  });
  for (const ch of channels) {
    const meta = ch.metadata && typeof ch.metadata === 'object' && !Array.isArray(ch.metadata) ? ch.metadata : {};
    console.log('channel', JSON.stringify({
      id: ch.id, provider: ch.provider, status: ch.status, externalId: ch.externalId,
      hasTokenRow: Boolean(ch.channelToken),
      hasTokenEnc: Boolean(meta.tokenEnc),
      pageId: meta.pageId || null,
    }));
  }
  for (const cid of ['cmr67lwlq0006kbzjnka96q5p', 'cmr67xudn002gkbvtev4kaaxi']) {
    const ch = await p.channel.findUnique({ where: { id: cid }, include: { channelToken: true } });
    const meta = ch?.metadata && typeof ch.metadata === 'object' && !Array.isArray(ch.metadata) ? ch.metadata : {};
    console.log('problem', cid, JSON.stringify({
      provider: ch?.provider, status: ch?.status, externalId: ch?.externalId,
      hasTokenRow: Boolean(ch?.channelToken),
      hasTokenEnc: Boolean(meta.tokenEnc),
      pageId: meta.pageId,
    }));
  }
  await p.$disconnect();
})().catch(e => { console.error(e); process.exit(1); });
"""

fd, tar_path = tempfile.mkstemp(suffix='.tar.gz')
os.close(fd)
with tarfile.open(tar_path, 'w:gz') as tar:
    import io
    data = script.encode('utf-8')
    info = tarfile.TarInfo(name='query-ai.js')
    info.size = len(data)
    tar.addfile(info, io.BytesIO(data))

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(HOST, username=USER, password=PASSWORD, timeout=30)
sftp = c.open_sftp()
sftp.put(tar_path, f'{PROJECT_DIR}/query-ai.tar.gz')
sftp.close()
os.remove(tar_path)

_, o, e = c.exec_command(
    f'export $(grep -v "^#" {PROJECT_DIR}/.env | xargs) && cd {PROJECT_DIR}/packages/database && tar xzf {PROJECT_DIR}/query-ai.tar.gz && NODE_PATH={PROJECT_DIR}/packages/database/node_modules node query-ai.js',
    timeout=60,
)
print(o.read().decode('utf-8', 'replace'))
err = e.read().decode('utf-8', 'replace')
if err.strip():
    print('ERR:', err)
c.close()
