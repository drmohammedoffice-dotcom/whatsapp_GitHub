#!/usr/bin/env python3
"""Point AI Gateway at Kie.ai (keys' real provider), deploy and verify."""
from __future__ import annotations

import os
import sys
from pathlib import Path

import paramiko

HOST = "161.97.140.171"
PASSWORD = os.environ.get("VPS_PASSWORD", "")
PROJECT = "/root/whatsapp_GitHub"
REPO = Path(__file__).resolve().parents[1]

UPLOAD_PATHS = [
    "apps/api/src/ai/gateway/ai-gateway-key-pool.service.ts",
    "apps/api/src/ai/gateway/ai-gateway.service.ts",
    "apps/api/src/config/env.ts",
    ".env.example",
]

ENV_UPDATES = {
    "AI_GATEWAY_BASE_URL": "https://api.kie.ai",
    "AI_GATEWAY_CHAT_MODEL": "gemini-3-flash",
}


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
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(HOST, username="root", password=PASSWORD, timeout=60)
    sftp = client.open_sftp()
    for rel in UPLOAD_PATHS:
        local = REPO / rel
        remote = f"{PROJECT}/{rel.replace(chr(92), '/')}"
        print("Upload", rel)
        sftp.put(str(local), remote)

    env_path = f"{PROJECT}/.env"
    with sftp.open(env_path, "r") as f:
        current = f.read().decode("utf-8", errors="replace")
    with sftp.open(env_path, "w") as f:
        f.write(upsert_env(current, ENV_UPDATES))
    print("Updated .env with Kie.ai gateway base URL + model")
    sftp.close()

    cmd = f"""
set -e
cd {PROJECT}
pnpm --filter @watsapp/api build
pm2 restart api worker --update-env
sleep 15
curl -sS -w '\\nhttp:%{{http_code}}\\n' https://almutamayiziq.com/api/v1/health || true
echo KIE_GATEWAY_OK
"""
    _, stdout, stderr = client.exec_command(cmd, timeout=900000)
    print(stdout.read().decode("utf-8", errors="replace"))
    err = stderr.read().decode("utf-8", errors="replace")
    if err.strip():
        print("STDERR:", err[-4000:], file=sys.stderr)
    code = stdout.channel.recv_exit_status()
    client.close()
    return code


if __name__ == "__main__":
    raise SystemExit(main())
