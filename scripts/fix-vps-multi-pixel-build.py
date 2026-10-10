#!/usr/bin/env python3
import os, sys, paramiko
from pathlib import Path

HOST = "161.97.140.171"
PASSWORD = os.environ.get("VPS_PASSWORD", "")
PROJECT_DIR = "/root/whatsapp_GitHub"
REPO = Path(__file__).resolve().parents[1]

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(HOST, username="root", password=PASSWORD, timeout=30)
sftp = client.open_sftp()
sftp.put(str(REPO / "scripts/patch-vps-tiktok-schema.py"), f"{PROJECT_DIR}/scripts/patch-vps-tiktok-schema.py")
sftp.close()

cmd = f"""
set -e
cd {PROJECT_DIR}
git checkout -- packages/database/prisma/schema.prisma
python3 scripts/patch-vps-tiktok-schema.py
pnpm --filter @watsapp/database exec prisma generate
pnpm --filter @watsapp/api build
pnpm --filter @watsapp/web build
pm2 restart api web --update-env
sleep 5
echo REBUILD_OK
"""
_, stdout, stderr = client.exec_command(cmd, timeout=1800)
print(stdout.read().decode("utf-8", errors="replace"))
err = stderr.read().decode("utf-8", errors="replace")
if err.strip():
    print("STDERR:", err[-3000:])
print("exit", stdout.channel.recv_exit_status())
client.close()
