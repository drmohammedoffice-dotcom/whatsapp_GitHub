#!/usr/bin/env python3
"""Hotfix: stop Integrations Hub from hijacking /integrations/google/* routes."""
from __future__ import annotations

import os
import sys
from pathlib import Path

import paramiko

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

HOST = "161.97.140.171"
PASSWORD = os.environ.get("VPS_PASSWORD", "")
PROJECT = "/root/whatsapp_GitHub"
LOCAL = Path(__file__).resolve().parents[1] / "apps/api/src/integrations/integrations-hub.controller.ts"
REMOTE = f"{PROJECT}/apps/api/src/integrations/integrations-hub.controller.ts"


def main() -> int:
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(HOST, username="root", password=PASSWORD, timeout=30)
    sftp = client.open_sftp()
    sftp.put(str(LOCAL), REMOTE)
    sftp.close()

    _, stdout, stderr = client.exec_command(
        f"""
set -e
cd {PROJECT}
pnpm --filter @watsapp/api build
pm2 restart api --update-env
sleep 3
echo DEPLOY_OK
""",
        timeout=300,
    )
    out = stdout.read().decode("utf-8", "replace")
    err = stderr.read().decode("utf-8", "replace")
    code = stdout.channel.recv_exit_status()
    print(out.encode("ascii", "replace").decode("ascii")[-3000:])
    if err.strip():
        print(err.encode("ascii", "replace").decode("ascii")[-1500:], file=sys.stderr)
    client.close()
    return code


if __name__ == "__main__":
    raise SystemExit(main())
