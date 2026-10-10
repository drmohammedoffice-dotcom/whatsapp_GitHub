#!/usr/bin/env python3
import os
import paramiko

HOST = "161.97.140.171"
PASSWORD = os.environ.get("VPS_PASSWORD", "")

cmd = """PGPASSWORD=postgres psql -U postgres -h localhost -d watsapp -t -c "SELECT id, title, \"ctaUrl\", \"isActive\" FROM landing_offers LIMIT 10;" 2>&1"""

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(HOST, username="root", password=PASSWORD, timeout=60)
_, o, e = c.exec_command(cmd, timeout=30000)
print(o.read().decode("utf-8", "replace"))
print(e.read().decode("utf-8", "replace"))
c.close()
