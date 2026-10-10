#!/usr/bin/env python3
"""Deploy admin impersonation bypass for subscription lock."""
from __future__ import annotations

import os
import sys
from pathlib import Path

import paramiko

HOST = "161.97.140.171"
PASSWORD = os.environ.get("VPS_PASSWORD", "")
PROJECT = "/root/whatsapp_GitHub"
REPO = Path(__file__).resolve().parents[1]

UPLOAD = [
    "apps/api/src/admin/services/admin-auth.service.ts",
    "apps/web/src/lib/utils.ts",
    "apps/web/src/lib/admin-api.ts",
    "apps/web/src/app/login/page.tsx",
    "apps/web/src/app/register/page.tsx",
    "apps/web/src/components/billing/subscription-expired-block.tsx",
    "apps/web/src/components/billing/subscription-warning-modal.tsx",
]


def main() -> int:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(HOST, username="root", password=PASSWORD, timeout=90)
    sftp = client.open_sftp()
    for rel in UPLOAD:
        local = REPO / rel
        print("Upload", rel)
        sftp.put(str(local), f"{PROJECT}/{rel}")
    sftp.close()

    cmd = f"""
set -e
cd {PROJECT}
pnpm --filter @watsapp/api build
pnpm --filter @watsapp/web build
pm2 restart api web --update-env
sleep 8
curl -sS -o /dev/null -w 'api:%{{http_code}}\\n' https://almutamayiziq.com/api/v1/health || true
curl -sS -o /dev/null -w 'web:%{{http_code}}\\n' https://almutamayiziq.com/ || true
echo ADMIN_IMPERSONATION_BYPASS_OK
"""
    _, stdout, stderr = client.exec_command(cmd, timeout=900000)
    print(stdout.read().decode("utf-8", "replace"))
    err = stderr.read().decode("utf-8", "replace")
    if err.strip():
        print("STDERR:", err[-4000:], file=sys.stderr)
    return stdout.channel.recv_exit_status()


if __name__ == "__main__":
    raise SystemExit(main())
