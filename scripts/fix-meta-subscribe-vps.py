#!/usr/bin/env python3
"""Fix Meta page webhook subscription on VPS using psql + Graph API."""
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

function graph(method, path, token, params = {}) {
  return new Promise((resolve, reject) => {
    const qs = new URLSearchParams({ ...params, access_token: token }).toString();
    const url = `https://graph.facebook.com/v21.0${path}?${qs}`;
    const req = https.request(url, { method }, (res) => {
      let body = '';
      res.on('data', (c) => body += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(body) }); }
        catch { resolve({ status: res.statusCode, data: body }); }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

(async () => {
  const rows = q('SELECT c.id || \'|\' || c.name || \'|\' || c."externalId" || \'|\' || ct."encryptedAccessToken" FROM "Channel" c JOIN "ChannelToken" ct ON ct."channelId" = c.id WHERE c.provider=\'META_MESSENGER\' AND c.status=\'CONNECTED\'');

  if (!rows) { console.log('NO_CHANNELS'); return; }

  for (const line of rows.split('\n').filter(Boolean)) {
    const [id, name, pageId, enc] = line.split('|');
    console.log('\n===', name, 'pageId=' + pageId, '===');
    let token;
    try {
      token = decryptJson(enc);
      console.log('TOKEN decrypted OK');
    } catch (e) {
      console.log('DECRYPT_FAIL', e.message);
      continue;
    }

    const info = await graph('GET', `/${pageId}`, token, { fields: 'id,name,tasks' });
    console.log('PAGE', JSON.stringify(info.data));

    const before = await graph('GET', `/${pageId}/subscribed_apps`, token);
    console.log('SUBS_BEFORE', JSON.stringify(before.data));

    const sub = await graph('POST', `/${pageId}/subscribed_apps`, token, {
      subscribed_fields: 'messages,messaging_postbacks,message_reads,messaging_handovers',
    });
    console.log('SUBSCRIBE status=' + sub.status, JSON.stringify(sub.data));

    const after = await graph('GET', `/${pageId}/subscribed_apps`, token);
    console.log('SUBS_AFTER', JSON.stringify(after.data));
  }

  console.log('\nWEBHOOK_EVENTS', q(`SELECT COUNT(*) FROM "IntegrationWebhookEvent" WHERE provider='META'`));
})().catch(e => { console.error('FATAL', e); process.exit(1); });
NODE
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
