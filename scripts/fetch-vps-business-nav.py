#!/usr/bin/env python3
import os, paramiko
from pathlib import Path
OUT = Path(__file__).resolve().parents[1] / 'tmp' / 'vps-business-nav'
OUT.mkdir(parents=True, exist_ok=True)
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('161.97.140.171', username='root', password=os.environ.get('VPS_PASSWORD',''), timeout=30)
paths = [
    'apps/web/src/components/tiktok/tiktok-business-shell.tsx',
    'apps/web/src/app/tiktok/business/page.tsx',
    'apps/web/src/lib/tiktok-business.ts',
]
sftp = c.open_sftp()
for p in paths:
    local = OUT / Path(p).name
    try:
        sftp.get(f'/root/whatsapp_GitHub/{p}', str(local))
        print('ok', p)
    except Exception as e:
        print('fail', p, e)
sftp.close()
c.close()
