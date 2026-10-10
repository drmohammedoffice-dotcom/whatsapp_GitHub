#!/usr/bin/env python3
"""Deploy wizard back button + no auto-skip steps fix."""
from __future__ import annotations
import os, sys
from pathlib import Path
import paramiko

HOST = "161.97.140.171"
PASSWORD = os.environ.get("VPS_PASSWORD", "")
PROJECT = "/root/whatsapp_GitHub"
REPO = Path(__file__).resolve().parents[1]

FILES = [
    "apps/api/src/tiktok-integration/tiktok-integration.service.ts",
    "apps/api/dist/apps/api/src/tiktok-integration/tiktok-integration.service.js",
    "apps/api/dist/apps/api/src/tiktok-integration/tiktok-integration.service.js.map",
    "apps/web/src/app/tiktok/integration/wizard/page.tsx",
]

def main():
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(HOST, username="root", password=PASSWORD, timeout=60)
    sftp = c.open_sftp()
    for rel in FILES:
        local = REPO / rel
        remote = f"{PROJECT}/{rel.replace(chr(92), '/')}"
        print(" ", rel)
        sftp.put(str(local), remote)
    sftp.close()
    cmd = f"""
set -e
cd {PROJECT}
pnpm --filter @watsapp/web build 2>&1 | tail -8
pm2 restart api web --update-env
sleep 8
curl -sS -o /dev/null -w 'api: %{{http_code}} web: %{{http_code}}\\n' https://almutamayiziq.com/api/v1/health https://almutamayiziq.com/
echo WIZARD_FIX_OK
"""
    _, o, e = c.exec_command(cmd, timeout=600000)
    print(o.read().decode("utf-8", errors="replace"))
    err = e.read().decode("utf-8", errors="replace")
    if err.strip():
        print("STDERR:", err[-2000:])
    c.close()

if __name__ == "__main__":
    main()
