#!/usr/bin/env python3
import os, sys, paramiko
from pathlib import Path
REPO = Path(__file__).resolve().parents[1]
PROJECT = "/root/whatsapp_GitHub"
HOST = "161.97.140.171"
PASSWORD = os.environ.get("VPS_PASSWORD", "")

def main():
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(HOST, username="root", password=PASSWORD, timeout=60)
    sftp = c.open_sftp()
    for rel in [
        "apps/api/src/auth/auth-email.service.ts",
        "packages/database/prisma/schema.prisma",
    ]:
        sftp.put(str(REPO / rel), f"{PROJECT}/{rel.replace(chr(92), '/')}")
        print("Upload", rel)
    sftp.close()
    cmd = f"""
set -e
cd {PROJECT}
pnpm --filter @watsapp/database exec prisma generate
pnpm --filter @watsapp/api build
pm2 restart api --update-env
sleep 8
curl -sS -w '\\nhealth:%{{http_code}}\\n' https://almutamayiziq.com/api/v1/health
echo HOTFIX_OK
"""
    _, o, e = c.exec_command(cmd, timeout=300000)
    sys.stdout.write(o.read().decode("utf-8", errors="replace"))
    err = e.read().decode("utf-8", errors="replace")
    if err.strip():
        print("ERR:", err[-3000:], file=sys.stderr)
    code = o.channel.recv_exit_status()
    c.close()
    return code

if __name__ == "__main__":
    raise SystemExit(main())
