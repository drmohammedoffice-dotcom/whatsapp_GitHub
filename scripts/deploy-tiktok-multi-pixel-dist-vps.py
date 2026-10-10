#!/usr/bin/env python3
"""Upload locally built tiktok-integration dist + web build to VPS."""
import os, sys, paramiko
from pathlib import Path

HOST = "161.97.140.171"
PASSWORD = os.environ.get("VPS_PASSWORD", "")
PROJECT_DIR = "/root/whatsapp_GitHub"
REPO = Path(__file__).resolve().parents[1]

LOCAL_DIST = REPO / "apps/api/dist/apps/api/src/tiktok-integration"
REMOTE_DIST = f"{PROJECT_DIR}/apps/api/dist/apps/api/src/tiktok-integration"

WEB_FILES = [
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

for f in LOCAL_DIST.glob("*"):
    if f.is_file():
        remote = f"{REMOTE_DIST}/{f.name}"
        print(f"Upload dist {f.name}")
        sftp.put(str(f), remote)

for rel in WEB_FILES:
    print(f"Upload {rel}")
    sftp.put(str(REPO / rel), f"{PROJECT_DIR}/{rel}")

sftp.close()

cmd = f"""
set -e
cd {PROJECT_DIR}
pnpm --filter @watsapp/web build
pm2 restart api web --update-env
sleep 5
curl -s -o /dev/null -w 'api: %{{http_code}}\\n' http://127.0.0.1:4000/health || true
echo DIST_DEPLOY_OK
"""
_, stdout, stderr = client.exec_command(cmd, timeout=1200000)
print(stdout.read().decode("utf-8", errors="replace"))
err = stderr.read().decode("utf-8", errors="replace")
if err.strip():
    print("STDERR:", err[-2000:])
print("exit", stdout.channel.recv_exit_status())
client.close()
