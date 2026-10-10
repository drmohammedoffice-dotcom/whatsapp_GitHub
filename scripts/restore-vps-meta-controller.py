#!/usr/bin/env python3
import os, sys
import paramiko
sys.stdout.reconfigure(encoding='utf-8', errors='replace')
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('161.97.140.171', username='root', password=os.environ.get('VPS_PASSWORD', ''), timeout=30)
script = """
set -e
cd /root/whatsapp_GitHub
# Legacy meta.controller must not require MetaOAuthService (handled by MetaPublicModule)
git checkout apps/api/src/integrations/meta/meta.controller.ts
pnpm --filter @watsapp/api build
pm2 restart api --update-env
sleep 10
echo -n health:
curl -sS -o /dev/null -w "%{http_code}\n" https://almutamayiziq.com/api/v1/health
echo -n meta:
curl -sS -o /dev/null -w "%{http_code}\n" "https://almutamayiziq.com/api/auth/meta/callback?code=test&state=test"
"""
_, o, e = c.exec_command(script, timeout=300)
print(o.read().decode('utf-8', errors='replace'))
c.close()
