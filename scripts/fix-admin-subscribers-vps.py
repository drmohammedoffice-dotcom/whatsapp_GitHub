#!/usr/bin/env python3
from __future__ import annotations
import os, sys
from pathlib import Path
import paramiko

HOST = "161.97.140.171"
USER = "root"
PASSWORD = os.environ.get("VPS_PASSWORD", "")
PROJECT = "/root/whatsapp_GitHub"
REPO = Path(__file__).resolve().parents[1]

def main() -> int:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(HOST, username=USER, password=PASSWORD, timeout=30)
    sftp = c.open_sftp()
    sftp.put(str(REPO / "scripts" / "fix-admin-relations.py"), f"{PROJECT}/fix-admin-relations.py")
    sftp.close()
    cmd = f"cd {PROJECT} && python3 fix-admin-relations.py && pnpm --filter @watsapp/api build && pm2 restart api --update-env && sleep 5 && echo OK"
    _, stdout, stderr = c.exec_command(cmd, timeout=300000)
    print(stdout.read().decode("utf-8", errors="replace"))
    err = stderr.read().decode("utf-8", errors="replace")
    if err.strip():
        print("STDERR:", err[-4000:])
    return stdout.channel.recv_exit_status()

if __name__ == "__main__":
    raise SystemExit(main())
