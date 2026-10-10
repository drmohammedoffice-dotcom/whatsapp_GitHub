#!/usr/bin/env python3
"""Fix login 500: disable OTP until Resend domain verified."""
from __future__ import annotations

import os
import sys
import tarfile
import tempfile
from pathlib import Path

import paramiko

HOST = "161.97.140.171"
PASSWORD = os.environ.get("VPS_PASSWORD", "")
PROJECT = "/root/whatsapp_GitHub"
REPO = Path(__file__).resolve().parents[1]

FILES = [
    "apps/api/src/auth/auth.service.ts",
    "apps/api/src/auth/auth-email.service.ts",
    "apps/api/src/config/env.ts",
    "apps/web/src/lib/auth.ts",
    "apps/web/src/app/login/page.tsx",
    "apps/web/src/app/register/page.tsx",
    "apps/web/src/components/auth/otp-verification-modal.tsx",
]


def main() -> int:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    fd, tar_path = tempfile.mkstemp(suffix=".tar.gz")
    os.close(fd)
    with tarfile.open(tar_path, "w:gz") as tar:
        for rel in FILES:
            tar.add(REPO / rel, arcname=rel.replace("\\", "/"))

    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(HOST, username="root", password=PASSWORD, timeout=60)
    sftp = c.open_sftp()
    sftp.put(tar_path, f"{PROJECT}/fix-login.tar.gz")
    sftp.close()
    os.remove(tar_path)

    cmd = f"""
set -e
cd {PROJECT}
tar xzf fix-login.tar.gz && rm fix-login.tar.gz

if grep -q '^AUTH_OTP_ENABLED=' .env; then
  sed -i 's/^AUTH_OTP_ENABLED=.*/AUTH_OTP_ENABLED=false/' .env
else
  echo 'AUTH_OTP_ENABLED=false' >> .env
fi

pnpm --filter @watsapp/api build
rm -rf apps/web/.next
pnpm --filter @watsapp/web build
pm2 restart api --update-env
pm2 restart web --update-env
sleep 12
curl -sS -w '\\nhealth:%{{http_code}}\\n' https://almutamayiziq.com/api/v1/health
echo LOGIN_FIX_OK
"""
    _, o, e = c.exec_command(cmd, timeout=900000)
    sys.stdout.write(o.read().decode("utf-8", errors="replace"))
    err = e.read().decode("utf-8", errors="replace")
    if err.strip():
        print("ERR:", err[-4000:], file=sys.stderr)
    code = o.channel.recv_exit_status()
    c.close()
    return code


if __name__ == "__main__":
    raise SystemExit(main())
