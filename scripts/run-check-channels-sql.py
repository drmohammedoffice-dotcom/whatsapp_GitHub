#!/usr/bin/env python3
import os, sys
import paramiko

sys.stdout.reconfigure(encoding='utf-8', errors='replace')
HOST = '161.97.140.171'
PROJECT = '/root/whatsapp_GitHub'

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(HOST, username='root', password=os.environ.get('VPS_PASSWORD', ''), timeout=30)

sftp = c.open_sftp()
sftp.put(os.path.join(os.path.dirname(__file__), 'check-channels.sql'), f'{PROJECT}/check-channels.sql')
sftp.close()

_, o, e = c.exec_command(f'PGPASSWORD=postgres psql -h localhost -U postgres -d watsapp -f {PROJECT}/check-channels.sql', timeout=30)
print(o.read().decode('utf-8', 'replace'))
err = e.read().decode('utf-8', 'replace')
if err.strip():
    print('ERR:', err)
c.close()
