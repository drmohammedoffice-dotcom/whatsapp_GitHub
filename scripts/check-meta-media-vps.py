#!/usr/bin/env python3
import os, sys, paramiko
HOST = "161.97.140.171"
USER = "root"
PASSWORD = os.environ.get("VPS_PASSWORD", "")
REMOTE = r"""
cd /root/whatsapp_GitHub
node <<'NODE'
const fs = require('fs');
const cp = require('child_process');
for (const line of fs.readFileSync('.env','utf8').split('\n')) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m) process.env[m[1].trim()] = m[2].trim();
}
const db = (process.env.DATABASE_URL || '').replace(/\?.*$/, '');
function q(sql) {
  return cp.execSync(`psql "${db}" -t -A -c ${JSON.stringify(sql)}`, { encoding: 'utf8' }).trim();
}
console.log('WITH_MEDIA', q(`SELECT COUNT(*) FROM "ConversationMessage" m JOIN "Channel" ch ON ch.id=(SELECT "channelId" FROM "Conversation" WHERE id=m."conversationId") WHERE ch.provider='META_MESSENGER' AND m."mediaStorageKey" IS NOT NULL`));
console.log('IMAGE_NO_MEDIA', q(`SELECT COUNT(*) FROM "ConversationMessage" m JOIN "Channel" ch ON ch.id=(SELECT "channelId" FROM "Conversation" WHERE id=m."conversationId") WHERE ch.provider='META_MESSENGER' AND m.type IN ('IMAGE','STICKER') AND m."mediaStorageKey" IS NULL`));
console.log('SAMPLE', q(`SELECT m.type || ' | ' || COALESCE(m."mediaStorageKey",'none') || ' | ' || COALESCE(m.text,'') FROM "ConversationMessage" m JOIN "Conversation" c ON c.id=m."conversationId" JOIN "Channel" ch ON ch.id=c."channelId" WHERE ch.provider='META_MESSENGER' AND m.type IN ('IMAGE','STICKER') ORDER BY m."createdAt" DESC LIMIT 8`));
NODE
"""
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(HOST, username=USER, password=PASSWORD, timeout=60)
_, o, _ = c.exec_command(REMOTE, timeout=60)
print(o.read().decode())
c.close()
