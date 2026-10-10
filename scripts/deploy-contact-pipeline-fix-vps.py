#!/usr/bin/env python3
"""Deploy Real WhatsApp Contact pipeline fix (once-per-conversation + diagnostics)."""
from __future__ import annotations

import os
import sys
from pathlib import Path

import paramiko

HOST = "161.97.140.171"
USER = "root"
PASSWORD = os.environ.get("VPS_PASSWORD", "")
PROJECT_DIR = "/root/whatsapp_GitHub"
REPO_ROOT = Path(__file__).resolve().parents[1]

UPLOAD_PATHS = [
    "apps/api/src/tiktok-integration/tiktok-integration-tracking.service.ts",
    "apps/api/src/tiktok-integration/tiktok-integration.service.ts",
    "apps/api/src/tiktok-integration/tiktok-integration.controller.ts",
    "apps/api/src/channels/channel-message.service.ts",
    "apps/api/src/channels/channel-purpose.ts",
    "packages/database/prisma/schema.prisma",
    "packages/database/prisma/migrations/20260716180000_contact_once_per_conversation_diag/migration.sql",
    "apps/web/src/app/tiktok/integration/debug/page.tsx",
    "apps/web/src/lib/tiktok-integration.ts",
    "apps/web/src/lib/i18n/en.ts",
    "apps/web/src/lib/i18n/ar.ts",
    "apps/web/src/lib/i18n/types.ts",
]


def ensure_remote_dir(sftp: paramiko.SFTPClient, remote_path: str) -> None:
    parts = remote_path.strip("/").split("/")
    cur = ""
    for part in parts[:-1]:
        cur += "/" + part
        try:
            sftp.stat(cur)
        except FileNotFoundError:
            sftp.mkdir(cur)


def main() -> int:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(HOST, username=USER, password=PASSWORD, timeout=30)
    sftp = client.open_sftp()
    for rel in UPLOAD_PATHS:
        local = REPO_ROOT / rel
        if not local.exists():
            print(f"SKIP missing {rel}")
            continue
        remote = f"{PROJECT_DIR}/{rel.replace(chr(92), '/')}"
        ensure_remote_dir(sftp, remote)
        print(f"Upload {rel}")
        sftp.put(str(local), remote)
    sftp.close()

    cmd = f"""
set -e
cd {PROJECT_DIR}
# Recover failed unique-index migration, then re-apply with dedupe SQL
pnpm --filter @watsapp/database exec prisma migrate resolve --rolled-back 20260716180000_contact_once_per_conversation_diag || true
pnpm --filter @watsapp/database exec prisma migrate deploy
pnpm --filter @watsapp/database exec prisma generate
pnpm --filter @watsapp/api build
pnpm --filter @watsapp/web build
pm2 restart api web
pm2 save
echo DEPLOY_OK
"""
    _, stdout, stderr = client.exec_command(cmd, timeout=900000)
    out = stdout.read().decode("utf-8", errors="replace")
    err = stderr.read().decode("utf-8", errors="replace")
    print(out[-4000:] if len(out) > 4000 else out)
    if err.strip():
        print("STDERR:", err[-3000:], file=sys.stderr)
    code = stdout.channel.recv_exit_status()
    client.close()
    print(f"exit={code}")
    return code


if __name__ == "__main__":
    raise SystemExit(main())
