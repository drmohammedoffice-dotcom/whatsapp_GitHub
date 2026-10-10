#!/usr/bin/env python3
"""Deploy TikTok Business API + i18n fixes to VPS."""
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

FILES = [
    "apps/api/src/integrations/tiktok-login-kit/tiktok-business-public.controller.ts",
    "apps/api/src/integrations/tiktok-login-kit/tiktok-business.service.ts",
    "apps/api/src/integrations/tiktok-login-kit/tiktok-login-kit.module.ts",
    "apps/api/src/main.ts",
    "apps/web/src/lib/i18n/en.ts",
    "apps/web/src/lib/i18n/ar.ts",
    "apps/web/src/lib/i18n/types.ts",
]


def main() -> int:
    print(f"Connecting to {HOST}...")
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(HOST, username=USER, password=PASSWORD, timeout=30)
    sftp = client.open_sftp()

    for rel in FILES:
        local = REPO_ROOT / rel
        remote = f"{PROJECT_DIR}/{rel.replace(chr(92), '/')}"
        if not local.exists():
            print(f"MISSING local file: {local}")
            return 1
        print(f"Upload {rel}")
        sftp.put(str(local), remote)

    sftp.close()

    cmd = f"""
set -e
cd {PROJECT_DIR}
pnpm --filter @watsapp/api build
pnpm --filter @watsapp/web build
pm2 restart api web
sleep 3
pm2 status
"""
    print("Building and restarting...")
    _, stdout, stderr = client.exec_command(cmd, timeout=600000)
    out = stdout.read().decode("utf-8", errors="replace")
    err = stderr.read().decode("utf-8", errors="replace")
    code = stdout.channel.recv_exit_status()
    print(out)
    if err.strip():
        print(err, file=sys.stderr)
    client.close()
    if code != 0:
        print(f"Deploy failed with exit code {code}")
        return code

    print("Deploy complete.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
