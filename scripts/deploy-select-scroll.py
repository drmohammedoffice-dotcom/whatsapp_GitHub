#!/usr/bin/env python3
import os, sys, tarfile, tempfile
from pathlib import Path
import paramiko

sys.stdout.reconfigure(encoding='utf-8', errors='replace')
repo = Path(__file__).resolve().parents[1]
files = [
    'apps/web/src/app/integrations/meta/select/page.tsx',
    'apps/web/src/lib/i18n/ar.ts',
    'apps/web/src/lib/i18n/en.ts',
    'apps/web/src/lib/i18n/types.ts',
]
fd, tar_path = tempfile.mkstemp(suffix='.tar.gz')
os.close(fd)
with tarfile.open(tar_path, 'w:gz') as tar:
    for f in files:
        tar.add(repo / f, arcname=f.replace('\\', '/'))

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('161.97.140.171', username='root', password=os.environ.get('VPS_PASSWORD', ''), timeout=30)
sftp = c.open_sftp()
sftp.put(tar_path, '/root/whatsapp_GitHub/patch.tar.gz')
sftp.close()
os.remove(tar_path)

cmd = """
set -e
cd /root/whatsapp_GitHub
tar xzf patch.tar.gz && rm patch.tar.gz
pnpm --filter @watsapp/web build
pm2 restart web --update-env
sleep 5
curl -sS -o /dev/null -w "select-page:%{http_code}\\n" https://almutamayiziq.com/integrations/meta/select
echo PATCH_SCROLL_OK
"""
_, o, e = c.exec_command(cmd, timeout=600)
print(o.read().decode())
err = e.read().decode()
if err.strip():
    print('ERR:', err[-2000:])
c.close()
