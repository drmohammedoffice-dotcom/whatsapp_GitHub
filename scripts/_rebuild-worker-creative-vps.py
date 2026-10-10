#!/usr/bin/env python3
import sys
import paramiko

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("161.97.140.171", username="root", password="", timeout=60)

cmd = r"""
set -e
cd /root/whatsapp_GitHub
echo '--- SRC core module ---'
grep -nE 'BillingModule|CreativeEntitlements' apps/api/src/creative-studio/creative-studio.core.module.ts || true
ls -la apps/api/src/creative-studio/creative-entitlements.module.ts
echo '--- rebuild worker clean ---'
rm -rf apps/worker/dist
pnpm --filter @watsapp/worker build
echo '--- DIST core module ---'
head -n 30 apps/worker/dist/apps/api/src/creative-studio/creative-studio.core.module.js
grep -nE 'billing|entitlements|jwt' apps/worker/dist/apps/api/src/creative-studio/creative-studio.core.module.js || true
pm2 restart worker --update-env
sleep 6
pm2 jlist | python3 -c "import sys,json; data=json.load(sys.stdin);
[print(p['name'], p['pm2_env']['status'], p['pm2_env'].get('restart_time')) for p in data]"
pm2 logs worker --lines 20 --nostream | tail -n 25
echo WORKER_REBUILD_OK
"""

_, o, e = c.exec_command(cmd, timeout=300)
print(o.read().decode("utf-8", "replace"))
err = e.read().decode("utf-8", "replace")
if err.strip():
    print("STDERR:", err[-3000:])
c.close()
