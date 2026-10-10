#!/usr/bin/env python3
"""Configure Meta OAuth env vars on production VPS and verify login endpoint."""
from __future__ import annotations

import json
import os
import re
import secrets
import sys

import paramiko

HOST = "161.97.140.171"
USER = "root"
PASSWORD = os.environ.get("VPS_PASSWORD", "")
PROJECT_DIR = "/root/whatsapp_GitHub"
ENV_PATH = f"{PROJECT_DIR}/.env"

META_APP_ID = "1519180079681851"
META_APP_SECRET = "2b2bc8661b25b8f3f83a143447261109"
META_AUTH_REDIRECT_URI = "https://almutamayiziq.com/api/auth/meta/callback"
META_VERIFY_TOKEN = os.environ.get("META_VERIFY_TOKEN", "chatloora-meta-verify-2026")


def run(client: paramiko.SSHClient, cmd: str, timeout: int = 120) -> tuple[int, str, str]:
    _, stdout, stderr = client.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode("utf-8", errors="replace")
    err = stderr.read().decode("utf-8", errors="replace")
    code = stdout.channel.recv_exit_status()
    return code, out, err


def upsert_env(content: str, key: str, value: str) -> str:
    pattern = re.compile(rf"^{re.escape(key)}=.*$", re.MULTILINE)
    line = f"{key}={value}"
    if pattern.search(content):
        return pattern.sub(line, content)
    if content and not content.endswith("\n"):
        content += "\n"
    return content + line + "\n"


def main() -> int:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    print(f"Connecting to {USER}@{HOST}...")
    client.connect(HOST, username=USER, password=PASSWORD, timeout=30)

    sftp = client.open_sftp()
    try:
        with sftp.file(ENV_PATH, "r") as f:
            env_text = f.read().decode("utf-8", errors="replace")
    except FileNotFoundError:
        env_text = ""

    # Preserve existing verify token if already set
    existing_verify = re.search(r"^META_VERIFY_TOKEN=(.+)$", env_text, re.MULTILINE)
    verify_token = existing_verify.group(1).strip() if existing_verify else META_VERIFY_TOKEN

    env_text = upsert_env(env_text, "META_APP_ID", META_APP_ID)
    env_text = upsert_env(env_text, "META_APP_SECRET", META_APP_SECRET)
    env_text = upsert_env(env_text, "META_AUTH_REDIRECT_URI", META_AUTH_REDIRECT_URI)
    env_text = upsert_env(env_text, "META_VERIFY_TOKEN", verify_token)

    with sftp.file(ENV_PATH, "w") as f:
        f.write(env_text)
    sftp.close()
    print(f"Updated {ENV_PATH} (secrets masked in output)")
    print(f"  META_APP_ID={META_APP_ID}")
    print(f"  META_AUTH_REDIRECT_URI={META_AUTH_REDIRECT_URI}")
    print(f"  META_VERIFY_TOKEN={verify_token[:8]}...")

    _, out, _ = run(client, f"grep -E '^META_' {ENV_PATH} | sed 's/SECRET=.*/SECRET=***/'")
    print("\nVPS META vars:\n", out)

    print("\nRestarting PM2 api...")
    _, out, err = run(client, "pm2 restart api --update-env && sleep 6 && pm2 status api")
    print(out)
    if err.strip():
        print("stderr:", err)

    # Verify meta login returns Facebook authUrl (JWT signed from DB user)
    test_script = r"""
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

(async () => {
const body = await new Promise((resolve, reject) => {
  const req = http.request({
    hostname: '127.0.0.1',
    port: 4000,
    path: '/api/auth/meta/login',
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      'content-length': 2,
    },
  }, (res) => {
    let raw = '';
    res.on('data', (c) => (raw += c));
    res.on('end', () => resolve({ status: res.statusCode, raw }));
  });
  req.on('error', reject);
  req.write('{}');
  req.end();
});

console.log('META_LOGIN_STATUS', body.status);
console.log('META_LOGIN_BODY', body.raw.slice(0, 500));
try {
  const parsed = JSON.parse(body.raw);
  if (parsed.authUrl && parsed.authUrl.includes('facebook.com')) {
    console.log('META_OAUTH_OK', 'authUrl starts with facebook.com');
    process.exit(0);
  }
  if (parsed.message) console.log('META_OAUTH_ERROR', parsed.message);
} catch (e) {
  console.log('META_OAUTH_PARSE_ERROR', e.message);
}
process.exit(2);
})().catch((e) => { console.error(e); process.exit(3); });
NODE
"""
    code, out, err = run(client, test_script, timeout=60)
    print("\nMeta login test:\n", out)
    if err.strip():
        print("test stderr:", err)

    # Public health + callback route
    _, curl_out, _ = run(
        client,
        'curl -sS -o /dev/null -w "health:%{http_code}\n" https://almutamayiziq.com/api/v1/health; '
        'curl -sS -o /dev/null -w "meta-callback:%{http_code}\n" '
        '"https://almutamayiziq.com/api/auth/meta/callback?code=test&state=test"',
    )
    print("\nPublic routes:\n", curl_out)

    client.close()
    return 0 if "META_OAUTH_OK" in out else 1


if __name__ == "__main__":
    raise SystemExit(main())
