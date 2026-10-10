#!/usr/bin/env python3
"""Deep debug: webhooks, conversations, app mode, recent PM2 logs."""
from __future__ import annotations

import os
import sys
import paramiko

HOST = "161.97.140.171"
USER = "root"
PASSWORD = os.environ.get("VPS_PASSWORD", "")

REMOTE = r"""
cd /root/whatsapp_GitHub

echo "=== DB state ==="
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
const items = [
  ['WEBHOOK_COUNT', 'SELECT COUNT(*) FROM "IntegrationWebhookEvent" WHERE provider=\'META\''],
  ['WEBHOOK_RECENT', 'SELECT "createdAt"::text || \' | \' || "eventType" || \' | page=\' || COALESCE("externalId",\'?\') FROM "IntegrationWebhookEvent" WHERE provider=\'META\' ORDER BY "createdAt" DESC LIMIT 10'],
  ['CONV_COUNT', 'SELECT COUNT(*) FROM "Conversation" c JOIN "Channel" ch ON ch.id=c."channelId" WHERE ch.provider=\'META_MESSENGER\''],
  ['MSG_RECENT', 'SELECT m."createdAt"::text || \' | \' || COALESCE(m.text,\'[no text]\') || \' | conv=\' || c.id FROM "ConversationMessage" m JOIN "Conversation" c ON c.id=m."conversationId" JOIN "Channel" ch ON ch.id=c."channelId" WHERE ch.provider=\'META_MESSENGER\' ORDER BY m."createdAt" DESC LIMIT 10'],
  ['CHANNEL', 'SELECT c.name || \' | page=\' || c."externalId" || \' | team=\' || t.name || \' | teamId=\' || c."teamId" FROM "Channel" c JOIN "Team" t ON t.id=c."teamId" WHERE c.provider=\'META_MESSENGER\' AND c.status=\'CONNECTED\''],
  ['USERS', 'SELECT u.email || \' | team=\' || t.name || \' | teamId=\' || tm."teamId" FROM "User" u JOIN "TeamMember" tm ON tm."userId"=u.id JOIN "Team" t ON t.id=tm."teamId" LIMIT 10'],
];
for (const [k, sql] of items) {
  try { console.log(k + ':', q(sql) || '(empty)'); }
  catch (e) { console.log(k + ': ERR', e.message.split('\n')[0]); }
}
NODE

echo ""
echo "=== App webhook subscription ==="
node <<'NODE2'
const fs = require('fs');
const https = require('https');
for (const line of fs.readFileSync('.env','utf8').split('\n')) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m) process.env[m[1].trim()] = m[2].trim();
}
const appId = process.env.META_APP_ID;
const secret = process.env.META_APP_SECRET;
const token = appId + '|' + secret;
https.get(`https://graph.facebook.com/v21.0/${appId}/subscriptions?access_token=${encodeURIComponent(token)}`, res => {
  let b=''; res.on('data',c=>b+=c); res.on('end',()=>console.log(b));
});
NODE2
sleep 2

echo ""
echo "=== PM2 last Meta logs (all) ==="
pm2 logs api --lines 800 --nostream 2>&1 | grep -iE "Meta webhook|webhook logged|webhook process|no connected|signature|messaging" | tail -40 || true

echo ""
echo "=== nginx access: meta webhook POSTs ==="
grep "POST /api/webhooks/meta" /var/log/nginx/access.log 2>/dev/null | tail -15 || \
grep "POST /api/webhooks/meta" /var/log/nginx/*access* 2>/dev/null | tail -15 || \
echo "nginx log not found"

echo "DEBUG_DONE"
"""

def main():
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    for attempt in range(3):
        try:
            c.connect(HOST, username=USER, password=PASSWORD, timeout=60, banner_timeout=60)
            break
        except Exception as e:
            print(f"SSH attempt {attempt+1} failed: {e}", file=sys.stderr)
            if attempt == 2:
                raise
    _, stdout, stderr = c.exec_command(REMOTE, timeout=120)
    print(stdout.read().decode())
    err = stderr.read().decode()
    if err.strip():
        print(err, file=sys.stderr)
    c.close()

if __name__ == "__main__":
    main()
