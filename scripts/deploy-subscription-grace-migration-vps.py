#!/usr/bin/env python3
"""Apply subscription grace-period DB migration on VPS."""
from __future__ import annotations

import os
import sys
from pathlib import Path

import paramiko

HOST = "161.97.140.171"
PASSWORD = os.environ.get("VPS_PASSWORD", "")
PROJECT = "/root/whatsapp_GitHub"
REPO = Path(__file__).resolve().parents[1]

MIGRATION = "packages/database/prisma/migrations/20260712070000_subscription_grace_period/migration.sql"


def main() -> int:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(HOST, username="root", password=PASSWORD, timeout=60)
    sftp = client.open_sftp()
    local = REPO / MIGRATION
    remote = f"{PROJECT}/{MIGRATION.replace(chr(92), '/')}"
    print("Upload", MIGRATION)
    sftp.put(str(local), remote)
    sftp.close()

    cmd = f"""
set -e
cd {PROJECT}
pnpm --filter @watsapp/database exec prisma migrate deploy
pnpm --filter @watsapp/database exec prisma generate
pm2 restart api --update-env
sleep 8
curl -sS -w '\\nhealth:%{{http_code}}\\n' https://almutamayiziq.com/api/v1/health
echo GRACE_MIGRATION_OK
"""
    _, stdout, stderr = client.exec_command(cmd, timeout=300000)
    print(stdout.read().decode("utf-8", errors="replace"))
    err = stderr.read().decode("utf-8", errors="replace")
    if err.strip():
        print("STDERR:", err[-4000:], file=sys.stderr)
    code = stdout.channel.recv_exit_status()
    client.close()
    return code


if __name__ == "__main__":
    raise SystemExit(main())
