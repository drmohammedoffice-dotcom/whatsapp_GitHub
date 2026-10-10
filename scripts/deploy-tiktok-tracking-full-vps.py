#!/usr/bin/env python3
"""Deploy full TikTok tracking system to VPS."""
import os, sys, paramiko
from pathlib import Path

HOST = "161.97.140.171"
PASSWORD = os.environ.get("VPS_PASSWORD", "")
PROJECT_DIR = "/root/whatsapp_GitHub"
REPO = Path(__file__).resolve().parents[1]

MIGRATION = (REPO / "packages/database/prisma/migrations/20260710190000_tiktok_pixel_tracking_full/migration.sql").read_text(encoding="utf-8")

UPLOAD_SRC = [
    "apps/api/src/tiktok-integration",
    "apps/api/src/integrations/tiktok-login-kit/tiktok-ads.service.ts",
    "apps/api/src/integrations/tiktok-login-kit/tiktok-marketing-oauth.service.ts",
    "apps/api/src/app.module.ts",
    "apps/api/src/main.ts",
    "apps/web/src/app/r",
    "apps/web/src/app/tiktok/activate",
    "apps/web/src/app/tiktok/integration",
    "apps/web/src/components/tiktok/tiktok-redirect-client.tsx",
    "apps/web/src/lib/tiktok-integration.ts",
    "apps/web/src/lib/i18n/en.ts",
    "apps/web/src/lib/i18n/ar.ts",
    "apps/web/src/lib/i18n/types.ts",
]

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(HOST, username="root", password=PASSWORD, timeout=30)
sftp = client.open_sftp()

def upload_tree(local: Path, remote_base: str):
    for item in local.rglob("*"):
        if item.is_file():
            rel = item.relative_to(local).as_posix()
            remote = f"{remote_base}/{rel}".replace("\\", "/")
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
            print("upload", rel)
            sftp.put(str(item), remote)

for src in UPLOAD_SRC:
    local = REPO / src
    if local.is_dir():
        upload_tree(local, f"{PROJECT_DIR}/{src}")
    elif local.is_file():
        sftp.put(str(local), f"{PROJECT_DIR}/{src}")

print("upload api dist...")
upload_tree(REPO / "apps/api/dist", f"{PROJECT_DIR}/apps/api/dist")
sftp.close()

cmd = f"""
set -e
cd {PROJECT_DIR}
sudo -u postgres psql -d watsapp <<'EOSQL'
{MIGRATION}
EOSQL
pnpm --filter @watsapp/database exec prisma generate
pnpm --filter @watsapp/web build
pm2 restart api web --update-env
sleep 8
curl -s -o /dev/null -w 'track: %{{http_code}}\\n' 'http://127.0.0.1:4000/api/tiktok-integration/public/track/testxyz' || true
echo DEPLOY_TRACKING_OK
"""
_, stdout, stderr = client.exec_command(cmd, timeout=1800000)
print(stdout.read().decode("utf-8", errors="replace"))
if stderr.read().decode("utf-8", errors="replace").strip():
    print("stderr tail ok")
print("exit", stdout.channel.recv_exit_status())
client.close()
