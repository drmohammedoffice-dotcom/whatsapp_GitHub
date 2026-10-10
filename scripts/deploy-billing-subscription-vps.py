#!/usr/bin/env python3
"""Deploy billing/subscription system + admin i18n + TikTok gating to VPS."""
from __future__ import annotations

import os
import sys
from pathlib import Path

import paramiko

HOST = "161.97.140.171"
PASSWORD = os.environ.get("VPS_PASSWORD", "")
PROJECT = "/root/whatsapp_GitHub"
REPO = Path(__file__).resolve().parents[1]

FILES = [
    "packages/database/prisma/schema.prisma",
    "packages/database/prisma/migrations/20260710210000_billing_suspended/migration.sql",
    "scripts/merge-vps-platform-schema.py",
    "apps/api/src/app.module.ts",
    "apps/api/src/main.ts",
    "apps/web/src/components/layout/app-shell.tsx",
    "apps/web/src/components/layout/topbar.tsx",
    "apps/web/src/lib/admin-api.ts",
    "apps/web/src/lib/billing.ts",
    "apps/web/src/lib/admin-subscription-utils.ts",
    "apps/web/src/lib/tiktok-integration.ts",
    "apps/web/src/lib/i18n/en.ts",
    "apps/web/src/lib/i18n/ar.ts",
    "apps/web/src/lib/i18n/types.ts",
    "apps/web/src/components/tiktok/pixel-edit-dialog.tsx",
]

DIRS = [
    "apps/api/src/admin",
    "apps/api/src/billing",
    "apps/api/src/tiktok-integration",
    "apps/web/src/app/admin",
    "apps/web/src/components/admin",
    "apps/web/src/components/billing",
    "apps/web/src/components/brand",
    "apps/web/src/app/tiktok/integration",
]

REMOTE_SQL = """
ALTER TABLE "tiktok_integrations" ADD COLUMN IF NOT EXISTS "billing_suspended" BOOLEAN NOT NULL DEFAULT false;
"""


def ensure_dir(sftp: paramiko.SFTPClient, remote: str) -> None:
    parts = remote.replace("\\", "/").split("/")
    for i in range(2, len(parts)):
        d = "/".join(parts[:i])
        try:
            sftp.stat(d)
        except OSError:
            try:
                sftp.mkdir(d)
            except OSError:
                pass


def upload_file(sftp: paramiko.SFTPClient, local: Path, remote: str) -> None:
    ensure_dir(sftp, remote)
    print(f"  {local.relative_to(REPO)}")
    sftp.put(str(local), remote)


def upload_dir(sftp: paramiko.SFTPClient, local: Path, remote_base: str) -> None:
    if not local.exists():
        print(f"  SKIP missing {local}")
        return
    for item in local.rglob("*"):
        if item.is_file() and "node_modules" not in item.parts:
            rel = item.relative_to(local).as_posix()
            upload_file(sftp, item, f"{remote_base}/{rel}")


def main() -> int:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    print("Connecting to VPS...")
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(HOST, username="root", password=PASSWORD, timeout=60)
    sftp = client.open_sftp()

    print("Uploading files...")
    for rel in FILES:
        local = REPO / rel
        if local.exists():
            upload_file(sftp, local, f"{PROJECT}/{rel.replace(chr(92), '/')}")
        else:
            print(f"  SKIP missing {rel}")

    for rel in DIRS:
        upload_dir(sftp, REPO / rel, f"{PROJECT}/{rel}")

    with sftp.file(f"{PROJECT}/deploy-billing-migrate.sql", "w") as f:
        f.write(REMOTE_SQL)
    sftp.close()

    remote_cmd = f"""
set -e
cd {PROJECT}

echo '--- merge schema if needed ---'
python3 scripts/merge-vps-platform-schema.py || true

echo '--- db migration ---'
sudo -u postgres psql -d watsapp -f deploy-billing-migrate.sql

echo '--- prisma generate ---'
pnpm --filter @watsapp/database exec prisma generate

echo '--- api build ---'
pnpm --filter @watsapp/api build 2>&1 | tail -20

echo '--- web build ---'
pnpm --filter @watsapp/web build 2>&1 | tail -20

echo '--- restart ---'
pm2 restart api web --update-env
sleep 12

echo '--- health ---'
curl -sS -o /dev/null -w 'billing_plans: %{{http_code}}\\n' http://127.0.0.1:4000/api/v1/billing/plans
curl -sS -o /dev/null -w 'admin_login: %{{http_code}}\\n' -X POST http://127.0.0.1:4000/api/v1/admin/auth/login -H 'Content-Type: application/json' -d '{{"email":"x@y.com","password":"wrongpass123"}}'
curl -sS -o /dev/null -w 'billing_status: %{{http_code}}\\n' http://127.0.0.1:4000/api/v1/billing/status
pm2 status api web | grep -E 'api|web' | head -4
echo DEPLOY_BILLING_SUBSCRIPTION_OK
"""
    print("Running remote build...")
    _, stdout, stderr = client.exec_command(remote_cmd, timeout=900000)
    out = stdout.read().decode("utf-8", errors="replace")
    err = stderr.read().decode("utf-8", errors="replace")
    print(out)
    if err.strip():
        print("STDERR:", err[-5000:], file=sys.stderr)
    code = stdout.channel.recv_exit_status()
    client.close()
    return code


if __name__ == "__main__":
    raise SystemExit(main())
