#!/usr/bin/env python3
import os
import sys
import paramiko

HOST = "161.97.140.171"
PASSWORD = os.environ.get("VPS_PASSWORD", "")

def run(client, cmd):
    print(f"\n=== {cmd} ===")
    _, o, e = client.exec_command(cmd, timeout=120000)
    out = o.read().decode("utf-8", "replace")
    err = e.read().decode("utf-8", "replace")
    if out.strip():
        print(out[-8000:])
    if err.strip():
        print("ERR:", err[-3000:])

def main():
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(HOST, username="root", password=PASSWORD, timeout=60)
    run(client, "grep -A5 'Error\\|Exception\\|undefined\\|circular' /root/.pm2/logs/api-error.log | tail -80")
    run(client, "cd /root/whatsapp_GitHub/apps/api && timeout 15 node dist/apps/api/src/main.js 2>&1 | head -50")
    client.close()

if __name__ == "__main__":
    main()
