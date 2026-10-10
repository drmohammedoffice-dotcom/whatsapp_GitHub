#!/usr/bin/env python3
"""Restore VPS API with local schema + full local dist."""
import os, sys, paramiko
from pathlib import Path

HOST = "161.97.140.171"
PASSWORD = os.environ.get("VPS_PASSWORD", "")
PROJECT_DIR = "/root/whatsapp_GitHub"
REPO = Path(__file__).resolve().parents[1]

LOCAL_DIST = REPO / "apps/api/dist"
REMOTE_DIST = f"{PROJECT_DIR}/apps/api/dist"

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(HOST, username="root", password=PASSWORD, timeout=30)
sftp = client.open_sftp()

print("Upload schema.prisma")
sftp.put(
    str(REPO / "packages/database/prisma/schema.prisma"),
    f"{PROJECT_DIR}/packages/database/prisma/schema.prisma",
)

def upload_dir(local: Path, remote: str):
    for item in local.rglob("*"):
        if item.is_file():
            rel = item.relative_to(local).as_posix()
            remote_path = f"{remote}/{rel}"
            remote_dir = str(Path(remote_path).parent).replace("\\", "/")
            parts = remote_dir.split("/")
            for i in range(2, len(parts) + 1):
                d = "/".join(parts[:i])
                try:
                    sftp.stat(d)
                except OSError:
                    try:
                        sftp.mkdir(d)
                    except OSError:
                        pass
            sftp.put(str(item), remote_path)

print("Upload API dist (this may take a minute)...")
upload_dir(LOCAL_DIST, REMOTE_DIST)
sftp.close()

cmd = f"""
set -e
cd {PROJECT_DIR}
pnpm --filter @watsapp/database exec prisma generate
pm2 restart api --update-env
sleep 8
curl -s -o /dev/null -w 'health: %{{http_code}}\\n' http://127.0.0.1:4000/health || true
pm2 logs api --lines 15 --nostream 2>&1 | tail -20
echo FULL_DIST_RESTORE_OK
"""
_, stdout, stderr = client.exec_command(cmd, timeout=600000)
print(stdout.read().decode("utf-8", errors="replace"))
err = stderr.read().decode("utf-8", errors="replace")
if err.strip():
    print("STDERR:", err[-2000:])
print("exit", stdout.channel.recv_exit_status())
client.close()
