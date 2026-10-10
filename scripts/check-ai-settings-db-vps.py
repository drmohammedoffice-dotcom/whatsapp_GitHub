#!/usr/bin/env python3
import os
import paramiko

HOST = "161.97.140.171"
USER = "root"
PASSWORD = os.environ.get("VPS_PASSWORD", "")

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(HOST, username=USER, password=PASSWORD, timeout=30)

_, stdout, _ = client.exec_command(
    """psql postgresql://postgres:postgres@localhost:5432/watsapp <<'SQL'
SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'AiSettings';
SELECT id, "teamId", platform FROM "AiSettings";
SQL""",
    timeout=60,
)
print(stdout.read().decode("utf-8", errors="replace"))

# grep schema on server
_, stdout, _ = client.exec_command(
    "grep -A 30 'model AiSettings' /root/whatsapp_GitHub/packages/database/prisma/schema.prisma | head -35",
    timeout=30,
)
print("=== SCHEMA ===")
print(stdout.read().decode("utf-8", errors="replace"))

client.close()
