#!/usr/bin/env python3
"""Deploy tiktok-integration DELETE route fix (main.ts exclude wildcard)."""
from __future__ import annotations
import os, sys
from pathlib import Path
import paramiko

HOST = "161.97.140.171"
PASSWORD = os.environ.get("VPS_PASSWORD", "")
PROJECT = "/root/whatsapp_GitHub"
REPO = Path(__file__).resolve().parents[1]

FILES = [
    "apps/api/src/main.ts",
    "apps/api/dist/apps/api/src/main.js",
    "apps/api/dist/apps/api/src/main.js.map",
    "apps/api/src/tiktok-integration/tiktok-integration.controller.ts",
    "apps/api/dist/apps/api/src/tiktok-integration/tiktok-integration.controller.js",
]

def main():
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(HOST, username="root", password=PASSWORD, timeout=60)
    sftp = c.open_sftp()
    for rel in FILES:
        local = REPO / rel
        if not local.exists():
            print(" SKIP", rel)
            continue
        remote = f"{PROJECT}/{rel.replace(chr(92), '/')}"
        print(" ", rel)
        sftp.put(str(local), remote)
    sftp.close()
    _, o, e = c.exec_command(f"cd {PROJECT} && pm2 restart api --update-env && sleep 6 && curl -sS -o /dev/null -w 'api: %{{http_code}}\\n' https://almutamayiziq.com/api/v1/health", timeout=120000)
    print(o.read().decode("utf-8", errors="replace"))
    c.close()
    print("DELETE_ROUTE_FIX_OK")

if __name__ == "__main__":
    main()
