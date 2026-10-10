#!/usr/bin/env python3
import os, sys
import paramiko

HOST = "161.97.140.171"
PASSWORD = os.environ.get("VPS_PASSWORD", "")
PROJECT = "/root/whatsapp_GitHub"

def main():
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(HOST, username="root", password=PASSWORD, timeout=60)
    cmd = f"""
cd {PROJECT}/packages/database
node - <<'NODE'
const {{ PrismaClient }} = require('@prisma/client');
const p = new PrismaClient();
(async () => {{
  const subs = await p.subscription.findMany({{ include: {{ plan: true }} }});
  for (const s of subs) {{
    console.log(JSON.stringify({{
      teamId: s.teamId,
      status: s.status,
      end: s.currentPeriodEnd,
      plan: s.plan?.name,
      billing: s.billingCycle,
    }}));
  }}
  await p.$disconnect();
}})();
NODE
"""
    _, o, e = c.exec_command(cmd, timeout=30000)
    print(o.read().decode("utf-8", errors="replace"))
    err = e.read().decode("utf-8", errors="replace")
    if err.strip():
        print("STDERR:", err[-2000:])
    c.close()

if __name__ == "__main__":
    main()
