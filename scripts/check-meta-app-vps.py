#!/usr/bin/env python3
"""Check Meta app webhook config and app mode on VPS."""
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

function get(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => {
        try { resolve(JSON.parse(body)); } catch { resolve(body); }
      });
    }).on('error', reject);
  });
}

(async () => {
  const appId = process.env.META_APP_ID;
  const secret = process.env.META_APP_SECRET;
  const token = appId + '|' + secret;

  const app = await get(`https://graph.facebook.com/v21.0/${appId}?fields=name,category,app_domains,website_url&access_token=${encodeURIComponent(token)}`);
  console.log('APP', JSON.stringify(app, null, 2));

  const subs = await get(`https://graph.facebook.com/v21.0/${appId}/subscriptions?access_token=${encodeURIComponent(token)}`);
  console.log('APP_SUBSCRIPTIONS', JSON.stringify(subs, null, 2));

  // App roles / mode hint
  const roles = await get(`https://graph.facebook.com/v21.0/${appId}/roles?access_token=${encodeURIComponent(token)}`);
  console.log('APP_ROLES', JSON.stringify(roles, null, 2));
})().catch(e => console.error('ERR', e.message));
NODE
"""

def main():
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(HOST, username=USER, password=PASSWORD, timeout=30)
    _, stdout, _ = c.exec_command(REMOTE, timeout=60)
    print(stdout.read().decode())
    c.close()

if __name__ == '__main__':
    main()
