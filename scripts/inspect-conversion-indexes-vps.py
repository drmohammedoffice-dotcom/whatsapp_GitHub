#!/usr/bin/env python3
"""Check leftover unique indexes on tiktok_integration_conversions."""
from __future__ import annotations

import os
import sys

import paramiko

HOST = "161.97.140.171"
PASSWORD = os.environ.get("VPS_PASSWORD", "")


def main() -> int:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(HOST, username="root", password=PASSWORD, timeout=90)
    cmd = r"""
cd /root/whatsapp_GitHub
# load DATABASE_URL from .env
set -a
. ./.env
set +a
psql "$DATABASE_URL" -c "\d+ tiktok_integration_conversions" 
psql "$DATABASE_URL" -c "SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'tiktok_integration_conversions' ORDER BY indexname;"
"""
    _, stdout, stderr = client.exec_command(cmd, timeout=120000)
    print(stdout.read().decode("utf-8", "replace"))
    err = stderr.read().decode("utf-8", "replace")
    if err.strip():
        print("STDERR:", err[-2000:], file=sys.stderr)
    code = stdout.channel.recv_exit_status()
    client.close()
    return code


if __name__ == "__main__":
    raise SystemExit(main())
