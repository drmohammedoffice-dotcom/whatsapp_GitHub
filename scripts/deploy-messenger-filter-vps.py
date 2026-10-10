#!/usr/bin/env python3
import os, tarfile, tempfile
from pathlib import Path
import paramiko

HOST = "161.97.140.171"
USER = "root"
PASSWORD = os.environ.get("VPS_PASSWORD", "")
PROJECT_DIR = "/root/whatsapp_GitHub"
ROOT = Path(__file__).resolve().parents[1]
FILES = [
    "apps/web/src/components/channels/channel-connect-page.tsx",
    "apps/web/src/components/integrations/connection-card.tsx",
    "apps/web/src/app/messenger/page.tsx",
    "apps/web/src/app/instagram/page.tsx",
    "apps/api/src/integrations/connections.service.ts",
]

fd, tar_path = tempfile.mkstemp(suffix=".tar.gz")
os.close(fd)
with tarfile.open(tar_path, "w:gz") as tar:
    for rel in FILES:
        tar.add(ROOT / rel, arcname=rel)

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(HOST, username=USER, password=PASSWORD, timeout=30)
sftp = c.open_sftp()
sftp.put(tar_path, f"{PROJECT_DIR}/deploy-messenger-filter.tar.gz")
sftp.close()
os.remove(tar_path)

_, o, e = c.exec_command(f"""
set -e
cd {PROJECT_DIR}
tar xzf deploy-messenger-filter.tar.gz
rm deploy-messenger-filter.tar.gz
pnpm --filter @watsapp/api build
pnpm --filter @watsapp/web build
pm2 restart api web --update-env
echo OK
""", timeout=600)
print(o.read().decode("utf-8", errors="replace").encode("ascii", errors="replace").decode("ascii"))
print(e.read().decode("utf-8", errors="replace").encode("ascii", errors="replace").decode("ascii"))
c.close()
