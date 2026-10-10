#!/usr/bin/env python3
"""Deploy pixel base code on /r tracking pages for Event Builder."""
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
    "apps/web/src/app/r/[slug]/page.tsx",
    "apps/web/src/components/tiktok/tiktok-redirect-client.tsx",
    "apps/api/src/tiktok-integration/tiktok-integration.constants.ts",
    "apps/api/src/tiktok-integration/tiktok-integration.service.ts",
    "apps/web/src/lib/tiktok-integration.ts",
    "apps/web/src/app/tiktok/integration/page.tsx",
    "apps/web/src/lib/i18n/en.ts",
    "apps/web/src/lib/i18n/ar.ts",
    "apps/web/src/lib/i18n/types.ts",
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
pnpm --filter @watsapp/web build
pm2 restart api web --update-env
sleep 8
# verify pixel script appears on a tracking page (any redirect slug from API not needed)
curl -sS 'https://almutamayiziq.com/r/v3a21wcd?setup=1&event=Contact' | tr '\\n' ' ' | grep -o 'analytics.tiktok.com[^\" ]*' | head -3
curl -sS 'https://almutamayiziq.com/r/v3a21wcd?setup=1&event=Contact' | tr '\\n' ' ' | grep -o 'ttq.load([^)]*)' | head -3
curl -sS -o /dev/null -w 'api:%{{http_code}}\\n' https://almutamayiziq.com/api/v1/health
echo PIXEL_EVENT_BUILDER_OK
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
