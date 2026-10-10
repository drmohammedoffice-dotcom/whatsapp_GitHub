#!/usr/bin/env python3
"""Quick SSH status check on production VPS."""
import os
import sys
import paramiko

HOST = "161.97.140.171"
USER = "root"
PASSWORD = os.environ.get("VPS_PASSWORD", "")

cmd = sys.argv[1] if len(sys.argv) > 1 else "pm2 list; curl -s http://127.0.0.1:4000/api/v1/health"

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(HOST, username=USER, password=PASSWORD, timeout=30)
_, stdout, stderr = client.exec_command(cmd, timeout=120)
out = stdout.read().decode("utf-8", errors="replace")
err = stderr.read().decode("utf-8", errors="replace")
print(out.encode("ascii", errors="replace").decode("ascii"))
if err.strip():
    print(err.encode("ascii", errors="replace").decode("ascii"), file=sys.stderr)
print("EXIT:", stdout.channel.recv_exit_status())
client.close()
