#!/usr/bin/env python3
"""Fix API crash (Swagger regex + Google hub wiring) and restore admin APIs."""
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
    "apps/api/src/integrations/integrations-hub.controller.ts",
    "apps/api/src/integrations/integrations-hub.service.ts",
    "apps/api/src/integrations/integrations-hub.types.ts",
    "apps/api/src/integrations/integrations.module.ts",
    "apps/api/src/integrations/google-calendar/google-calendar.module.ts",
    "apps/api/src/appointments/appointments.module.ts",
]


def main() -> int:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(HOST, username="root", password=PASSWORD, timeout=60)
    sftp = client.open_sftp()
    for rel in UPLOAD_PATHS:
        local = REPO / rel
        remote = f"{PROJECT}/{rel.replace(chr(92), '/')}"
        print("Upload", rel)
        sftp.put(str(local), remote)
    sftp.close()

    cmd = f"""
set -e
cd {PROJECT}
echo "===== build api ====="
pnpm --filter @watsapp/api build
echo "===== restart api ====="
pm2 restart api --update-env
sleep 15
echo "===== pm2 ====="
pm2 list | head -n 30
echo "===== health ====="
curl -sS -w '\\nhttp:%{{http_code}}\\n' https://almutamayiziq.com/api/v1/health || true
echo "===== recent api logs ====="
pm2 logs api --lines 40 --nostream || true
echo API_502_FIX_OK
"""
    _, stdout, stderr = client.exec_command(cmd, timeout=600000)
    print(stdout.read().decode("utf-8", errors="replace"))
    err = stderr.read().decode("utf-8", errors="replace")
    if err.strip():
        print("STDERR:", err[-4000:], file=sys.stderr)
    code = stdout.channel.recv_exit_status()
    client.close()
    return code


if __name__ == "__main__":
    raise SystemExit(main())
