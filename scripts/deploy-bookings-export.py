#!/usr/bin/env python3
"""Deploy bookings edit/delete + smart export range."""
from __future__ import annotations
import os, sys
from pathlib import Path
import paramiko

HOST = "161.97.140.171"
PASSWORD = os.environ.get("VPS_PASSWORD", "")
PROJECT = "/root/whatsapp_GitHub"
REPO = Path(__file__).resolve().parents[1]

FILES = [
    "apps/api/src/bookings/bookings.service.ts",
    "apps/api/src/bookings/bookings.controller.ts",
    "apps/api/src/bookings/dto/booking.dto.ts",
    "apps/api/dist/apps/api/src/bookings/bookings.service.js",
    "apps/api/dist/apps/api/src/bookings/bookings.controller.js",
    "apps/web/src/app/bookings/page.tsx",
    "apps/web/src/lib/i18n/en.ts",
    "apps/web/src/lib/i18n/ar.ts",
    "apps/web/src/lib/i18n/types.ts",
]

def main():
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    # Ensure dto dist folder exists after build
    dto_js = REPO / "apps/api/dist/apps/api/src/bookings/dto/booking.dto.js"
    if dto_js.exists():
        FILES.append("apps/api/dist/apps/api/src/bookings/dto/booking.dto.js")

    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(HOST, username="root", password=PASSWORD, timeout=60)
    sftp = c.open_sftp()
    # ensure remote dto dir
    try:
        sftp.mkdir(f"{PROJECT}/apps/api/src/bookings/dto")
    except OSError:
        pass
    try:
        sftp.mkdir(f"{PROJECT}/apps/api/dist/apps/api/src/bookings/dto")
    except OSError:
        pass
    for rel in FILES:
        local = REPO / rel
        if not local.exists():
            print("SKIP missing", rel)
            continue
        remote = f"{PROJECT}/{rel.replace(chr(92), '/')}"
        print(" ", rel)
        sftp.put(str(local), remote)
    sftp.close()
    cmd = f"""
set -e
cd {PROJECT}
apt-get install -y fonts-dejavu-core 2>/dev/null | tail -3 || true
pnpm --filter @watsapp/web build 2>&1 | tail -12
pm2 restart api web --update-env
sleep 10
curl -sS -o /dev/null -w 'api:%{{http_code}} web:%{{http_code}}\\n' https://almutamayiziq.com/api/v1/health https://almutamayiziq.com/bookings
echo BOOKINGS_EXPORT_OK
"""
    _, o, e = c.exec_command(cmd, timeout=600000)
    print(o.read().decode("utf-8", errors="replace"))
    err = e.read().decode("utf-8", errors="replace")
    if err.strip():
        print("STDERR:", err[-2000:])
    c.close()

if __name__ == "__main__":
    main()
