#!/usr/bin/env python3
"""Fix pixel_category OTHER -> LANDING_PAGE."""
from __future__ import annotations
import os, sys
from pathlib import Path
import paramiko

HOST = "161.97.140.171"
PASSWORD = os.environ.get("VPS_PASSWORD", "")
PROJECT = "/root/whatsapp_GitHub"
REPO = Path(__file__).resolve().parents[1]

FILES = [
    "apps/api/src/integrations/tiktok-login-kit/tiktok-ads.service.ts",
    "apps/api/dist/apps/api/src/integrations/tiktok-login-kit/tiktok-ads.service.js",
    "apps/api/dist/apps/api/src/integrations/tiktok-login-kit/tiktok-ads.service.js.map",
]

def main():
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(HOST, username="root", password=PASSWORD, timeout=60)
    sftp = c.open_sftp()
    for rel in FILES:
        sftp.put(str(REPO / rel), f"{PROJECT}/{rel.replace(chr(92), '/')}")
        print(" ", rel)
    sftp.close()
    _, o, e = c.exec_command(f"cd {PROJECT} && pm2 restart api --update-env && sleep 5 && curl -sS -o /dev/null -w '%{{http_code}}\\n' https://almutamayiziq.com/api/v1/health && echo PIXEL_CATEGORY_FIX_OK", timeout=120000)
    print(o.read().decode("utf-8", errors="replace"))
    err = e.read().decode("utf-8", errors="replace")
    if err.strip():
        print("STDERR:", err[-1000:])
    c.close()

if __name__ == "__main__":
    main()
