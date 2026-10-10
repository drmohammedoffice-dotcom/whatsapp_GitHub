#!/usr/bin/env python3
"""Deploy Contact+Lead batch conversion + tracking URL Lead macros to VPS."""
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
    "apps/api/src/tiktok-integration/tiktok-integration.constants.ts",
    "apps/api/src/tiktok-integration/tiktok-integration.service.ts",
    "apps/api/src/tiktok-integration/tiktok-integration-tracking.service.ts",
    "apps/api/src/integrations/tiktok-login-kit/tiktok-ads.service.ts",
    "apps/api/src/modules/whatsapp/events.service.ts",
    "apps/web/src/app/tiktok/integration/wizard/page.tsx",
    "apps/web/src/components/tiktok/pixel-edit-dialog.tsx",
]


def main() -> int:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    print(f"Connecting {HOST}...")
    client.connect(HOST, username="root", password=PASSWORD, timeout=60)
    sftp = client.open_sftp()
    for rel in UPLOAD_PATHS:
        local = REPO / rel
        if not local.exists():
            raise FileNotFoundError(local)
        remote = f"{PROJECT}/{rel.replace(chr(92), '/')}"
        print("Upload", rel)
        sftp.put(str(local), remote)
    sftp.close()

    cmd = f"""
set -e
cd {PROJECT}
pnpm --filter @watsapp/api build
pnpm --filter @watsapp/web build
pm2 restart api web --update-env
sleep 10
curl -sS -o /dev/null -w 'api_health:%{{http_code}}\\n' https://almutamayiziq.com/api/v1/health || true
curl -sS -o /dev/null -w 'web:%{{http_code}}\\n' https://almutamayiziq.com/ || true
echo TIKTOK_LEAD_CONTACT_BATCH_OK
"""
    print("Building and restarting on VPS...")
    _, stdout, stderr = client.exec_command(cmd, timeout=600000)
    out = stdout.read().decode("utf-8", errors="replace")
    err = stderr.read().decode("utf-8", errors="replace")
    print(out)
    if err.strip():
        print("STDERR:", err[-4000:], file=sys.stderr)
    code = stdout.channel.recv_exit_status()
    client.close()
    return code


if __name__ == "__main__":
    raise SystemExit(main())
