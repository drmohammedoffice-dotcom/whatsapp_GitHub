#!/usr/bin/env python3
import os, sys, paramiko

HOST = "161.97.140.171"
PASSWORD = os.environ.get("VPS_PASSWORD", "")

def run(client, cmd):
    print(f"\n=== {cmd} ===")
    _, o, e = client.exec_command(cmd, timeout=120000)
    out = o.read().decode("utf-8", "replace")
    err = e.read().decode("utf-8", "replace")
    if out.strip():
        print(out[-10000:])
    if err.strip():
        print("ERR:", err[-2000:])

def main():
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(HOST, username="root", password=PASSWORD, timeout=60)
    run(c, "tail -150 /root/.pm2/logs/api-error.log")
    run(c, "curl -sS -o /dev/null -w 'health:%{http_code}\\n' https://almutamayiziq.com/api/v1/health")
    run(c, "mysql -u root -e \"SHOW COLUMNS FROM subscriptions LIKE 'expired_at';\" whatsapp 2>/dev/null || echo 'mysql skip'")
    c.close()

if __name__ == "__main__":
    main()
