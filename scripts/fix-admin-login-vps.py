#!/usr/bin/env python3
"""Fix admin login: merge billing/admin schema + prisma generate + restart API."""
import os, sys, paramiko
from pathlib import Path

HOST = "161.97.140.171"
PASSWORD = os.environ.get("VPS_PASSWORD", "")
PROJECT = "/root/whatsapp_GitHub"
REPO = Path(__file__).resolve().parents[1]

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(HOST, username="root", password=PASSWORD, timeout=60)

with c.open_sftp() as sftp:
    sftp.put(str(REPO / "scripts/merge-vps-platform-schema.py"), f"{PROJECT}/scripts/merge-vps-platform-schema.py")
    patch = '''from pathlib import Path
p = Path("apps/api/src/app.module.ts")
s = p.read_text()
if "AdminModule" not in s:
    s = s.replace(
        "import { PlatformModule } from './platform/platform.module';",
        "import { PlatformModule } from './platform/platform.module';\\nimport { AdminModule } from './admin/admin.module';\\nimport { BillingModule } from './billing/billing.module';",
    )
    s = s.replace("PlatformModule,\\n  ],", "PlatformModule,\\n    AdminModule,\\n    BillingModule,\\n  ],")
    p.write_text(s)
    print("app.module patched")
else:
    print("app.module ok")
'''
    with sftp.file(f"{PROJECT}/patch-app.py", "w") as f:
        f.write(patch)

cmd = f"""
set -e
cd {PROJECT}
python3 scripts/merge-vps-platform-schema.py || true
python3 patch-app.py
grep -c AdminRole packages/database/prisma/schema.prisma
pnpm --filter @watsapp/database exec prisma generate
pm2 restart api --update-env
sleep 10
curl -sS -o /dev/null -w 'admin: %{{http_code}}\\n' -X POST http://127.0.0.1:4000/api/v1/admin/auth/login -H 'Content-Type: application/json' -d '{{"email":"test@test.com","password":"wrong"}}'
pm2 status api | grep api
echo ADMIN_RESTORE_OK
"""
_, stdout, stderr = c.exec_command(cmd, timeout=300000)
print(stdout.read().decode("utf-8", errors="replace"))
err = stderr.read().decode("utf-8", errors="replace")
if err.strip():
    print("STDERR:", err[-3000:])
print("exit", stdout.channel.recv_exit_status())
c.close()
