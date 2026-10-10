#!/usr/bin/env python3
"""Diagnose Meta Messenger inbox on production VPS."""
from __future__ import annotations

import json
import os
import sys

import paramiko

HOST = "161.97.140.171"
USER = "root"
PASSWORD = os.environ.get("VPS_PASSWORD", "")
PROJECT_DIR = "/root/whatsapp_GitHub"

REMOTE_SCRIPT = r"""
cd /root/whatsapp_GitHub

echo "=== ENV (Meta) ==="
grep -E '^META_' .env | sed 's/=.*/=***/' || true

echo ""
echo "=== API health ==="
sleep 3
curl -sS -o /dev/null -w "health:%{http_code}\n" https://almutamayiziq.com/api/v1/health || true
curl -sS -o /dev/null -w "webhook-get:%{http_code}\n" "https://almutamayiziq.com/api/webhooks/meta?hub.mode=subscribe&hub.verify_token=chatloora-meta-verify-2026&hub.challenge=diag123" || true

echo ""
echo "=== Database ==="
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
const queries = [
  ['META_MESSENGER_CHANNELS', `SELECT COUNT(*) FROM "Channel" WHERE provider='META_MESSENGER' AND status='CONNECTED'`],
  ['META_CONVERSATIONS', `SELECT COUNT(*) FROM "Conversation" c JOIN "Channel" ch ON ch.id=c."channelId" WHERE ch.provider='META_MESSENGER'`],
  ['META_MESSAGES', `SELECT COUNT(*) FROM "ConversationMessage" m JOIN "Conversation" c ON c.id=m."conversationId" JOIN "Channel" ch ON ch.id=c."channelId" WHERE ch.provider='META_MESSENGER'`],
  ['WEBHOOK_LOGS', `SELECT COUNT(*) FROM "IntegrationWebhookEvent" WHERE provider='META'`],
  ['RECENT_WEBHOOKS', `SELECT "eventType" || ' @ ' || "createdAt"::text FROM "IntegrationWebhookEvent" WHERE provider='META' ORDER BY "createdAt" DESC LIMIT 5`],
  ['SAMPLE_CHANNELS', `SELECT name || ' | pageId=' || COALESCE(metadata->>'pageId', "externalId") FROM "Channel" WHERE provider='META_MESSENGER' AND status='CONNECTED' LIMIT 5`],
  ['TEAMS', `SELECT t.id || ' | ' || t.name || ' | channels=' || (SELECT COUNT(*) FROM "Channel" c WHERE c."teamId"=t.id AND c.provider='META_MESSENGER' AND c.status='CONNECTED') FROM "Team" t ORDER BY (SELECT COUNT(*) FROM "Channel" c WHERE c."teamId"=t.id AND c.provider='META_MESSENGER') DESC LIMIT 3`],
];
for (const [label, sql] of queries) {
  try { console.log(label, q(sql) || '(empty)'); }
  catch (e) { console.log(label, 'ERR', e.message.split('\n')[0]); }
}
NODE

echo ""
echo "=== PM2 logs (Meta webhook) ==="
pm2 logs api --lines 400 --nostream 2>&1 | grep -iE "Meta webhook|webhook process|webhook subscription|resubscribe|no connected channel|signature" | tail -30 || true

echo ""
echo "=== rawBody in main.ts ==="
grep -n "rawBody" apps/api/src/main.ts || echo "rawBody NOT FOUND"

echo ""
echo "=== resubscribe endpoint ==="
grep -n "resubscribe-webhooks" apps/api/src/integrations/meta/meta.controller.ts || echo "resubscribe NOT FOUND"

echo "DIAG_DONE"
"""


def main() -> int:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(HOST, username=USER, password=PASSWORD, timeout=30)
    _, stdout, stderr = client.exec_command(REMOTE_SCRIPT, timeout=120)
    print(stdout.read().decode("utf-8", errors="replace"))
    err = stderr.read().decode("utf-8", errors="replace")
    if err.strip():
        print(err, file=sys.stderr)
    client.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
