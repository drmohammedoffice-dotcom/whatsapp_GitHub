#!/usr/bin/env python3
import os
from pathlib import Path
import paramiko

HOST = "161.97.140.171"
PASSWORD = os.environ.get("VPS_PASSWORD", "")
PROJECT = "/root/whatsapp_GitHub"
OUT = Path(r"c:\xampp\htdocs\watsapp\tmp")

files = [
    "apps/web/src/components/layout/app-shell.tsx",
    "apps/web/src/components/layout/subscription-guard.tsx",
    "apps/web/src/app/page.tsx",
    "apps/web/src/components/billing/pricing-view.tsx",
]

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(HOST, username="root", password=PASSWORD, timeout=60)
sftp = c.open_sftp()
OUT.mkdir(exist_ok=True)
for f in files:
    local = OUT / ("vps-" + Path(f).name)
    sftp.get(f"{PROJECT}/{f}", str(local))
    print("saved", local.name)
sftp.close()
c.close()
