#!/usr/bin/env python3
"""Deploy TikTok tracking WhatsApp phones page."""
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
    "apps/api/src/channels/channel-purpose.ts",
    "apps/api/src/channels/channels.service.ts",
    "apps/api/src/channels/channel-message.service.ts",
    "apps/api/src/conversations/conversations.service.ts",
    "apps/api/src/modules/whatsapp/dto/connect-whatsapp.dto.ts",
    "apps/api/src/modules/whatsapp/whatsapp.controller.ts",
    "apps/api/src/modules/whatsapp/whatsapp.service.ts",
    "apps/api/src/modules/whatsapp/whatsapp.module.ts",
    "apps/api/src/tiktok-integration/tiktok-integration-tracking.service.ts",
    "apps/api/src/tiktok-integration/tiktok-integration.controller.ts",
    "apps/api/src/tiktok-integration/tiktok-integration.module.ts",
    "apps/api/src/tiktok-integration/tiktok-tracking-phones.service.ts",
    "apps/web/src/app/tiktok/integration/phones/page.tsx",
    "apps/web/src/app/tiktok/integration/page.tsx",
    "apps/web/src/lib/tiktok-integration.ts",
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
        remote_dir = os.path.dirname(remote).replace("\\", "/")
        try:
            sftp.stat(remote_dir)
        except OSError:
            parts = remote_dir.split("/")
            path = ""
            for part in parts:
                if not part:
                    continue
                path += f"/{part}"
                try:
                    sftp.stat(path)
                except OSError:
                    sftp.mkdir(path)
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
curl -sS -o /dev/null -w 'api:%{{http_code}}\\n' https://almutamayiziq.com/api/v1/health
echo TRACKING_PHONES_OK
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
