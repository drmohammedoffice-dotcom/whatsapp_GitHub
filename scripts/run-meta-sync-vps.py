#!/usr/bin/env python3
"""Deploy Meta API and run sync-messages via authenticated local request."""
from __future__ import annotations

import os
import sys
import paramiko

HOST = "161.97.140.171"
USER = "root"
PASSWORD = os.environ.get("VPS_PASSWORD", "")

SYNC_REMOTE = r"""
cd /root/whatsapp_GitHub
node <<'NODE'
const fs = require('fs');
const cp = require('child_process');
const http = require('http');
const crypto = require('crypto');

for (const line of fs.readFileSync('.env','utf8').split('\n')) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m) process.env[m[1].trim()] = m[2].trim();
}
const db = (process.env.DATABASE_URL || '').replace(/\?.*$/, '');
function q(sql) {
  return cp.execSync(`psql "${db}" -t -A -c ${JSON.stringify(sql)}`, { encoding: 'utf8' }).trim();
}

const userId = q(`SELECT u.id FROM "User" u WHERE u.email='drmohammedoffice@gmail.com' LIMIT 1`);
const teamId = q(`SELECT tm."teamId" FROM "TeamMember" tm JOIN "User" u ON u.id=tm."userId" WHERE u.email='drmohammedoffice@gmail.com' LIMIT 1`);
if (!userId || !teamId) { console.log('NO_USER'); process.exit(1); }

const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
const payload = Buffer.from(JSON.stringify({
  sub: userId,
  teamId,
  permissions: ['SETTINGS_MANAGE', 'INBOX_VIEW', 'INBOX_REPLY'],
  iat: Math.floor(Date.now()/1000),
  exp: Math.floor(Date.now()/1000) + 3600,
})).toString('base64url');
const sig = crypto.createHmac('sha256', process.env.JWT_ACCESS_SECRET).update(header + '.' + payload).digest('base64url');
const token = header + '.' + payload + '.' + sig;

const port = process.env.API_PORT || '4000';
const body = '{}';
const req = http.request({
  hostname: '127.0.0.1',
  port: Number(port),
  path: '/api/v1/meta/sync-messages',
  method: 'POST',
  headers: {
    Authorization: 'Bearer ' + token,
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body),
  },
}, res => {
  let data = '';
  res.on('data', c => data += c);
  res.on('end', () => {
    console.log('SYNC_HTTP', res.statusCode, data);
    console.log('CONV_COUNT', q('SELECT COUNT(*) FROM "Conversation" c JOIN "Channel" ch ON ch.id=c."channelId" WHERE ch.provider=\'META_MESSENGER\''));
    console.log('MSG_COUNT', q('SELECT COUNT(*) FROM "ConversationMessage" m JOIN "Conversation" c ON c.id=m."conversationId" JOIN "Channel" ch ON ch.id=c."channelId" WHERE ch.provider=\'META_MESSENGER\''));
    console.log('RECENT', q('SELECT COALESCE(m.text,\'[media]\') || \' | \' || c.subject FROM "ConversationMessage" m JOIN "Conversation" c ON c.id=m."conversationId" JOIN "Channel" ch ON ch.id=c."channelId" WHERE ch.provider=\'META_MESSENGER\' ORDER BY m."createdAt" DESC LIMIT 5'));
  });
});
req.on('error', e => console.error('REQ_ERR', e.message));
req.write(body);
req.end();
NODE
"""

def main():
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(HOST, username=USER, password=PASSWORD, timeout=60, banner_timeout=60)
    _, stdout, stderr = c.exec_command(SYNC_REMOTE, timeout=1800)
    print(stdout.read().decode())
    err = stderr.read().decode()
    if err.strip(): print(err, file=sys.stderr)
    c.close()

if __name__ == '__main__':
    main()
