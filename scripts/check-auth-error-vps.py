#!/usr/bin/env python3
import os, sys, paramiko
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("161.97.140.171", username="root", password=os.environ.get("VPS_PASSWORD", ""), timeout=60)
_, o, _ = c.exec_command("tail -80 /root/.pm2/logs/api-error.log", timeout=60000)
print(o.read().decode("utf-8", "replace")[-8000:])
c.close()
