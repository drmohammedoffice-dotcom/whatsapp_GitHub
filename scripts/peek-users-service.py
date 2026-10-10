#!/usr/bin/env python3
import os, paramiko
HOST = "161.97.140.171"
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(HOST, username='root', password=os.environ.get('VPS_PASSWORD',''), timeout=30)
_, o, _ = c.exec_command('head -25 /root/whatsapp_GitHub/apps/api/src/admin/services/admin-users.service.ts')
print(o.read().decode())
c.close()
