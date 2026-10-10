#!/usr/bin/env python3
"""Deploy WhatsApp inbox dual-session conflict fix."""
from __future__ import annotations

import os
import sys
import tarfile
import tempfile
from pathlib import Path

import paramiko

HOST = "161.97.140.171"
USER = "root"
PASSWORD = os.environ.get("VPS_PASSWORD", "")
PROJECT_DIR = "/root/whatsapp_GitHub"
REPO_ROOT = Path(__file__).resolve().parents[1]

UPLOAD_PATHS = [
    "apps/api/src/modules/whatsapp/whatsapp.service.ts",
    "apps/api/src/modules/whatsapp/session.manager.ts",
    "apps/api/src/modules/whatsapp/events.service.ts",
    "apps/api/src/modules/whatsapp/whatsapp.repository.ts",
    "apps/web/src/components/inbox/inbox-view.tsx",
]


def main() -> int:
    pairs = [(REPO_ROOT / p, p.replace("\\", "/")) for p in UPLOAD_PATHS]
    for local, _ in pairs:
        if not local.exists():
            raise FileNotFoundError(local)

    fd, tar_path = tempfile.mkstemp(suffix=".tar.gz")
    os.close(fd)
    with tarfile.open(tar_path, "w:gz") as tar:
        for local, arc in pairs:
            tar.add(local, arcname=arc)

    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(HOST, username=USER, password=PASSWORD, timeout=30)
    sftp = client.open_sftp()
    sftp.put(tar_path, f"{PROJECT_DIR}/deploy-wa-inbox-fix.tar.gz")
    sftp.close()
    os.remove(tar_path)

    cmd = f"""
set -e
cd {PROJECT_DIR}
tar xzf deploy-wa-inbox-fix.tar.gz
rm -f deploy-wa-inbox-fix.tar.gz
pnpm --filter @watsapp/api build
pnpm --filter @watsapp/web build
pm2 restart api --update-env
pm2 restart web --update-env
sleep 8
pm2 logs api --lines 30 --nostream | grep -iE 'Restoring|Inbox|Tracking|conflict|online|Nest application' | tail -25
echo DEPLOY_OK
"""
    print("Deploying inbox conflict fix...")
    _, stdout, stderr = client.exec_command(cmd, timeout=900)
    out = stdout.read().decode("utf-8", errors="replace")
    err = stderr.read().decode("utf-8", errors="replace")
    code = stdout.channel.recv_exit_status()
    print(out.encode("ascii", errors="replace").decode("ascii"))
    if err.strip():
        print(err.encode("ascii", errors="replace").decode("ascii")[-3000:], file=sys.stderr)
    client.close()
    return code


if __name__ == "__main__":
    raise SystemExit(main())
