#!/usr/bin/env python3
"""Configure Meta app-level webhook subscription on VPS."""
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
const https = require('https');
for (const line of fs.readFileSync('.env','utf8').split('\n')) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m) process.env[m[1].trim()] = m[2].trim();
}

const appId = process.env.META_APP_ID;
const secret = process.env.META_APP_SECRET;
const verifyToken = process.env.META_VERIFY_TOKEN;
const callbackUrl = 'https://almutamayiziq.com/api/webhooks/meta';
const appToken = appId + '|' + secret;

function request(method, path, params) {
  return new Promise((resolve, reject) => {
    const qs = new URLSearchParams({ ...params, access_token: appToken }).toString();
    const url = `https://graph.facebook.com/v21.0${path}?${qs}`;
    const req = https.request(url, { method }, (res) => {
      let body = '';
      res.on('data', c => body += c);
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
  console.log('Configuring app webhook...');
  console.log('callback_url:', callbackUrl);
  console.log('verify_token:', verifyToken ? verifyToken.slice(0, 8) + '...' : 'MISSING');

  const result = await request('POST', `/${appId}/subscriptions`, {
    object: 'page',
    callback_url: callbackUrl,
    verify_token: verifyToken,
    fields: 'messages,messaging_postbacks,message_reads,messaging_handovers',
    include_values: 'true',
  });
  console.log('SUBSCRIBE_APP status=' + result.status, JSON.stringify(result.data, null, 2));

  const subs = await request('GET', `/${appId}/subscriptions`, {});
  console.log('APP_SUBSCRIPTIONS_AFTER', JSON.stringify(subs.data, null, 2));
})().catch(e => console.error('ERR', e.message));
NODE
"""

def main():
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(HOST, username=USER, password=PASSWORD, timeout=30)
    _, stdout, stderr = c.exec_command(REMOTE, timeout=60)
    print(stdout.read().decode())
    err = stderr.read().decode()
    if err.strip(): print(err, file=sys.stderr)
    c.close()

if __name__ == '__main__':
    main()
