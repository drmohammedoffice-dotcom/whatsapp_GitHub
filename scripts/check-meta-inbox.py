#!/usr/bin/env python3
import os, sys
import paramiko
sys.stdout.reconfigure(encoding='utf-8', errors='replace')
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('161.97.140.171', username='root', password=os.environ.get('VPS_PASSWORD', ''), timeout=30)
script = r"""
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
  return cp.execSync(`psql "${db}" -t -A -c "${sql.replace(/"/g, '\\"')}"`, { encoding: 'utf8' }).trim();
}
try {
  console.log('META_MESSENGER_CHANNELS', q('SELECT COUNT(*) FROM \\"Channel\\" WHERE provider=\'META_MESSENGER\' AND status=\'CONNECTED\''));
  console.log('META_CONVERSATIONS', q('SELECT COUNT(*) FROM \\"Conversation\\" c JOIN \\"Channel\\" ch ON ch.id=c.\\"channelId\\" WHERE ch.provider=\'META_MESSENGER\''));
  console.log('META_MESSAGES', q('SELECT COUNT(*) FROM \\"ConversationMessage\\" m JOIN \\"Conversation\\" c ON c.id=m.\\"conversationId\\" JOIN \\"Channel\\" ch ON ch.id=c.\\"channelId\\" WHERE ch.provider=\'META_MESSENGER\''));
} catch (e) { console.log('DB_ERR', e.message); }
try {
  console.log('WEBHOOK_LOGS', q('SELECT COUNT(*) FROM \\"IntegrationWebhookEvent\\" WHERE provider=\'META\''));
  console.log('RECENT', q('SELECT \\"eventType\\" || \' @ \' || \\"createdAt\\"::text FROM \\"IntegrationWebhookEvent\\" WHERE provider=\'META\' ORDER BY \\"createdAt\\" DESC LIMIT 5'));
} catch (e) { console.log('WEBHOOK_TABLE', e.message.split('\n')[0]); }
try {
  console.log('SAMPLE', q('SELECT name || \' | \' || \\"externalId\\" FROM \\"Channel\\" WHERE provider=\'META_MESSENGER\' LIMIT 3'));
} catch (e) {}
NODE
pm2 logs api --lines 300 --nostream 2>&1 | grep -iE "Meta webhook|webhook process|webhook subscription" | tail -20
"""
_, o, e = c.exec_command(script, timeout=60)
print(o.read().decode())
print(e.read().decode())
c.close()
