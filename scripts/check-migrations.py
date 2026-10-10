#!/usr/bin/env python3
import os, paramiko
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('161.97.140.171', username='root', password=os.environ.get('VPS_PASSWORD',''), timeout=30)
cmd = """
cd /root/whatsapp_GitHub/packages/database
npx prisma migrate status 2>&1 | tail -40
"""
_, o, e = c.exec_command(cmd, timeout=120000)
print(o.read().decode('utf-8', errors='replace'))
print(e.read().decode('utf-8', errors='replace'))
