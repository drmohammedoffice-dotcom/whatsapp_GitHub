#!/usr/bin/env python3
"""Deploy TikTok Contact-only conversion system."""
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
    "packages/database/prisma/migrations/20260713140000_tiktok_contact_only_conversions/migration.sql",
    "apps/api/src/queues/queues.constants.ts",
    "apps/api/src/queues/queues.module.ts",
    "apps/api/src/integrations/tiktok-login-kit/tiktok-ads.service.ts",
    "apps/api/src/tiktok-integration/tiktok-contact-hash.ts",
    "apps/api/src/tiktok-integration/tiktok-integration.constants.ts",
    "apps/api/src/tiktok-integration/tiktok-integration-tracking.service.ts",
    "apps/api/src/tiktok-integration/tiktok-integration-activation.service.ts",
    "apps/api/src/tiktok-integration/tiktok-integration.service.ts",
    "apps/api/src/tiktok-integration/tiktok-integration.controller.ts",
    "apps/api/src/tiktok-integration/tiktok-integration.module.ts",
    "apps/api/src/tiktok-integration/tiktok-contact.processor.ts",
    "apps/web/src/lib/tiktok-integration.ts",
    "apps/web/src/lib/i18n/en.ts",
    "apps/web/src/lib/i18n/ar.ts",
    "apps/web/src/lib/i18n/types.ts",
    "apps/web/src/app/tiktok/integration/debug/page.tsx",
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
        remote_dir = remote.rsplit("/", 1)[0]
        try:
            sftp.stat(remote_dir)
        except FileNotFoundError:
            print("mkdir", remote_dir)
            stdin, stdout, stderr = client.exec_command(f"mkdir -p {remote_dir}")
            stdout.channel.recv_exit_status()
        print("Upload", rel)
        sftp.put(str(local), remote)
    sftp.close()

    cmd = f"""
set -e
cd {PROJECT}
pnpm --filter @watsapp/database exec prisma migrate deploy
pnpm --filter @watsapp/database exec prisma generate
pnpm --filter @watsapp/api build
pnpm --filter @watsapp/web build
pm2 restart api web --update-env
sleep 8
curl -sS -o /dev/null -w 'api:%{{http_code}}\\n' https://almutamayiziq.com/api/v1/health
echo TIKTOK_CONTACT_ONLY_OK
"""
    _, stdout, stderr = client.exec_command(cmd, timeout=600000)
    print(stdout.read().decode("utf-8", errors="replace"))
    err = stderr.read().decode("utf-8", errors="replace")
    if err.strip():
        print("STDERR:", err[-4000:], file=sys.stderr)
    code = stdout.channel.recv_exit_status()
    client.close()
    return code


if __name__ == "__main__":
    raise SystemExit(main())
