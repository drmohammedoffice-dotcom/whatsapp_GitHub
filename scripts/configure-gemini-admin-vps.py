#!/usr/bin/env python3
"""
Configure platform Gemini API key + reset admin password on VPS.

Usage (from repo root):
  set GEMINI_API_KEY=...
  set ADMIN_NEW_PASSWORD=...
  python scripts/configure-gemini-admin-vps.py

Never commit secrets into this file.
"""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path

import paramiko

HOST = "161.97.140.171"
PASSWORD = os.environ.get("VPS_PASSWORD", "")
PROJECT = "/root/whatsapp_GitHub"
ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "drmohammedoffice@gmail.com").lower()
ADMIN_NEW_PASSWORD = os.environ.get("ADMIN_NEW_PASSWORD", "")
GEMINI_API_KEY = (os.environ.get("GEMINI_API_KEY") or "").strip()

GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/openai"
GEMINI_CHAT_MODEL = os.environ.get("GEMINI_CHAT_MODEL", "gemini-3.6-flash")
GEMINI_IMAGE_MODEL = os.environ.get("GEMINI_IMAGE_MODEL", "gemini-3.1-flash-image")


def upsert_env(content: str, updates: dict[str, str]) -> str:
    lines = content.splitlines()
    seen: set[str] = set()
    out: list[str] = []
    for line in lines:
        if "=" in line and not line.strip().startswith("#"):
            key = line.split("=", 1)[0].strip()
            if key in updates:
                out.append(f"{key}={updates[key]}")
                seen.add(key)
                continue
        out.append(line)
    for key, value in updates.items():
        if key not in seen:
            out.append(f"{key}={value}")
    return "\n".join(out) + "\n"


