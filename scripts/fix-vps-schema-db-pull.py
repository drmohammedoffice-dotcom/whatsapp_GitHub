#!/usr/bin/env python3
import os, sys, paramiko
from pathlib import Path

HOST = "161.97.140.171"
PASSWORD = os.environ.get("VPS_PASSWORD", "")
PROJECT_DIR = "/root/whatsapp_GitHub"
REPO = Path(__file__).resolve().parents[1]

UPLOAD = [
    "scripts/patch-vps-tiktok-schema.py",
    "apps/api/src/tiktok-integration/dto/tiktok-integration.dto.ts",
    "apps/api/src/tiktok-integration/tiktok-integration.service.ts",
    "apps/api/src/tiktok-integration/tiktok-integration.controller.ts",
    "apps/web/src/lib/tiktok-integration.ts",
    "apps/web/src/app/tiktok/integration/page.tsx",
    "apps/web/src/app/tiktok/integration/wizard/page.tsx",
    "apps/web/src/lib/i18n/en.ts",
    "apps/web/src/lib/i18n/ar.ts",
    "apps/web/src/lib/i18n/types.ts",
]

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(HOST, username="root", password=PASSWORD, timeout=30)
sftp = client.open_sftp()
for rel in UPLOAD:
    sftp.put(str(REPO / rel), f"{PROJECT_DIR}/{rel}")
sftp.close()

cmd = f"""
set -e
cd {PROJECT_DIR}/packages/database
cp prisma/schema.prisma prisma/schema.prisma.broken 2>/dev/null || true
pnpm exec prisma db pull --force
python3 {PROJECT_DIR}/scripts/patch-vps-tiktok-schema.py
pnpm exec prisma generate
cd {PROJECT_DIR}
pnpm --filter @watsapp/api build 2>&1 | tail -8
pnpm --filter @watsapp/web build 2>&1 | tail -8
pm2 restart api web --update-env
sleep 6
pm2 status api web | head -20
echo DB_PULL_DEPLOY_OK
"""
_, stdout, stderr = client.exec_command(cmd, timeout=1800000)
print(stdout.read().decode("utf-8", errors="replace"))
err = stderr.read().decode("utf-8", errors="replace")
if err.strip():
    print("STDERR:", err[-4000:])
print("exit", stdout.channel.recv_exit_status())
client.close()
