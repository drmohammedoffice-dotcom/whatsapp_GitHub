#!/usr/bin/env python3
"""Deploy landing offers admin + public API."""
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
    "packages/database/prisma/migrations/20260711140000_landing_offers/migration.sql",
    "apps/api/src/landing/landing.controller.ts",
    "apps/api/src/landing/landing-offers.service.ts",
    "apps/api/src/landing/landing.module.ts",
    "apps/api/src/admin/services/admin-offers.service.ts",
    "apps/api/src/admin/controllers/admin-operations.controller.ts",
    "apps/api/src/admin/admin.module.ts",
    "apps/api/src/app.module.ts",
    "apps/web/src/lib/landing-api.ts",
    "apps/web/src/lib/admin-api.ts",
    "apps/web/src/components/admin/offer-manage-dialog.tsx",
    "apps/web/src/app/admin/offers/page.tsx",
    "apps/web/src/app/page.tsx",
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

    def ensure_dir(path: str) -> None:
        parts = path.split("/")
        cur = ""
        for part in parts:
            if not part:
                continue
            cur += f"/{part}"
            try:
                sftp.stat(cur)
            except FileNotFoundError:
                sftp.mkdir(cur)

    for rel in UPLOAD_PATHS:
        local = REPO_ROOT / rel
        remote = f"{PROJECT_DIR}/{rel.replace(chr(92), '/')}"
        ensure_dir("/".join(remote.split("/")[:-1]))
        print(f"Upload {rel}")
        sftp.put(str(local), remote)
    sftp.close()

    cmd = (
        f"cd {PROJECT_DIR} && "
        "pnpm --filter @watsapp/database exec prisma migrate deploy && "
        "pnpm --filter @watsapp/database exec prisma generate && "
        "pnpm --filter @watsapp/api build && "
        "pnpm --filter @watsapp/web build && "
        "pm2 restart api web"
    )
    _, stdout, stderr = client.exec_command(cmd, timeout=900000)
    print(stdout.read().decode("utf-8", errors="replace"))
    err = stderr.read().decode("utf-8", errors="replace")
    if err.strip():
        print("STDERR:", err[-3000:], file=sys.stderr)
    code = stdout.channel.recv_exit_status()
    client.close()
    return code


if __name__ == "__main__":
    raise SystemExit(main())
