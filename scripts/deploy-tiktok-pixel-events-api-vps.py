#!/usr/bin/env python3
"""Deploy TikTok pixel base code on landing + Events API messaging."""
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
    "apps/api/src/tiktok-integration/tiktok-pixel-inline.ts",
    "apps/api/src/tiktok-integration/tiktok-integration-public.controller.ts",
    "apps/web/src/app/r/[slug]/page.tsx",
    "apps/web/src/lib/i18n/ar.ts",
    "apps/web/src/lib/i18n/en.ts",
]


def main() -> int:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(HOST, username="root", password=PASSWORD, timeout=90)
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
pnpm --filter @watsapp/web build
pm2 restart api web --update-env
sleep 16
curl -sS 'https://almutamayiziq.com/r/v3a21wcd?event=Contact' | tr '\\n' ' ' | grep -o 'ttq.load\\|analytics.tiktok.com\\|D9ALMSRC77U6HL2U7LGG' | head -5
curl -sS 'https://almutamayiziq.com/r/v3a21wcd?setup=1&event=Contact' | tr '\\n' ' ' | grep -o 'ttq.load\\|Event Builder\\|Launch' | head -5
echo TIKTOK_PIXEL_EVENTS_OK
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
