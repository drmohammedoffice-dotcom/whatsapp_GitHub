#!/usr/bin/env python3
"""Deploy multi-pixel TikTok integration to VPS."""
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
    "packages/database/prisma/schema.prisma",
    "packages/database/prisma/migrations/20260710180000_tiktok_multi_pixel/migration.sql",
    "apps/api/src/tiktok-integration/dto/tiktok-integration.dto.ts",
    "apps/api/src/tiktok-integration/tiktok-integration.service.ts",
    "apps/api/src/tiktok-integration/tiktok-integration.controller.ts",
    "apps/web/src/lib/tiktok-integration.ts",
    "apps/web/src/app/tiktok/integration/page.tsx",
    "apps/web/src/app/tiktok/integration/wizard/page.tsx",
    "apps/web/src/lib/i18n/en.ts",
    "apps/web/src/lib/i18n/ar.ts",
    "apps/web/src/lib/i18n/types.ts",
]


def main() -> int:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(HOST, username=USER, password=PASSWORD, timeout=30)
    sftp = client.open_sftp()
    for rel in UPLOAD_PATHS:
        local = REPO_ROOT / rel
        remote = f"{PROJECT_DIR}/{rel}"
        remote_dir = str(Path(remote).parent).replace("\\", "/")
        try:
            sftp.stat(remote_dir)
        except OSError:
            parts = remote_dir.split("/")
            for i in range(2, len(parts) + 1):
                d = "/".join(parts[:i])
                try:
                    sftp.stat(d)
                except OSError:
                    sftp.mkdir(d)
        print(f"Upload {rel}")
        sftp.put(str(local), remote)
    sftp.close()

    migration = REPO_ROOT / "packages/database/prisma/migrations/20260710180000_tiktok_multi_pixel/migration.sql"
    migration_sql = migration.read_text(encoding="utf-8")

    cmd = f"""
set -e
cd {PROJECT_DIR}
sudo -u postgres psql -d watsapp <<'EOSQL'
{migration_sql}
EOSQL
pnpm --filter @watsapp/database exec prisma generate
pnpm --filter @watsapp/api build
pnpm --filter @watsapp/web build
pm2 restart api web --update-env
sleep 6
echo DEPLOY_MULTI_PIXEL_COMPLETE
"""
    _, stdout, stderr = client.exec_command(cmd, timeout=1800)
    print(stdout.read().decode("utf-8", errors="replace"))
    err = stderr.read().decode("utf-8", errors="replace")
    if err.strip():
        print("STDERR:", err[-3000:], file=sys.stderr)
    code = stdout.channel.recv_exit_status()
    client.close()
    return code


if __name__ == "__main__":
    raise SystemExit(main())
