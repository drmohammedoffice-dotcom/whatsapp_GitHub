#!/usr/bin/env python3
"""Simulate Meta webhook POST on VPS to verify end-to-end ingestion."""
from __future__ import annotations

import hashlib
import hmac
import json
import os
import sys

import paramiko

HOST = "161.97.140.171"
USER = "root"
PASSWORD = os.environ.get("VPS_PASSWORD", "")

REMOTE = r"""
cd /root/whatsapp_GitHub
META_SECRET=$(grep '^META_APP_SECRET=' .env | cut -d= -f2-)
PAGE_ID=$(psql "$(grep DATABASE_URL .env | cut -d= -f2- | sed 's/?.*//')" -t -A -c "SELECT \"externalId\" FROM \"Channel\" WHERE provider='META_MESSENGER' AND status='CONNECTED' LIMIT 1")

echo "PAGE_ID=$PAGE_ID"

BODY=$(cat <<EOF
{"object":"page","entry":[{"id":"$PAGE_ID","time":$(date +%s000),"messaging":[{"sender":{"id":"test_user_12345"},"recipient":{"id":"$PAGE_ID"},"timestamp":$(date +%s000),"message":{"mid":"test_mid_$(date +%s)","text":"رسالة تجريبية من فحص النظام"}}]}]}
EOF
)

SIG="sha256=$(echo -n "$BODY" | openssl dgst -sha256 -hmac "$META_SECRET" | awk '{print $2}')"
echo "Sending test webhook..."
HTTP=$(curl -sS -o /tmp/meta-webhook-resp.txt -w "%{http_code}" \
  -X POST "https://almutamayiziq.com/api/webhooks/meta" \
  -H "Content-Type: application/json" \
  -H "x-hub-signature-256: $SIG" \
  -d "$BODY")
echo "HTTP=$HTTP body=$(cat /tmp/meta-webhook-resp.txt)"

sleep 2

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
console.log('WEBHOOK_EVENTS', q('SELECT COUNT(*) FROM "IntegrationWebhookEvent" WHERE provider=\'META\''));
console.log('CONVERSATIONS', q('SELECT COUNT(*) FROM "Conversation" c JOIN "Channel" ch ON ch.id=c."channelId" WHERE ch.provider=\'META_MESSENGER\''));
console.log('MESSAGES', q('SELECT COUNT(*) FROM "ConversationMessage" m JOIN "Conversation" c ON c.id=m."conversationId" JOIN "Channel" ch ON ch.id=c."channelId" WHERE ch.provider=\'META_MESSENGER\''));
NODE

echo ""
pm2 logs api --lines 30 --nostream 2>&1 | grep -iE "Meta webhook|process FAILED|no connected" | tail -10
echo "TEST_DONE"
"""

def main():
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(HOST, username=USER, password=PASSWORD, timeout=30)
    _, stdout, stderr = c.exec_command(REMOTE, timeout=120)
    print(stdout.read().decode())
    err = stderr.read().decode()
    if err.strip(): print(err, file=sys.stderr)
    c.close()

if __name__ == '__main__':
    main()
