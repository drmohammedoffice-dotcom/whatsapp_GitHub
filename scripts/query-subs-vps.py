#!/usr/bin/env python3
import os, paramiko
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("161.97.140.171", username="root", password=os.environ.get("VPS_PASSWORD", ""), timeout=30)
_, o, _ = c.exec_command(
    "sudo -u postgres psql -d watsapp -c \"\\dt\" | head -40",
    timeout=30000,
)
print(o.read().decode("utf-8", errors="replace"))
c.close()
