#!/usr/bin/env python3
import os
import time
import paramiko

HOST = "161.97.140.171"
PASSWORD = os.environ.get("VPS_PASSWORD", "")

time.sleep(10)
client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(HOST, username="root", password=PASSWORD, timeout=30)
_, stdout, stderr = client.exec_command(
    """
pm2 list | head -20
curl -sS -o /dev/null -w "API=%{http_code}\\n" https://almutamayiziq.com/api/v1/health || true
curl -sS https://almutamayiziq.com/api/v1/health || true
echo
tail -n 40 /root/.pm2/logs/api-error.log
""",
    timeout=60,
)
print(stdout.read().decode("utf-8", "replace"))
err = stderr.read().decode("utf-8", "replace")
if err.strip():
    print(err[-2000:])
client.close()
