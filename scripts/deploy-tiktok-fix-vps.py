#!/usr/bin/env python3
"""Deploy TikTok connection persistence fix to production VPS."""
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
    "apps/api/src/tiktok",
    "apps/api/src/integrations/tiktok-login-kit",
    "apps/web/src/app/tiktok/page.tsx",
]


def collect_files() -> list[tuple[Path, str]]:
    pairs: list[tuple[Path, str]] = []
    for rel in UPLOAD_PATHS:
        src = REPO_ROOT / rel
        if not src.exists():
            raise FileNotFoundError(f"Missing deploy path: {src}")
        if src.is_dir():
            for path in src.rglob("*"):
                if path.is_file() and "node_modules" not in path.parts:
                    arc = str(path.relative_to(REPO_ROOT)).replace("\\", "/")
                    pairs.append((path, arc))
        else:
            pairs.append((src, rel.replace("\\", "/")))
    return pairs


def make_tarball(pairs: list[tuple[Path, str]]) -> str:
    fd, tar_path = tempfile.mkstemp(suffix=".tar.gz")
    os.close(fd)
    with tarfile.open(tar_path, "w:gz") as tar:
        for local, arc in pairs:
            tar.add(local, arcname=arc)
    return tar_path


def run_remote(client: paramiko.SSHClient, command: str, timeout: int = 900) -> tuple[int, str, str]:
    print(f"\n$ {command}")
    _, stdout, stderr = client.exec_command(command, timeout=timeout)
    out = stdout.read().decode("utf-8", errors="replace")
    err = stderr.read().decode("utf-8", errors="replace")
    code = stdout.channel.recv_exit_status()
    if out.strip():
        print(out.rstrip())
    if err.strip():
        print(err.rstrip(), file=sys.stderr)
    return code, out, err


def main() -> int:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    pairs = collect_files()
    tar_path = make_tarball(pairs)
    print(f"Created tarball with {len(pairs)} files: {tar_path}")

    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    print(f"Connecting to {USER}@{HOST}...")
    client.connect(HOST, username=USER, password=PASSWORD, timeout=30, banner_timeout=30)

    sftp = client.open_sftp()
    remote_tar = f"{PROJECT_DIR}/deploy-tiktok-fix.tar.gz"
    sftp.put(tar_path, remote_tar)
    sftp.close()
    os.remove(tar_path)

    commands = f"""
set -e
cd {PROJECT_DIR}
tar xzf deploy-tiktok-fix.tar.gz
rm -f deploy-tiktok-fix.tar.gz

echo "==> Reset stale TikTok CONNECTING rows without tokens..."
psql postgresql://postgres:postgres@localhost:5432/watsapp -c \\
  "UPDATE \\"TikTokAccount\\" SET status = 'DISCONNECTED' WHERE status = 'CONNECTING' AND id NOT IN (SELECT \\"accountId\\" FROM \\"TikTokToken\\");"

pnpm --filter @watsapp/api build
pnpm --filter @watsapp/web build
pm2 restart api web --update-env
sleep 5
curl -sS -o /dev/null -w "health:%{{http_code}}\\n" https://almutamayiziq.com/api/v1/health
echo DEPLOY_TIKTOK_FIX_COMPLETE
"""
    code, _, _ = run_remote(client, commands, timeout=1200)
    client.close()
    return code


if __name__ == "__main__":
    raise SystemExit(main())
