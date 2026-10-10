#!/usr/bin/env python3
"""Deploy AI auto-reply fixes to production VPS."""
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
    "apps/api/src/channels/channel-message.service.ts",
    "apps/api/src/channels/channel-secrets.service.ts",
    "apps/api/src/integrations/meta/meta-media.service.ts",
    "apps/api/src/ai/ai-orchestrator.service.ts",
]


def collect_files() -> list[tuple[Path, str]]:
    pairs: list[tuple[Path, str]] = []
    for rel in UPLOAD_PATHS:
        src = REPO_ROOT / rel
        if not src.exists():
            raise FileNotFoundError(f"Missing deploy path: {src}")
        pairs.append((src, rel.replace("\\", "/")))
    return pairs


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
        safe = out.encode("ascii", errors="replace").decode("ascii")
        print(safe.rstrip())
    if err.strip():
        print(err.rstrip(), file=sys.stderr)
    return code


def main() -> int:
    pairs = collect_files()
    tar_path = make_tarball(pairs)
    print(f"Deploying {len(pairs)} files...")

    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(HOST, username=USER, password=PASSWORD, timeout=30)

    sftp = client.open_sftp()
    remote_tar = f"{PROJECT_DIR}/deploy-ai-reply.tar.gz"
    sftp.put(tar_path, remote_tar)
    sftp.close()
    os.remove(tar_path)

    code = run_remote(
        client,
        f"""
set -e
cd {PROJECT_DIR}
tar xzf deploy-ai-reply.tar.gz
rm -f deploy-ai-reply.tar.gz
pnpm --filter @watsapp/api build
pm2 restart api --update-env
sleep 3
pm2 logs api --lines 5 --nostream
echo DEPLOY_AI_REPLY_COMPLETE
""",
        timeout=600,
    )
    client.close()
    return code


if __name__ == "__main__":
    raise SystemExit(main())
