#!/usr/bin/env python3
"""Deploy pauseAiOnHumanReply enforcement (manual takeover pauses AI)."""
from __future__ import annotations

import hashlib
import os
import sys
from pathlib import Path

import paramiko

HOST = "161.97.140.171"
PASSWORD = os.environ.get("VPS_PASSWORD", "")
PROJECT = "/root/whatsapp_GitHub"
REPO = Path(__file__).resolve().parents[1]

UPLOAD_PATHS = [
    "apps/api/src/channels/channel-message.service.ts",
    "apps/api/src/modules/whatsapp/events.service.ts",
    "apps/api/src/conversations/conversations.service.ts",
]


def main() -> int:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(HOST, username="root", password=PASSWORD, timeout=60)
    sftp = client.open_sftp()

    diff_only = "--diff" in sys.argv
    for rel in UPLOAD_PATHS:
        local = REPO / rel
        remote = f"{PROJECT}/{rel}"
        local_md5 = hashlib.md5(local.read_bytes()).hexdigest()
        try:
            with sftp.file(remote, "rb") as f:
                remote_md5 = hashlib.md5(f.read()).hexdigest()
        except IOError:
            remote_md5 = "MISSING"
        same = "SAME" if local_md5 == remote_md5 else "DIFFERS"
        print(f"{same:8} {rel}")
        if not diff_only:
            sftp.put(str(local), remote)
            print(f"uploaded {rel}")
    sftp.close()

    if diff_only:
        client.close()
        return 0

    cmd = f"""
set -e
cd {PROJECT}
pnpm --filter @watsapp/api build
pm2 restart api worker --update-env
sleep 12
pm2 list | head -n 12
curl -sS -w '\\nhttp:%{{http_code}}\\n' https://almutamayiziq.com/api/v1/health || true
echo HUMAN_TAKEOVER_DEPLOY_OK
"""
    _, stdout, stderr = client.exec_command(cmd, timeout=900)
    print(stdout.read().decode("utf-8", errors="replace"))
    err = stderr.read().decode("utf-8", errors="replace")
    if err.strip():
        print("STDERR:", err[-4000:], file=sys.stderr)
    code = stdout.channel.recv_exit_status()
    client.close()
    return code


if __name__ == "__main__":
    raise SystemExit(main())
