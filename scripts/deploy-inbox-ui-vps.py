#!/usr/bin/env python3
"""Deploy inbox UI redesign (web only)."""
from __future__ import annotations

import os
import sys
import time
from pathlib import Path

import paramiko

HOST = "161.97.140.171"
PASSWORD = os.environ.get("VPS_PASSWORD", "")
PROJECT = "/root/whatsapp_GitHub"
REPO = Path(__file__).resolve().parents[1]

UPLOAD = [
    "apps/web/src/components/channels/channel-brand-icon.tsx",
    "apps/web/src/components/inbox/inbox-channel-rail.tsx",
    "apps/web/src/components/inbox/inbox-view.tsx",
    "apps/web/src/components/layout/nav-config.ts",
    "apps/web/src/components/layout/sidebar.tsx",
    "apps/web/src/lib/i18n/en.ts",
    "apps/web/src/lib/i18n/ar.ts",
    "apps/web/src/lib/i18n/types.ts",
]


def ensure_remote_dir(sftp: paramiko.SFTPClient, client: paramiko.SSHClient, remote_dir: str) -> None:
    try:
        sftp.stat(remote_dir)
    except FileNotFoundError:
        _, stdout, _ = client.exec_command(f"mkdir -p {remote_dir}")
        stdout.channel.recv_exit_status()


def connect_with_retry(retries: int = 5) -> paramiko.SSHClient:
    last: Exception | None = None
    for i in range(retries):
        try:
            client = paramiko.SSHClient()
            client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
            client.connect(HOST, username="root", password=PASSWORD, timeout=90)
            return client
        except Exception as err:  # noqa: BLE001
            last = err
            print(f"connect retry {i + 1}/{retries}: {err}")
            time.sleep(3 + i * 2)
    raise RuntimeError(f"SSH connect failed: {last}")


def main() -> int:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    client = connect_with_retry()
    sftp = client.open_sftp()
    for rel in UPLOAD:
        local = REPO / rel
        remote = f"{PROJECT}/{rel}"
        ensure_remote_dir(sftp, client, str(Path(remote).parent).replace("\\", "/"))
        print("Upload", rel)
        sftp.put(str(local), remote)
    sftp.close()

    cmd = f"""
set -e
cd {PROJECT}
pnpm --filter @watsapp/web build
pm2 restart web --update-env
sleep 8
curl -sS -o /dev/null -w 'web:%{{http_code}}\\n' https://almutamayiziq.com/inbox/whatsapp || true
echo INBOX_UI_OK
"""
    _, stdout, stderr = client.exec_command(cmd, timeout=900000)
    print(stdout.read().decode("utf-8", "replace"))
    err = stderr.read().decode("utf-8", "replace")
    if err.strip():
        print("STDERR:", err[-5000:], file=sys.stderr)
    code = stdout.channel.recv_exit_status()
    client.close()
    return code


if __name__ == "__main__":
    raise SystemExit(main())
