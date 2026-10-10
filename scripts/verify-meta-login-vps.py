#!/usr/bin/env python3
"""Verify POST /api/auth/meta/login returns Facebook authUrl on production."""
from __future__ import annotations

import os
import sys

import paramiko

HOST = "161.97.140.171"
USER = "root"
PASSWORD = os.environ.get("VPS_PASSWORD", "")

VERIFY_NODE = r"""
cd /root/whatsapp_GitHub
node <<'NODE'
const fs = require('fs');
const http = require('http');
const { execSync } = require('child_process');

function loadEnv() {
  for (const line of fs.readFileSync('.env', 'utf8').split('\n')) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim();
  }
}
loadEnv();

const jwtPath = execSync(
  "find /root/whatsapp_GitHub/node_modules/.pnpm -maxdepth 3 -type d -path '*/jsonwebtoken@*/node_modules/jsonwebtoken' 2>/dev/null | head -1",
  { encoding: 'utf8' },
).trim();
const jwt = require(jwtPath);

const dbUrl = (process.env.DATABASE_URL || '').replace(/\?.*$/, '');
const row = execSync(
  `psql "${dbUrl}" -t -A -F '|' -c "SELECT \\"userId\\", \\"teamId\\" FROM \\"TeamMember\\" ORDER BY \\"createdAt\\" ASC LIMIT 1"`,
  { encoding: 'utf8' },
).trim();
const [userId, teamId] = row.split('|');
const token = jwt.sign({ sub: userId, teamId }, process.env.JWT_ACCESS_SECRET, { expiresIn: '15m' });

function post(path, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: 4000,
        path,
        method: 'POST',
        headers: {
          authorization: `Bearer ${token}`,
          'content-type': 'application/json',
          'content-length': Buffer.byteLength(data),
        },
      },
      (res) => {
        let raw = '';
        res.on('data', (c) => (raw += c));
        res.on('end', () => resolve({ status: res.statusCode, raw }));
      },
    );
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

(async () => {
  console.log('META_ENV', 'APP_ID=' + (process.env.META_APP_ID || 'missing'));
  const local = await post('/api/auth/meta/login', {});
  console.log('LOCAL_STATUS', local.status);
  console.log('LOCAL_BODY', local.raw.slice(0, 600));
  const body = JSON.parse(local.raw);
  if (body.authUrl && body.authUrl.includes('facebook.com') && body.authUrl.includes('1519180079681851')) {
    const scope = decodeURIComponent((body.authUrl.match(/scope=([^&]+)/) ?? [])[1] ?? '');
    const bad = ['instagram_basic', 'instagram_manage_messages'].filter((s) => scope.includes(s));
    if (bad.length) {
      console.log('INVALID_SCOPES', bad.join(','));
      process.exit(4);
    }
    console.log('SCOPES_OK', scope);
    console.log('SUCCESS authUrl=', body.authUrl.slice(0, 100) + '...');
    process.exit(0);
  }
  if (body.message) console.log('ERROR_MESSAGE', body.message);
  process.exit(2);
})().catch((e) => {
  console.error(e);
  process.exit(3);
});
NODE
"""

HTTPS_TEST = r"""
cd /root/whatsapp_GitHub
TOKEN=$(node <<'NODE'
const fs = require('fs');
const cp = require('child_process');
for (const line of fs.readFileSync('.env', 'utf8').split('\n')) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m) process.env[m[1].trim()] = m[2].trim();
}
const jwtPath = cp.execSync(
  "find /root/whatsapp_GitHub/node_modules/.pnpm -maxdepth 3 -type d -path '*/jsonwebtoken@*/node_modules/jsonwebtoken' 2>/dev/null | head -1",
  { encoding: 'utf8' },
).trim();
const j = require(jwtPath);
const db = (process.env.DATABASE_URL || '').replace(/\?.*$/, '');
const row = cp.execSync(
  `psql "${db}" -t -A -F '|' -c "SELECT \\"userId\\", \\"teamId\\" FROM \\"TeamMember\\" ORDER BY \\"createdAt\\" ASC LIMIT 1"`,
  { encoding: 'utf8' },
).trim();
const [userId, teamId] = row.split('|');
process.stdout.write(j.sign({ sub: userId, teamId }, process.env.JWT_ACCESS_SECRET, { expiresIn: '15m' }));
NODE
)
curl -sS -X POST https://almutamayiziq.com/api/auth/meta/login \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}' \
  -w "\nHTTPS_STATUS:%{http_code}\n"
"""

FACEBOOK_PAGE_TEST = r"""
cd /root/whatsapp_GitHub
AUTH=$(node <<'NODE'
const fs = require('fs');
const http = require('http');
const cp = require('child_process');
for (const line of fs.readFileSync('.env', 'utf8').split('\n')) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m) process.env[m[1].trim()] = m[2].trim();
}
const jwtPath = cp.execSync(
  "find /root/whatsapp_GitHub/node_modules/.pnpm -maxdepth 3 -type d -path '*/jsonwebtoken@*/node_modules/jsonwebtoken' 2>/dev/null | head -1",
  { encoding: 'utf8' },
).trim();
const j = require(jwtPath);
const db = (process.env.DATABASE_URL || '').replace(/\?.*$/, '');
const row = cp.execSync(
  `psql "${db}" -t -A -F '|' -c "SELECT \\"userId\\", \\"teamId\\" FROM \\"TeamMember\\" ORDER BY \\"createdAt\\" ASC LIMIT 1"`,
  { encoding: 'utf8' },
).trim();
const [userId, teamId] = row.split('|');
const token = j.sign({ sub: userId, teamId }, process.env.JWT_ACCESS_SECRET, { expiresIn: '15m' });
http.request(
  { hostname: '127.0.0.1', port: 4000, path: '/api/auth/meta/login', method: 'POST', headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json', 'content-length': 2 } },
  (res) => { let r = ''; res.on('data', (c) => (r += c)); res.on('end', () => process.stdout.write(JSON.parse(r).authUrl)); },
).end('{}');
NODE
)
curl -sS -o /dev/null -w "facebook-oauth-head:%{http_code}\n" -A "Mozilla/5.0" -I "$AUTH"
"""


def run(client: paramiko.SSHClient, script: str, timeout: int = 60) -> str:
    _, stdout, stderr = client.exec_command(script, timeout=timeout)
    out = stdout.read().decode("utf-8", errors="replace")
    err = stderr.read().decode("utf-8", errors="replace")
    if err.strip():
        print("stderr:", err)
    return out


def main() -> int:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(HOST, username=USER, password=PASSWORD, timeout=30)

    out = run(client, VERIFY_NODE)
    print(out)
    ok_local = "SUCCESS authUrl=" in out

    https_out = run(client, HTTPS_TEST)
    print("\nPublic HTTPS test:\n", https_out)
    ok_https = "facebook.com" in https_out and "HTTPS_STATUS:201" in https_out

    if ok_local:
        fb_out = run(client, FACEBOOK_PAGE_TEST)
        print("\nFacebook OAuth URL reachability:\n", fb_out)
        ok_fb = "facebook-oauth-head:200" in fb_out or "facebook-oauth-head:302" in fb_out
    else:
        ok_fb = False

    client.close()
    return 0 if ok_local and ok_https and ok_fb else 1


if __name__ == "__main__":
    raise SystemExit(main())
