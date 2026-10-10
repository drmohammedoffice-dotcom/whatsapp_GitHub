#!/usr/bin/env python3
"""Deploy TikTok pixel activation without Events Manager popup."""
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
    "apps/web/src/lib/tiktok-pixel-setup.ts",
    "apps/web/src/app/tiktok/integration/wizard/page.tsx",
    "apps/web/src/app/tiktok/integration/page.tsx",
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
        remote = f"{PROJECT_DIR}/{rel.replace(chr(92), '/')}"
        print(f"Upload {rel}")
        sftp.put(str(local), remote)
    sftp.close()

    _, stdout, stderr = client.exec_command(
        f"cd {PROJECT_DIR} && pnpm --filter @watsapp/web build && pm2 restart web",
        timeout=600000,
    )
    print(stdout.read().decode("utf-8", errors="replace"))
    err = stderr.read().decode("utf-8", errors="replace")
    if err.strip():
        print("STDERR:", err[-2000:], file=sys.stderr)
    code = stdout.channel.recv_exit_status()
    client.close()
    return code


if __name__ == "__main__":
    raise SystemExit(main())
