#!/usr/bin/env python3
import os, sys, tarfile, tempfile
from pathlib import Path
import paramiko

HOST = "161.97.140.171"
USER = "root"
PASSWORD = os.environ.get("VPS_PASSWORD", "")
PROJECT_DIR = "/root/whatsapp_GitHub"
ROOT = Path(__file__).resolve().parents[1]
FILES = [
    "apps/web/src/app/telegram/page.tsx",
    "apps/web/src/components/channels/telegram-connect-page.tsx",
    "apps/web/src/components/integrations/telegram-user-connect.tsx",
    "apps/web/src/lib/telegram-phone.ts",
    "apps/web/src/lib/channels.ts",
    "apps/web/src/lib/i18n/ar.ts",
    "apps/web/src/lib/i18n/en.ts",
    "apps/web/src/lib/i18n/types.ts",
]

fd, tar_path = tempfile.mkstemp(suffix=".tar.gz")
os.close(fd)
with tarfile.open(tar_path, "w:gz") as tar:
    for rel in FILES:
        p = ROOT / rel
        if not p.exists():
            raise FileNotFoundError(p)
        tar.add(p, arcname=rel)

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(HOST, username=USER, password=PASSWORD, timeout=30)
sftp = c.open_sftp()
sftp.put(tar_path, f"{PROJECT_DIR}/deploy-tg-page.tar.gz")
sftp.close()
os.remove(tar_path)

script = f"""
set -e
cd {PROJECT_DIR}
tar xzf deploy-tg-page.tar.gz
rm deploy-tg-page.tar.gz
pnpm --filter @watsapp/web build
pm2 restart web --update-env
echo DEPLOY_TG_PAGE_OK
"""
_, o, _ = c.exec_command(script, timeout=600)
print(o.read().decode("utf-8", errors="replace").encode("ascii", errors="replace").decode("ascii"))
c.close()
