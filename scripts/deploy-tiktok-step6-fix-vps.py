#!/usr/bin/env python3
"""Deploy wizard step 6 + redirect loop fix + Events API 2.0 to VPS."""
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
    "apps/api/src/integrations/tiktok-login-kit/tiktok-ads.service.ts",
    "apps/api/src/tiktok-integration/tiktok-integration.service.ts",
    "apps/api/src/tiktok-integration/tiktok-integration-tracking.service.ts",
    "apps/web/src/app/r/[slug]/page.tsx",
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
        print(f"Upload {rel}")
        sftp.put(str(local), remote)
    sftp.close()

    cmd = f"""
set -e
cd {PROJECT_DIR}
grep -q '^API_INTERNAL_URL=' apps/web/.env.local || echo 'API_INTERNAL_URL=http://127.0.0.1:4000' >> apps/web/.env.local
pnpm --filter @watsapp/api build
pnpm --filter @watsapp/web build
pm2 restart api web --update-env
sleep 8
echo '--- redirect chain test ---'
curl -s -o /dev/null -L --max-redirs 5 -w 'final: %{{http_code}} url: %{{url_effective}}\\n' https://almutamayiziq.com/r/testxyz || true
echo DEPLOY_STEP6_COMPLETE
"""
    _, stdout, stderr = client.exec_command(cmd, timeout=1800)
    print(stdout.read().decode("utf-8", errors="replace"))
    err = stderr.read().decode("utf-8", errors="replace")
    if err.strip():
        print("STDERR:", err[-2000:], file=sys.stderr)
    code = stdout.channel.recv_exit_status()
    client.close()
    return code


if __name__ == "__main__":
    raise SystemExit(main())
