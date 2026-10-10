#!/usr/bin/env python3
"""Check Meta app dev mode and page messaging setup."""
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
const crypto = require('crypto');
const https = require('https');
const cp = require('child_process');

for (const line of fs.readFileSync('.env','utf8').split('\n')) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m) process.env[m[1].trim()] = m[2].trim();
}
const db = (process.env.DATABASE_URL || '').replace(/\?.*$/, '');
function q(sql) {
  return cp.execSync(`psql "${db}" -t -A -c ${JSON.stringify(sql)}`, { encoding: 'utf8' }).trim();
}
function decryptJson(payload) {
  const key = crypto.createHash('sha256').update(process.env.ENCRYPTION_KEY || '').digest();
  const raw = Buffer.from(payload, 'base64url');
  const iv = raw.subarray(0, 12);
  const tag = raw.subarray(12, 28);
  const ciphertext = raw.subarray(28);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return JSON.parse(Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8'));
}
function get(path, token) {
  return new Promise((resolve, reject) => {
    const url = `https://graph.facebook.com/v21.0${path}${path.includes('?')?'&':'?'}access_token=${encodeURIComponent(token)}`;
    https.get(url, res => { let b=''; res.on('data',c=>b+=c); res.on('end',()=>{ try{resolve(JSON.parse(b));}catch{resolve(b);} }); }).on('error', reject);
  });
}

(async () => {
  const appId = process.env.META_APP_ID;
  const appToken = appId + '|' + process.env.META_APP_SECRET;

  const app = await get(`/${appId}?fields=name,restrictions,an_restrictions`, appToken);
  console.log('APP_INFO', JSON.stringify(app, null, 2));

  const row = q('SELECT c."externalId" || \'|\' || ct."encryptedAccessToken" FROM "Channel" c JOIN "ChannelToken" ct ON ct."channelId"=c.id WHERE c.provider=\'META_MESSENGER\' AND c.status=\'CONNECTED\' LIMIT 1');
  const [pageId, enc] = row.split('|');
  const pageToken = decryptJson(enc);

  const subs = await get(`/${pageId}/subscribed_apps`, pageToken);
  console.log('PAGE_SUBSCRIBED_APPS', JSON.stringify(subs, null, 2));

  // Conversations API - check if page can read messages (needs pages_messaging)
  const convs = await get(`/${pageId}/conversations?fields=participants,messages.limit(1){message,from,created_time}&limit=3`, pageToken);
  console.log('PAGE_CONVERSATIONS', JSON.stringify(convs, null, 2));

  // Check nginx for ANY facebook/meta webhook posts
  try {
    const nginx = cp.execSync('grep "POST /api/webhooks/meta" /var/log/nginx/access.log 2>/dev/null | wc -l', { encoding: 'utf8' }).trim();
    console.log('NGINX_WEBHOOK_POST_COUNT', nginx);
    const fbPosts = cp.execSync('grep "POST /api/webhooks/meta" /var/log/nginx/access.log 2>/dev/null | grep -v curl | tail -5 || true', { encoding: 'utf8' }).trim();
    console.log('NGINX_NON_CURL_POSTS', fbPosts || '(none - Meta never POSTed)');
  } catch (e) { console.log('NGINX_ERR', e.message); }
})();
NODE
"""

def main():
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(HOST, username=USER, password=PASSWORD, timeout=60, banner_timeout=60)
    _, stdout, _ = c.exec_command(REMOTE, timeout=90)
    print(stdout.read().decode())
    c.close()

if __name__ == '__main__':
    main()
