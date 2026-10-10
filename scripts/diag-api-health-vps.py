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
        print(out)
    if err.strip():
        print("ERR:", err[-3000:])

def main():
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(HOST, username="root", password=PASSWORD, timeout=60)
    run(client, "pm2 list")
    run(client, "curl -sS -w '\\nhealth:%{http_code}\\n' https://almutamayiziq.com/api/v1/health || true")
    run(client, "pm2 logs api --lines 60 --nostream 2>&1 | tail -70")
    run(client, "pm2 describe api 2>&1 | tail -30")
    client.close()

if __name__ == "__main__":
    main()
