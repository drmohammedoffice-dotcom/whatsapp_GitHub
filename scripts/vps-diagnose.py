#!/usr/bin/env python3
import os
import sys
import paramiko

HOST = "161.97.140.171"
USER = "root"
PASSWORD = os.environ.get("VPS_PASSWORD", "")

def run(cmd: str, timeout: int = 120) -> str:
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(HOST, username=USER, password=PASSWORD, timeout=30)
    _, stdout, stderr = c.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode("utf-8", errors="replace")
    err = stderr.read().decode("utf-8", errors="replace")
    c.close()
    return out + ("\nSTDERR:\n" + err if err.strip() else "")

if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    cmd = sys.argv[1] if len(sys.argv) > 1 else "cd /root/whatsapp_GitHub && pnpm --filter @watsapp/api build 2>&1 | grep -c 'error TS'"
    print(run(cmd))
