#!/usr/bin/env python3
"""Deploy Email OTP authentication system to VPS."""
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
RESEND_KEY = os.environ.get("RESEND_API_KEY", "")

UPLOAD_PATHS = [
    "package.json",
    "pnpm-lock.yaml",
    "packages/database/prisma/schema.prisma",
    "packages/database/prisma/migrations/20260712100000_email_verifications/migration.sql",
    "apps/api/package.json",
    "apps/api/src/config/env.ts",
    "apps/api/src/auth/auth.module.ts",
    "apps/api/src/auth/auth.controller.ts",
    "apps/api/src/auth/auth.service.ts",
    "apps/api/src/auth/auth-email.service.ts",
    "apps/api/src/auth/email-verification.service.ts",
    "apps/api/src/auth/dto/verify-otp.dto.ts",
    "apps/web/src/components/auth/password-input.tsx",
    "apps/web/src/components/auth/otp-verification-modal.tsx",
    "apps/web/src/app/register/page.tsx",
    "apps/web/src/app/login/page.tsx",
    "apps/web/src/lib/i18n/en.ts",
    "apps/web/src/lib/i18n/ar.ts",
    "apps/web/src/lib/i18n/types.ts",
]


def make_tarball() -> str:
    fd, tar_path = tempfile.mkstemp(suffix=".tar.gz")
    os.close(fd)
    with tarfile.open(tar_path, "w:gz") as tar:
        for rel in UPLOAD_PATHS:
            src = REPO / rel
            if not src.exists():
                raise FileNotFoundError(f"Missing: {src}")
            tar.add(src, arcname=rel.replace("\\", "/"))
    return tar_path


def main() -> int:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    tar_path = make_tarball()
    print(f"Created tarball: {tar_path}")

    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(HOST, username="root", password=PASSWORD, timeout=60)
    sftp = client.open_sftp()
    sftp.put(tar_path, f"{PROJECT}/deploy-auth-otp.tar.gz")
    sftp.close()
    os.remove(tar_path)

    resend_from = "ChatLoora <onboarding@resend.dev>"
    cmd = f"""
set -e
cd {PROJECT}
tar xzf deploy-auth-otp.tar.gz
rm -f deploy-auth-otp.tar.gz

if grep -q '^RESEND_API_KEY=' .env; then
  sed -i 's|^RESEND_API_KEY=.*|RESEND_API_KEY={RESEND_KEY}|' .env
else
  echo 'RESEND_API_KEY={RESEND_KEY}' >> .env
fi
if grep -q '^RESEND_FROM_EMAIL=' .env; then
  sed -i 's|^RESEND_FROM_EMAIL=.*|RESEND_FROM_EMAIL=ChatLoora <onboarding@resend.dev>|' .env
else
  echo 'RESEND_FROM_EMAIL=ChatLoora <onboarding@resend.dev>' >> .env
fi

pnpm install --no-frozen-lockfile
pnpm --filter @watsapp/database exec prisma migrate deploy
pnpm --filter @watsapp/database exec prisma generate
pnpm --filter @watsapp/api build
rm -rf apps/web/.next
pnpm --filter @watsapp/web build
pm2 restart api --update-env
pm2 restart web --update-env
sleep 15
curl -sS -w '\\nhealth:%{{http_code}}\\n' https://almutamayiziq.com/api/v1/health
curl -sS -o /dev/null -w 'register:%{{http_code}}\\n' -X POST https://almutamayiziq.com/api/v1/auth/register -H 'Content-Type: application/json' -d '{{}}'
curl -sS -o /dev/null -w 'login:%{{http_code}}\\n' -X POST https://almutamayiziq.com/api/v1/auth/login -H 'Content-Type: application/json' -d '{{}}'
echo AUTH_OTP_DEPLOY_OK
"""
    _, stdout, stderr = client.exec_command(cmd, timeout=900000)
    print(stdout.read().decode("utf-8", errors="replace"))
    err = stderr.read().decode("utf-8", errors="replace")
    if err.strip():
        print("STDERR:", err[-5000:], file=sys.stderr)
    code = stdout.channel.recv_exit_status()
    client.close()
    return code


if __name__ == "__main__":
    raise SystemExit(main())
