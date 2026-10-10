#!/usr/bin/env python3
import time
import paramiko

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("161.97.140.171", username="root", password="", timeout=60)
time.sleep(8)
cmds = [
    "pm2 list",
    "pm2 logs worker --lines 30 --nostream 2>&1 | tail -n 30",
    "curl -sS -o /dev/null -w 'health:%{http_code}\\n' https://almutamayiziq.com/api/v1/health || true",
    "pm2 logs api --lines 20 --nostream 2>&1 | grep -iE 'Custom Id|ExceptionsHandler|GeminiProvider|key_pool|Nest application' | tail -n 20",
]
for cmd in cmds:
    print("====", cmd[:70])
    _, o, e = c.exec_command(cmd, timeout=90)
    print(o.read().decode("utf-8", "replace"))
    err = e.read().decode("utf-8", "replace")
    if err.strip():
        print("STDERR", err[-1000:])
c.close()