def main() -> int:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    if not GEMINI_API_KEY:
        print("Missing GEMINI_API_KEY env var", file=sys.stderr)
        return 1
    if not ADMIN_NEW_PASSWORD:
        print("Missing ADMIN_NEW_PASSWORD env var", file=sys.stderr)
        return 1

    env_updates = {
        # Platform AI Gateway / smart reply / auto-reply
        "AI_API_KEY": GEMINI_API_KEY,
        "AI_API_KEY_1": GEMINI_API_KEY,
        "AI_API_BASE_URL": GEMINI_BASE,
        "AI_CHAT_MODEL": GEMINI_CHAT_MODEL,
        "AI_GATEWAY_BASE_URL": GEMINI_BASE,
        "AI_GATEWAY_CHAT_MODEL": GEMINI_CHAT_MODEL,
        # Creative Studio + assistant (OpenAI-compatible client pointed at Gemini)
        "OPENAI_API_KEY": GEMINI_API_KEY,
        "OPENAI_API_BASE_URL": GEMINI_BASE,
        "CREATIVE_OPENAI_TEXT_MODEL": GEMINI_CHAT_MODEL,
        "CREATIVE_OPENAI_IMAGE_MODEL": GEMINI_IMAGE_MODEL,
        "CREATIVE_GEMINI_IMAGE_MODEL": GEMINI_IMAGE_MODEL,
        "CREATIVE_GEMINI_VIDEO_MODEL": os.environ.get("GEMINI_VIDEO_MODEL", "veo-3.1-generate-preview"),
        # Transcription / multimodal labels
        "AI_TRANSCRIPTION_API_KEY": GEMINI_API_KEY,
        "AI_TRANSCRIPTION_BASE_URL": GEMINI_BASE,
        "AI_TRANSCRIPTION_CHAT_MODEL": GEMINI_CHAT_MODEL,
    }

    node_script = (
        "const bcrypt = require('./apps/api/node_modules/bcryptjs');\n"
        "const { PrismaClient } = require('./node_modules/.pnpm/@prisma+client@6.19.3_prisma@6.19.3_typescript@6.0.3__typescript@6.0.3/node_modules/@prisma/client');\n"
        "const p = new PrismaClient();\n"
        "(async () => {\n"
        f"  const email = {json.dumps(ADMIN_EMAIL)};\n"
        f"  const newPassword = {json.dumps(ADMIN_NEW_PASSWORD)};\n"
        "  const user = await p.user.findUnique({ where: { email }, include: { adminProfile: true } });\n"
        "  if (!user || !user.adminProfile || !user.adminProfile.isActive) {\n"
        "    console.log('ADMIN_RESET_FAIL:no_active_admin');\n"
        "    return;\n"
        "  }\n"
        "  const hash = await bcrypt.hash(newPassword, 12);\n"
        "  await p.user.update({ where: { id: user.id }, data: { passwordHash: hash } });\n"
        "  const ok = await bcrypt.compare(newPassword, hash);\n"
        "  console.log('ADMIN_RESET_OK:' + email + ':verify=' + ok);\n"
        "  await p.$disconnect();\n"
        "})().catch((e) => { console.error(e); process.exit(1); });\n"
    )

    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(HOST, username="root", password=PASSWORD, timeout=60)
    sftp = client.open_sftp()

    env_path = f"{PROJECT}/.env"
    with sftp.open(env_path, "r") as f:
        current = f.read().decode("utf-8", errors="replace")
    with sftp.open(env_path, "w") as f:
        f.write(upsert_env(current, env_updates))
    print("Updated VPS .env for Gemini (platform AI + creative + transcription)")

    # Mirror into apps/api/.env if present (some processes load from there)
    api_env = f"{PROJECT}/apps/api/.env"
    try:
        with sftp.open(api_env, "r") as f:
            api_current = f.read().decode("utf-8", errors="replace")
        with sftp.open(api_env, "w") as f:
            f.write(upsert_env(api_current, env_updates))
        print("Updated apps/api/.env")
    except OSError:
        print("apps/api/.env not present — skipped")

    with sftp.file(f"{PROJECT}/reset-admin-password.js", "w") as f:
        f.write(node_script)
    sftp.close()

    _, stdout, stderr = client.exec_command(
        f"cd {PROJECT} && node reset-admin-password.js",
        timeout=60000,
    )
    out = stdout.read().decode("utf-8", errors="replace").strip()
    err = stderr.read().decode("utf-8", errors="replace").strip()
    print(out)
    if err:
        print("ADMIN_STDERR:", err[-2000:], file=sys.stderr)
    if "ADMIN_RESET_OK" not in out:
        client.close()
        return 1

    cmd = f"""
set -e
cd {PROJECT}
pm2 restart api worker --update-env
sleep 12
# Smoke-test Gemini OpenAI-compatible chat (key from env file, do not echo key)
python3 - <<'PY'
import os, urllib.request, json
from pathlib import Path
env = {{}}
for line in Path('{PROJECT}/.env').read_text(encoding='utf-8', errors='replace').splitlines():
    if '=' in line and not line.strip().startswith('#'):
        k,v = line.split('=',1)
        env[k.strip()] = v.strip()
key = env.get('AI_API_KEY_1') or env.get('AI_API_KEY') or ''
base = (env.get('AI_GATEWAY_BASE_URL') or env.get('AI_API_BASE_URL') or '').rstrip('/')
model = env.get('AI_GATEWAY_CHAT_MODEL') or env.get('AI_CHAT_MODEL') or 'gemini-2.0-flash'
req = urllib.request.Request(
    base + '/chat/completions',
    data=json.dumps({{
        'model': model,
        'messages': [{{'role':'user','content':'Reply with exactly: OK'}}],
        'max_tokens': 8,
    }}).encode(),
    headers={{'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json'}},
    method='POST',
)
try:
    with urllib.request.urlopen(req, timeout=45) as r:
        body = r.read().decode('utf-8', errors='replace')
        print('GEMINI_SMOKE_HTTP', r.status)
        print('GEMINI_SMOKE_OK' if 'OK' in body or 'choices' in body else 'GEMINI_SMOKE_UNEXPECTED')
except Exception as e:
    print('GEMINI_SMOKE_FAIL', type(e).__name__, str(e)[:300])
PY
curl -sS -o /dev/null -w 'health:%{{http_code}}\\n' https://almutamayiziq.com/api/v1/health || true
rm -f {PROJECT}/reset-admin-password.js
echo GEMINI_ADMIN_CONFIG_OK
"""
    _, stdout2, stderr2 = client.exec_command(cmd, timeout=180000)
    print(stdout2.read().decode("utf-8", errors="replace"))
    err2 = stderr2.read().decode("utf-8", errors="replace")
    if err2.strip():
        print("STDERR:", err2[-3000:], file=sys.stderr)

    # Verify admin login without printing password in success detail beyond confirmation
    payload = json.dumps({"email": ADMIN_EMAIL, "password": ADMIN_NEW_PASSWORD})
    curl = (
        "curl -sS -X POST https://almutamayiziq.com/api/v1/admin/auth/login "
        "-H 'content-type: application/json' "
        f"-d {json.dumps(payload)}"
    )
    _, stdout3, _ = client.exec_command(curl, timeout=30000)
    login_resp = stdout3.read().decode("utf-8", errors="replace")
    print("ADMIN_LOGIN_OK:", "accessToken" in login_resp)
    client.close()

    print("\n--- Done ---")
    print(f"Admin email: {ADMIN_EMAIL}")
    print("Admin password: (set as requested)")
    print("URL: https://almutamayiziq.com/admin/login")
    print("Gemini base:", GEMINI_BASE)
    print("Gemini model:", GEMINI_CHAT_MODEL)
    return 0 if "accessToken" in login_resp else 1


if __name__ == "__main__":
    raise SystemExit(main())
