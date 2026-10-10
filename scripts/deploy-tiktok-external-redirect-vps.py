#!/usr/bin/env python3
"""Deploy TikTok Pixel destination selector: WhatsApp number or external URL."""
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
    "packages/database/prisma/schema.prisma",
    "packages/database/prisma/migrations/20260718150000_tiktok_external_redirect/migration.sql",
    "apps/api/src/tiktok-integration/dto/tiktok-integration.dto.ts",
    "apps/api/src/tiktok-integration/tiktok-integration.service.ts",
    "apps/api/src/tiktok-integration/tiktok-integration-tracking.service.ts",
    "apps/api/src/tiktok-integration/tiktok-integration-public.controller.ts",
    "apps/web/src/lib/tiktok-integration.ts",
    "apps/web/src/app/tiktok/integration/wizard/page.tsx",
    "apps/web/src/components/tiktok/pixel-edit-dialog.tsx",
    "apps/web/src/lib/i18n/ar.ts",
    "apps/web/src/lib/i18n/en.ts",
    "apps/web/src/lib/i18n/types.ts",
]


def ensure_remote_dir(sftp: paramiko.SFTPClient, path: str) -> None:
    current = ""
    for part in path.strip("/").split("/"):
        current += "/" + part
        try:
            sftp.stat(current)
        except IOError:
            sftp.mkdir(current)


def main() -> int:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(HOST, username="root", password=PASSWORD, timeout=60)
    sftp = client.open_sftp()
    for rel in UPLOAD_PATHS:
        remote = f"{PROJECT}/{rel}"
        ensure_remote_dir(sftp, remote.rsplit("/", 1)[0])
        sftp.put(str(REPO / rel), remote)
        print("uploaded", rel)
    sftp.close()

    cmd = f"""
set -e
cd {PROJECT}
pnpm --filter @watsapp/database exec prisma migrate deploy
pnpm --filter @watsapp/database exec prisma generate
pnpm --filter @watsapp/api build
pnpm --filter @watsapp/web build
pm2 restart api worker web --update-env
sleep 15
curl -sS -w '\\napi http:%{{http_code}}\\n' https://almutamayiziq.com/api/v1/health
curl -sS -o /dev/null -w 'web http:%{{http_code}}\\n' https://almutamayiziq.com/tiktok/integration/wizard
echo TIKTOK_EXTERNAL_REDIRECT_DEPLOY_OK
"""
    _, stdout, stderr = client.exec_command(cmd, timeout=1800)
    print(stdout.read().decode("utf-8", errors="replace"))
    err = stderr.read().decode("utf-8", errors="replace")
    if err.strip():
        print("STDERR:", err[-5000:], file=sys.stderr)
    code = stdout.channel.recv_exit_status()
    client.close()
    return code


if __name__ == "__main__":
    raise SystemExit(main())
