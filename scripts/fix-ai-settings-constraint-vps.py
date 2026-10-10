#!/usr/bin/env python3
import os
import paramiko

HOST = "161.97.140.171"
USER = "root"
PASSWORD = os.environ.get("VPS_PASSWORD", "")

SQL = """
SELECT conname, pg_get_constraintdef(c.oid)
FROM pg_constraint c
JOIN pg_class t ON c.conrelid = t.oid
WHERE t.relname = 'AiSettings';

SELECT platform, count(*) FROM "AiSettings" GROUP BY platform;
"""

FIX = """
ALTER TABLE "AiSettings" DROP CONSTRAINT IF EXISTS "AiSettings_teamId_key";
ALTER TABLE "AiSettings" DROP CONSTRAINT IF EXISTS "AiSettings_teamId_platform_key";
ALTER TABLE "AiSettings" ADD CONSTRAINT "AiSettings_teamId_platform_key" UNIQUE ("teamId", "platform");
"""

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(HOST, username=USER, password=PASSWORD, timeout=30)

print("=== BEFORE ===")
_, stdout, _ = client.exec_command(
    f"psql postgresql://postgres:postgres@localhost:5432/watsapp <<'SQL'\n{SQL}\nSQL",
    timeout=60,
)
print(stdout.read().decode("utf-8", errors="replace"))

print("=== APPLY FIX ===")
_, stdout, stderr = client.exec_command(
    f"psql postgresql://postgres:postgres@localhost:5432/watsapp <<'SQL'\n{FIX}\nSQL",
    timeout=60,
)
print(stdout.read().decode("utf-8", errors="replace"))
print(stderr.read().decode("utf-8", errors="replace"))

print("=== AFTER ===")
_, stdout, _ = client.exec_command(
    f"psql postgresql://postgres:postgres@localhost:5432/watsapp <<'SQL'\n{SQL}\nSQL",
    timeout=60,
)
print(stdout.read().decode("utf-8", errors="replace"))

client.close()
