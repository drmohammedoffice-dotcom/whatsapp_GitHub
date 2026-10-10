#!/usr/bin/env python3
"""Deploy plan limits + grace period purge to VPS."""
from __future__ import annotations

import os
import sys
import tarfile
import tempfile
from pathlib import Path

import paramiko

HOST = "161.97.140.171"
PASSWORD = os.environ.get("VPS_PASSWORD", "")
PROJECT = "/root/whatsapp_GitHub"
REPO = Path(__file__).resolve().parents[1]

UPLOAD_PATHS = [
    "packages/database/prisma/schema.prisma",
    "packages/database/prisma/migrations/20260712070000_subscription_grace_period/migration.sql",
    "apps/api/src/billing/plan-limits.ts",
    "apps/api/src/billing/plan-entitlements.service.ts",
    "apps/api/src/billing/billing-access.service.ts",
    "apps/api/src/billing/billing.service.ts",
    "apps/api/src/billing/billing.module.ts",
    "apps/api/src/billing/subscription-expiry.service.ts",
    "apps/api/src/billing/subscription-grace-purge.service.ts",
    "apps/api/src/tiktok-integration/tiktok-tracking-phones.service.ts",
    "apps/api/src/modules/whatsapp/whatsapp.module.ts",
    "apps/api/src/modules/whatsapp/whatsapp.controller.ts",
    "apps/api/src/integrations/integrations.module.ts",
    "apps/api/src/integrations/integrations-hub.service.ts",
    "apps/api/src/integrations/meta/meta-oauth.service.ts",
    "apps/api/src/integrations/telegram/telegram.service.ts",
    "apps/api/src/integrations/telegram-user/telegram-user.module.ts",
    "apps/api/src/integrations/telegram-user/telegram-user-auth.service.ts",
    "apps/api/src/ai/ai.module.ts",
    "apps/api/src/ai/ai-assistant.service.ts",
    "apps/api/src/ai/ai-orchestrator.service.ts",
    "apps/api/src/ai/ai-settings.service.ts",
    "apps/api/src/admin/services/admin-subscriptions.service.ts",
    "apps/web/src/lib/plan-limits.ts",
    "apps/web/src/lib/billing.ts",
    "apps/web/src/lib/i18n/en.ts",
    "apps/web/src/lib/i18n/ar.ts",
    "apps/web/src/lib/i18n/types.ts",
    "apps/web/src/components/billing/plan-gate.tsx",
    "apps/web/src/components/billing/plan-upgrade-dialog.tsx",
    "apps/web/src/components/billing/subscription-expired-block.tsx",
    "apps/web/src/components/providers/subscription-provider.tsx",
    "apps/web/src/app/whatsapp/page.tsx",
    "apps/web/src/app/telegram/page.tsx",
    "apps/web/src/app/messenger/page.tsx",
    "apps/web/src/app/instagram/page.tsx",
    "apps/web/src/app/ai/page.tsx",
    "apps/web/src/app/settings/integrations/page.tsx",
    "apps/web/src/app/tiktok/integration/phones/page.tsx",
]


def make_tarball() -> str:
    fd, tar_path = tempfile.mkstemp(suffix=".tar.gz")
    os.close(fd)
    with tarfile.open(tar_path, "w:gz") as tar:
        for rel in UPLOAD_PATHS:
            src = REPO / rel
            if not src.exists():
                raise FileNotFoundError(f"Missing: {src}")
            tar.add(src, arcname=rel.replace("\\", "/"))
    return tar_path


def main() -> int:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    tar_path = make_tarball()
    print(f"Created tarball: {tar_path}")

    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(HOST, username="root", password=PASSWORD, timeout=60)
    sftp = client.open_sftp()
    sftp.put(tar_path, f"{PROJECT}/deploy-plan-limits.tar.gz")
    sftp.close()
    os.remove(tar_path)

    cmd = f"""
set -e
cd {PROJECT}
tar xzf deploy-plan-limits.tar.gz
rm -f deploy-plan-limits.tar.gz

pnpm --filter @watsapp/database exec prisma db execute --file packages/database/prisma/migrations/20260712070000_subscription_grace_period/migration.sql --schema packages/database/prisma/schema.prisma 2>/dev/null || true
pnpm --filter @watsapp/database exec prisma generate
pnpm --filter @watsapp/api build
rm -rf apps/web/.next
pnpm --filter @watsapp/web build
pm2 restart api --update-env
pm2 restart web --update-env
sleep 12
curl -sS -o /dev/null -w 'health:%{{http_code}} billing:%{{http_code}}\\n' https://almutamayiziq.com/api/v1/health https://almutamayiziq.com/pricing
echo PLAN_LIMITS_DEPLOY_OK
"""
    _, stdout, stderr = client.exec_command(cmd, timeout=900000)
    print(stdout.read().decode("utf-8", errors="replace"))
    err = stderr.read().decode("utf-8", errors="replace")
    if err.strip():
        print("STDERR:", err[-5000:], file=sys.stderr)
    code = stdout.channel.recv_exit_status()
    client.close()
    return code


if __name__ == "__main__":
    raise SystemExit(main())
