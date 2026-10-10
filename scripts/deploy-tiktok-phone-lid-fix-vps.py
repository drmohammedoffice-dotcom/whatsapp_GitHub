#!/usr/bin/env python3
"""Fix LID phone resolution, orphan channels, and pixel connection check."""
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
    "apps/api/src/modules/whatsapp/utils/disconnect.util.ts",
    "apps/api/src/modules/whatsapp/events.service.ts",
    "apps/api/src/modules/whatsapp/whatsapp.service.ts",
    "apps/api/src/channels/channels.service.ts",
    "apps/api/src/tiktok-integration/tiktok-tracking-phones.service.ts",
    "apps/api/src/modules/whatsapp/whatsapp.module.ts",
    "apps/api/src/modules/whatsapp/whatsapp.repository.ts",
    "apps/api/src/tiktok-integration/tiktok-integration-tracking.service.ts",
    "apps/api/src/tiktok-integration/tiktok-integration.service.ts",
]


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
    sftp.close()

    cmd = f"""
set -e
cd {PROJECT}
pnpm --filter @watsapp/api build
pm2 restart api --update-env
sleep 12
curl -sS -w '\\napi:%{{http_code}}\\n' https://almutamayiziq.com/api/v1/health
echo TIKTOK_PHONE_LID_FIX_OK
"""
    _, stdout, stderr = client.exec_command(cmd, timeout=600000)
    print(stdout.read().decode("utf-8", errors="replace"))
    err = stderr.read().decode("utf-8", errors="replace")
    if err.strip():
        print("STDERR:", err[-3000:], file=sys.stderr)
    code = stdout.channel.recv_exit_status()
    client.close()
    return code


if __name__ == "__main__":
    raise SystemExit(main())
