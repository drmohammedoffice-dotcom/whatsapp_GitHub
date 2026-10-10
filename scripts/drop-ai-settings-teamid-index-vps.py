#!/usr/bin/env python3
import os
import paramiko

HOST = "161.97.140.171"
USER = "root"
PASSWORD = os.environ.get("VPS_PASSWORD", "")

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(HOST, username=USER, password=PASSWORD, timeout=30)

_, stdout, stderr = client.exec_command(
    """psql postgresql://postgres:postgres@localhost:5432/watsapp <<'SQL'
DROP INDEX IF EXISTS "AiSettings_teamId_key";
SELECT indexname FROM pg_indexes WHERE tablename = 'AiSettings';
SQL""",
    timeout=60,
)
print(stdout.read().decode("utf-8", errors="replace"))
print(stderr.read().decode("utf-8", errors="replace"))
client.close()
