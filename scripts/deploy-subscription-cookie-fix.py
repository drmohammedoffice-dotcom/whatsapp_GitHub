#!/usr/bin/env python3
"""Fix subscription cookie sync for active subscribers."""
from __future__ import annotations
import os, sys
from pathlib import Path
import paramiko

HOST = "161.97.140.171"
PASSWORD = os.environ.get("VPS_PASSWORD", "")
PROJECT = "/root/whatsapp_GitHub"
REPO = Path(__file__).resolve().parents[1]

FILES = [
    "apps/web/src/middleware.ts",
    "apps/web/src/lib/subscription-cookie.ts",
    "apps/web/src/lib/subscription-routes.ts",
    "apps/web/src/lib/utils.ts",
    "apps/web/src/components/providers/subscription-provider.tsx",
    "apps/web/src/components/layout/auth-guard.tsx",
    "apps/web/src/components/layout/subscription-guard.tsx",
    "apps/web/src/components/billing/subscription-expired-block.tsx",
    "apps/web/src/app/login/page.tsx",
    "apps/web/src/app/register/page.tsx",
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
        parts = remote.split("/")
        for i in range(2, len(parts)):
            d = "/".join(parts[:i])
            try:
                sftp.stat(d)
            except OSError:
                try:
                    sftp.mkdir(d)
                except OSError:
                    pass
        print(" ", rel)
        sftp.put(str(local), remote)
    sftp.close()
    cmd = f"""
set -e
cd {PROJECT}
pnpm --filter @watsapp/web build 2>&1 | tail -15
pm2 restart web --update-env
sleep 8
curl -sS -o /dev/null -w 'web: %{{http_code}}\\n' https://almutamayiziq.com/
echo SUB_COOKIE_FIX_OK
"""
    _, o, e = c.exec_command(cmd, timeout=600000)
    print(o.read().decode("utf-8", errors="replace"))
    if e.read().strip():
        print("STDERR:", e.read()[-2000:])
    c.close()

if __name__ == "__main__":
    main()
