#!/usr/bin/env python3
"""Fix Resend sender to verified domain and keep OTP enabled."""
from __future__ import annotations

import os
import sys

import paramiko

HOST = "161.97.140.171"
PASSWORD = os.environ.get("VPS_PASSWORD", "")
PROJECT = "/root/whatsapp_GitHub"
FROM_EMAIL = "ChatLoora <noreply@almutamayiziq.com>"


def main() -> int:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(HOST, username="root", password=PASSWORD, timeout=60)
    cmd = f"""
set -e
cd {PROJECT}
sed -i 's|^RESEND_FROM_EMAIL=.*|RESEND_FROM_EMAIL={FROM_EMAIL}|' .env
sed -i 's/^AUTH_OTP_ENABLED=.*/AUTH_OTP_ENABLED=true/' .env
grep -E '^RESEND_FROM_EMAIL=|^AUTH_OTP_ENABLED=' .env
pm2 restart api --update-env
sleep 10
curl -sS -w '\\nhealth:%{{http_code}}\\n' https://almutamayiziq.com/api/v1/health
echo SENDER_FIX_OK
"""
    _, o, e = c.exec_command(cmd, timeout=120000)
    print(o.read().decode("utf-8", errors="replace"))
    err = e.read().decode("utf-8", errors="replace")
    if err.strip():
        print("ERR:", err[-2000:], file=sys.stderr)
    code = o.channel.recv_exit_status()
    c.close()
    return code


if __name__ == "__main__":
    raise SystemExit(main())
