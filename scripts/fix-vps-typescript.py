#!/usr/bin/env python3
import os, sys, paramiko
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("161.97.140.171", username="root", password=os.environ.get("VPS_PASSWORD", ""), timeout=60)
cmd = """
set -e
cd /root/whatsapp_GitHub
pnpm add -D typescript@6.0.3 -w --force
pnpm install
pnpm --filter @watsapp/api exec node -p "require('typescript/package.json').version"
pnpm --filter @watsapp/api build
"""
_, o, e = c.exec_command(cmd, timeout=300000)
print(o.read().decode("utf-8", "replace"))
err = e.read().decode("utf-8", "replace")
if err.strip():
    print("ERR:", err[-4000:])
print("exit", o.channel.recv_exit_status())
c.close()
