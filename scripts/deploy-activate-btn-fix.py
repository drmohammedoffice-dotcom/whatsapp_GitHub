#!/usr/bin/env python3
"""Deploy Activate Pixel button visibility fix."""
from __future__ import annotations
import os, sys
from pathlib import Path
import paramiko

HOST = "161.97.140.171"
PASSWORD = os.environ.get("VPS_PASSWORD", "")
PROJECT = "/root/whatsapp_GitHub"
REPO = Path(__file__).resolve().parents[1]

FILES = [
    "apps/web/src/app/tiktok/integration/page.tsx",
    "apps/web/src/lib/i18n/en.ts",
    "apps/web/src/lib/i18n/ar.ts",
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
pm2 restart web --update-env
sleep 6
curl -sS -o /dev/null -w 'web: %{{http_code}}\\n' https://almutamayiziq.com/tiktok/integration
echo ACTIVATE_BTN_FIX_OK
"""
    _, o, e = c.exec_command(cmd, timeout=600000)
    print(o.read().decode("utf-8", errors="replace"))
    err = e.read().decode("utf-8", errors="replace")
    if err.strip():
        print("STDERR:", err[-2000:])
    c.close()

if __name__ == "__main__":
    main()
