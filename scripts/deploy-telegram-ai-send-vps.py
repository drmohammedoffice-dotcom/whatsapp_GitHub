#!/usr/bin/env python3
"""Deploy Telegram User AI send fix to VPS."""
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
    "apps/api/src/integrations/telegram-user/telegram-user.service.ts",
    "apps/api/src/integrations/telegram-user/telegram-user-events.service.ts",
    "apps/api/src/integrations/telegram-user/telegram-client.manager.ts",
    "apps/api/src/integrations/telegram-user/telegram-user-sync.service.ts",
    "apps/api/src/channels/outbound-channel.service.ts",
]


def collect_files() -> list[tuple[Path, str]]:
    return [(REPO_ROOT / rel, rel.replace("\\", "/")) for rel in UPLOAD_PATHS]


def make_tarball(pairs: list[tuple[Path, str]]) -> str:
    fd, tar_path = tempfile.mkstemp(suffix=".tar.gz")
    os.close(fd)
    with tarfile.open(tar_path, "w:gz") as tar:
        for local, arc in pairs:
            tar.add(local, arcname=arc)
    return tar_path


def run_remote(client: paramiko.SSHClient, command: str, timeout: int = 600) -> int:
    print(f"\n$ {command}")
    _, stdout, stderr = client.exec_command(command, timeout=timeout)
    out = stdout.read().decode("utf-8", errors="replace")
    err = stderr.read().decode("utf-8", errors="replace")
    code = stdout.channel.recv_exit_status()
    if out.strip():
        print(out.encode("ascii", errors="replace").decode("ascii").rstrip())
    if err.strip():
        print(err.rstrip(), file=sys.stderr)
    return code


def main() -> int:
    tar_path = make_tarball(collect_files())
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(HOST, username=USER, password=PASSWORD, timeout=30)
    sftp = client.open_sftp()
    sftp.put(tar_path, f"{PROJECT_DIR}/deploy-telegram-ai-send.tar.gz")
    sftp.close()
    os.remove(tar_path)
    code = run_remote(
        client,
        f"""
set -e
cd {PROJECT_DIR}
tar xzf deploy-telegram-ai-send.tar.gz
rm -f deploy-telegram-ai-send.tar.gz
pnpm --filter @watsapp/api build
pm2 restart api --update-env
sleep 4
grep -n resolveSendTarget apps/api/dist/apps/api/src/integrations/telegram-user/telegram-user.service.js | head -2
echo DEPLOY_TELEGRAM_AI_SEND_COMPLETE
""",
        timeout=600,
    )
    client.close()
    return code


if __name__ == "__main__":
    raise SystemExit(main())
