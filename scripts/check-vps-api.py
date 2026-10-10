#!/usr/bin/env python3
import os
import sys
import paramiko

PASSWORD = os.environ.get("VPS_PASSWORD", "")


def main() -> int:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect("161.97.140.171", username="root", password=PASSWORD, timeout=60)
    cmds = [
        "pm2 list",
        "pm2 logs api --lines 100 --nostream",
        "curl -sS -o /dev/null -w 'api_v1:%{http_code}\\n' https://almutamayiziq.com/api/v1/health || true",
        "curl -sS -o /dev/null -w 'api:%{http_code}\\n' https://almutamayiziq.com/api/health || true",
        "pm2 describe api | head -40",
    ]
    for cmd in cmds:
        print("====", cmd)
        _, stdout, stderr = client.exec_command(cmd, timeout=120)
        print(stdout.read().decode("utf-8", errors="replace"))
        err = stderr.read().decode("utf-8", errors="replace")
        if err.strip():
            print("ERR:", err[-3000:])
    client.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
