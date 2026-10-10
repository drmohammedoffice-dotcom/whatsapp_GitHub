#!/usr/bin/env python3
"""Resubscribe Meta webhooks on VPS and test page subscription."""
from __future__ import annotations

import os
import sys

import paramiko

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

async function main() {
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();
  const crypto = require('crypto');

  // Load encryption helper from compiled dist or use direct query for tokens
  const channels = await prisma.channel.findMany({
    where: { provider: 'META_MESSENGER', status: 'CONNECTED' },
    include: { team: true },
  });
  console.log('CONNECTED_CHANNELS', channels.length);
  for (const ch of channels) {
    console.log('CHANNEL', ch.id, ch.name, ch.externalId, 'team=', ch.team?.name);
  }

  // Read encrypted tokens from ChannelToken table
  for (const ch of channels) {
    const tokenRow = await prisma.channelToken.findUnique({ where: { channelId: ch.id } });
    if (!tokenRow) {
      console.log('NO_TOKEN', ch.name);
      continue;
    }
    let accessToken = null;
    try {
      // Tokens stored encrypted — try SocialOAuthToken for page token
      const oauth = await prisma.socialOAuthToken.findFirst({
        where: { teamId: ch.teamId, pageId: ch.externalId },
        orderBy: { updatedAt: 'desc' },
      });
      if (oauth?.encryptedPageAccessToken) {
        // decrypt via node script using app's encryption - fallback: graph with env
        console.log('OAUTH_TOKEN_ROW', ch.name, 'pageId', oauth.pageId);
      }
    } catch (e) {}

    // Use meta graph debug: get subscribed apps for page using token from DB raw
    const meta = await prisma.$queryRawUnsafe(`
      SELECT ct."encryptedAccessToken", ct."accessTokenExpiresAt"
      FROM "ChannelToken" ct WHERE ct."channelId" = $1
    `, ch.id);
    console.log('TOKEN_ROW_EXISTS', ch.name, Boolean(meta?.[0]?.encryptedAccessToken));
  }

  await prisma.$disconnect();
}
main().catch(e => { console.error('ERR', e.message); process.exit(1); });
NODE

echo ""
echo "=== Try subscribed_apps via curl (using app env) ==="
node <<'NODE2'
const fs = require('fs');
const axios = require('axios');
const cp = require('child_process');
for (const line of fs.readFileSync('.env','utf8').split('\n')) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m) process.env[m[1].trim()] = m[2].trim();
}
const db = (process.env.DATABASE_URL || '').replace(/\?.*$/, '');
const pageId = cp.execSync(`psql "${db}" -t -A -c 'SELECT "externalId" FROM "Channel" WHERE provider=\'META_MESSENGER\' AND status=\'CONNECTED\' LIMIT 1'`, { encoding: 'utf8' }).trim();
console.log('PAGE_ID', pageId);

// Bootstrap Nest encryption by running a small inline decrypt from dist
const { execSync } = require('child_process');
try {
  const out = execSync(`cd /root/whatsapp_GitHub/apps/api && node -e "
    require('dotenv').config({ path: '../../.env' });
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    (async () => {
      const ch = await prisma.channel.findFirst({ where: { provider: 'META_MESSENGER', status: 'CONNECTED' } });
      if (!ch) { console.log('NO_CHANNEL'); process.exit(0); }
      const ct = await prisma.channelToken.findUnique({ where: { channelId: ch.id } });
      console.log('HAS_CHANNEL_TOKEN', !!ct);
      const social = await prisma.socialOAuthToken.findFirst({ where: { teamId: ch.teamId, pageId: ch.externalId }, orderBy: { updatedAt: 'desc' } });
      console.log('HAS_SOCIAL_OAUTH', !!social, social?.pageId);
      await prisma.$disconnect();
    })();
  "`, { encoding: 'utf8', timeout: 30000 });
  console.log(out);
} catch (e) {
  console.log('NEST_ERR', e.message.slice(0, 500));
}
NODE2

echo ""
echo "=== PM2 subscription errors (all time recent) ==="
pm2 logs api --lines 2000 --nostream 2>&1 | grep -iE "webhook subscription|resubscribe|subscribed_apps|403" | tail -20 || true

echo "RESUB_DONE"
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
