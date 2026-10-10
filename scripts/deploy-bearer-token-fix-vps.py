#!/usr/bin/env python3
"""Deploy Invalid bearer token session fix."""
from __future__ import annotations

import os
import sys
from pathlib import Path

import paramiko

HOST = "161.97.140.171"
PASSWORD = os.environ.get("VPS_PASSWORD", "")
PROJECT = "/root/whatsapp_GitHub"
REPO = Path(__file__).resolve().parents[1]

UPLOAD_PATHS = [
    "apps/api/src/auth/jwt-auth.guard.ts",
    "apps/api/src/auth/auth.service.ts",
    "apps/api/src/config/env.ts",
    "apps/web/src/lib/utils.ts",
    "apps/web/src/lib/tiktok-integration.ts",
    "apps/web/src/components/integrations/meta-oauth-connect.tsx",
    "apps/web/src/lib/i18n/ar.ts",
    "apps/web/src/lib/i18n/en.ts",
    "apps/web/src/lib/i18n/types.ts",
]


def main() -> int:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(HOST, username="root", password=PASSWORD, timeout=90)
    sftp = client.open_sftp()
    for rel in UPLOAD_PATHS:
        local = REPO / rel
        remote = f"{PROJECT}/{rel.replace(chr(92), '/')}"
        print("Upload", rel)
        sftp.put(str(local), remote)
    sftp.close()

    cmd = f"""
set -e
cd {PROJECT}
# Lengthen access JWT so expiry flashes are rarer; refresh still renews it.
if grep -q '^JWT_ACCESS_TTL=' .env; then
  sed -i 's/^JWT_ACCESS_TTL=.*/JWT_ACCESS_TTL=2h/' .env
else
  echo 'JWT_ACCESS_TTL=2h' >> .env
fi
pnpm --filter @watsapp/api build
pnpm --filter @watsapp/web build
pm2 restart api web --update-env
sleep 14
curl -sS -o /dev/null -w 'api:%{{http_code}}\\n' https://almutamayiziq.com/api/v1/health
grep '^JWT_ACCESS_TTL=' .env || true
echo BEARER_TOKEN_FIX_OK
"""
    _, stdout, stderr = client.exec_command(cmd, timeout=900000)
    print(stdout.read().decode("utf-8", errors="replace"))
    err = stderr.read().decode("utf-8", errors="replace")
    if err.strip():
        print("STDERR:", err[-4000:], file=sys.stderr)
    code = stdout.channel.recv_exit_status()
    client.close()
    return code


if __name__ == "__main__":
    raise SystemExit(main())
