#!/usr/bin/env python3
import os, paramiko
from pathlib import Path
HOST = "161.97.140.171"
PROJECT = "/root/whatsapp_GitHub"
FILES = [
    "apps/api/src/integrations/tiktok-login-kit/tiktok-business.service.ts",
    "apps/api/src/integrations/tiktok-login-kit/tiktok-login-kit.module.ts",
    "apps/api/src/main.ts",
    "apps/web/src/app/tiktok/business/page.tsx",
    "apps/web/src/components/tiktok/tiktok-business-shell.tsx",
]
OUT = Path(__file__).resolve().parents[1] / "tmp" / "vps-tiktok-business"
OUT.mkdir(parents=True, exist_ok=True)
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(HOST, username='root', password=os.environ.get('VPS_PASSWORD',''), timeout=30)
sftp = c.open_sftp()
for f in FILES:
    local = OUT / Path(f).name
    sftp.get(f"{PROJECT}/{f}", str(local))
    print("saved", local.name)
sftp.close()
c.close()
