#!/usr/bin/env python3
"""Fast redeploy: upload changed dist modules + sources, migrate, build web on VPS."""
import os, sys, paramiko
from pathlib import Path

HOST = "161.97.140.171"
PASSWORD = os.environ.get("VPS_PASSWORD", "")
PROJECT_DIR = "/root/whatsapp_GitHub"
REPO = Path(__file__).resolve().parents[1]

MIGRATION = (
    REPO / "packages/database/prisma/migrations/20260710190000_tiktok_pixel_tracking_full/migration.sql"
).read_text(encoding="utf-8")

# Individual files to upload (relative to repo root)
FILES = [
    "packages/database/prisma/schema.prisma",
    "packages/database/prisma/migrations/20260710180000_tiktok_multi_pixel/migration.sql",
    "packages/database/prisma/migrations/20260710190000_tiktok_pixel_tracking_full/migration.sql",
    "apps/api/src/app.module.ts",
    "apps/api/src/main.ts",
    "apps/api/src/integrations/tiktok-login-kit/tiktok-ads.service.ts",
    "apps/api/src/integrations/tiktok-login-kit/tiktok-marketing-oauth.service.ts",
    "apps/web/src/components/tiktok/tiktok-redirect-client.tsx",
    "apps/web/src/lib/tiktok-integration.ts",
    "apps/web/src/lib/i18n/en.ts",
    "apps/web/src/lib/i18n/ar.ts",
    "apps/web/src/lib/i18n/types.ts",
]

DIRS = [
    "apps/api/src/tiktok-integration",
    "apps/api/dist/apps/api/src/tiktok-integration",
    "apps/web/src/app/r",
    "apps/web/src/app/tiktok/activate",
    "apps/web/src/app/tiktok/integration",
]

DIST_FILES = [
    "apps/api/dist/apps/api/src/app.module.js",
    "apps/api/dist/apps/api/src/main.js",
]

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
print("Connecting to VPS...")
client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(HOST, username="root", password=PASSWORD, timeout=60)
sftp = client.open_sftp()


def ensure_dir(remote: str):
    parts = remote.replace("\\", "/").split("/")
    for i in range(2, len(parts)):
        d = "/".join(parts[:i])
        try:
            sftp.stat(d)
        except OSError:
            try:
                sftp.mkdir(d)
            except OSError:
                pass


def upload_file(local: Path, remote: str):
    ensure_dir(remote)
    print(f"  {local.relative_to(REPO)}")
    sftp.put(str(local), remote)


def upload_dir(local: Path, remote_base: str):
    if not local.exists():
        print(f"  SKIP missing {local}")
        return
    for item in local.rglob("*"):
        if item.is_file():
            rel = item.relative_to(local).as_posix()
            upload_file(item, f"{remote_base}/{rel}")

print("Uploading files...")
for f in FILES:
    local = REPO / f
    if local.exists():
        upload_file(local, f"{PROJECT_DIR}/{f}")

for d in DIRS:
    local = REPO / d
    upload_dir(local, f"{PROJECT_DIR}/{d}")

for f in DIST_FILES:
    local = REPO / f
    if local.exists():
        upload_file(local, f"{PROJECT_DIR}/{f}")

sftp.close()
print("Upload done. Running remote commands...")

remote_cmd = f"""
set -e
cd {PROJECT_DIR}

echo '--- migrations ---'
sudo -u postgres psql -d watsapp <<'EOSQL'
{MIGRATION}
EOSQL

echo '--- prisma generate ---'
pnpm --filter @watsapp/database exec prisma generate

echo '--- web build ---'
pnpm --filter @watsapp/web build 2>&1 | tail -15

echo '--- restart ---'
pm2 restart api web --update-env
sleep 10

echo '--- health checks ---'
curl -s -o /dev/null -w 'api_track: %{{http_code}}\\n' 'http://127.0.0.1:4000/api/tiktok-integration/public/track/testxyz' || echo api_track:fail
pm2 status api web | grep -E 'api|web' | head -4

echo DEPLOY_OK
"""

_, stdout, stderr = client.exec_command(remote_cmd, timeout=900000)
out = stdout.read().decode("utf-8", errors="replace")
err = stderr.read().decode("utf-8", errors="replace")
print(out)
if err.strip():
    print("STDERR:", err[-3000:])
code = stdout.channel.recv_exit_status()
print(f"exit code: {code}")
client.close()
sys.exit(code)
