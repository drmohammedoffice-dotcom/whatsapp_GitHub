#!/usr/bin/env python3
"""Fetch admin + billing source from VPS."""
from __future__ import annotations

import os
import sys
from pathlib import Path

import paramiko

HOST = "161.97.140.171"
USER = "root"
PASSWORD = os.environ.get("VPS_PASSWORD", "")
PROJECT = "/root/whatsapp_GitHub"
REPO = Path(__file__).resolve().parents[1]

DIRS = [
    "apps/api/src/admin",
    "apps/api/src/billing",
    "apps/web/src/app/admin",
    "apps/web/src/components/admin",
    "apps/web/src/components/billing",
    "apps/web/src/lib/admin-api.ts",
]


def main() -> int:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(HOST, username=USER, password=PASSWORD, timeout=30)
    sftp = c.open_sftp()

    def remote_list(path: str) -> list[str]:
        _, stdout, _ = c.exec_command(
            f"find {PROJECT}/{path} -type f \\( -name '*.ts' -o -name '*.tsx' \\) 2>/dev/null || true"
        )
        lines = [ln.strip() for ln in stdout.read().decode().splitlines() if ln.strip()]
        return lines

    fetched = 0
    for item in DIRS:
        if item.endswith(".ts"):
            remote = f"{PROJECT}/{item}"
            local = REPO / item
            try:
                local.parent.mkdir(parents=True, exist_ok=True)
                sftp.get(remote, str(local))
                print(f"saved {item}")
                fetched += 1
            except OSError as e:
                print(f"skip {item}: {e}")
            continue

        for remote in remote_list(item):
            rel = remote.replace(f"{PROJECT}/", "").replace("\\", "/")
            local = REPO / rel
            local.parent.mkdir(parents=True, exist_ok=True)
            sftp.get(remote, str(local))
            print(f"saved {rel}")
            fetched += 1

    sftp.close()
    c.close()
    print(f"Fetched {fetched} files")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
