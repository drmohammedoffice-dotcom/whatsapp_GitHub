#!/usr/bin/env python3
"""Deploy client-side error fixes (safe API parsing, pricing routes, global error page)."""
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
    "apps/web/next.config.ts",
    "apps/web/src/lib/safe-href.ts",
    "apps/web/src/lib/landing-api.ts",
    "apps/web/src/app/global-error.tsx",
    "apps/web/src/app/page.tsx",
    "apps/web/src/app/login/page.tsx",
    "apps/web/src/app/register/page.tsx",
    "apps/web/src/app/pricing/page.tsx",
    "apps/web/src/app/pricing/layout.tsx",
    "apps/web/src/app/pricing/payment/page.tsx",
    "apps/web/src/components/billing/pricing-view.tsx",
    "apps/web/src/components/billing/pricing-card.tsx",
    "apps/web/src/components/inbox/inbox-view.tsx",
]


def ensure_dir(sftp: paramiko.SFTPClient, remote: str) -> None:
    parts = remote.replace("\\", "/").split("/")
    for i in range(2, len(parts)):
        d = "/".join(parts[:i])
        try:
            sftp.stat(d)
        except OSError:
            try:
                sftp.mkdir(d)
            except OSError:
                pass


def main() -> int:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(HOST, username="root", password=PASSWORD, timeout=60)
    sftp = client.open_sftp()
    for rel in UPLOAD_PATHS:
        local = REPO / rel
        remote = f"{PROJECT}/{rel.replace(chr(92), '/')}"
        ensure_dir(sftp, remote)
        print("Upload", rel)
        sftp.put(str(local), remote)
    sftp.close()

    cmd = f"""
set -e
cd {PROJECT}
rm -rf apps/web/.next
pnpm --filter @watsapp/web build
pm2 restart web --update-env
sleep 8
curl -sS -o /dev/null -w 'home:%{{http_code}} pricing:%{{http_code}} login:%{{http_code}}\\n' https://almutamayiziq.com/ https://almutamayiziq.com/pricing https://almutamayiziq.com/login
echo CLIENT_ERROR_FIX_OK
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
