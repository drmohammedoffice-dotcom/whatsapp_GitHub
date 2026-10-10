#!/usr/bin/env python3
"""Deploy yearly plans, plan CRUD, light-only theme."""
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
    "packages/database/prisma/migrations/20260710220000_plan_yearly_price/migration.sql",
    "apps/api/src/admin/services/admin-subscriptions.service.ts",
    "apps/api/src/billing/billing.service.ts",
    "apps/web/src/lib/admin-api.ts",
    "apps/web/src/lib/i18n/en.ts",
    "apps/web/src/lib/i18n/ar.ts",
    "apps/web/src/lib/i18n/types.ts",
    "apps/web/src/components/providers/theme-provider.tsx",
    "apps/web/src/components/layout/topbar.tsx",
    "apps/web/src/components/admin/subscription-manage-dialog.tsx",
    "apps/web/src/components/admin/plan-manage-dialog.tsx",
    "apps/web/src/app/admin/subscriptions/page.tsx",
]

REMOTE_SQL = """
ALTER TABLE "subscription_plans" ADD COLUMN IF NOT EXISTS "yearly_price_cents" INTEGER;
UPDATE "subscription_plans"
SET "yearly_price_cents" = ROUND("price_cents" * 12 * 0.8)
WHERE "yearly_price_cents" IS NULL;
"""


def ensure_dir(sftp, remote: str) -> None:
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


def upload(sftp, local: Path, remote: str) -> None:
    ensure_dir(sftp, remote)
    print(f"  {local.relative_to(REPO)}")
    sftp.put(str(local), remote)


def main() -> int:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(HOST, username="root", password=PASSWORD, timeout=60)
    sftp = client.open_sftp()
    for rel in FILES:
        local = REPO / rel
        if local.exists():
            upload(sftp, local, f"{PROJECT}/{rel.replace(chr(92), '/')}")
    with sftp.file(f"{PROJECT}/deploy-yearly-plans.sql", "w") as f:
        f.write(REMOTE_SQL)
    sftp.close()

    cmd = f"""
set -e
cd {PROJECT}
sudo -u postgres psql -d watsapp -f deploy-yearly-plans.sql
pnpm --filter @watsapp/database exec prisma generate
pnpm --filter @watsapp/api build 2>&1 | tail -10
pnpm --filter @watsapp/web build 2>&1 | tail -20
pm2 restart api web --update-env
sleep 10
curl -sS -o /dev/null -w 'plans: %{{http_code}}\\n' http://127.0.0.1:4000/api/v1/billing/plans
curl -sS -o /dev/null -w 'web: %{{http_code}}\\n' https://almutamayiziq.com/
echo DEPLOY_YEARLY_PLANS_OK
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
