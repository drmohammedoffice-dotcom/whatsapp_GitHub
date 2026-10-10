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
SELECT t.slug, p.provider, p.model, (p."encryptedApiKey" IS NOT NULL AND p."encryptedApiKey" != '') AS has_key, p."lastTestOk", p."lastTestMessage"
FROM "AiProviderConfig" p JOIN "Team" t ON t.id = p."teamId";

SELECT s.platform, s."outOfOfficeMessage" IS NOT NULL AS has_ooo, s."businessHours" IS NOT NULL AS has_hours, s."greetingMessage" IS NOT NULL AS has_greeting
FROM "AiSettings" s JOIN "Team" t ON t.id = s."teamId" WHERE t.slug = 'ahmed';

SELECT id, direction, type, LEFT(text, 50) AS text, "createdAt"
FROM "ConversationMessage"
WHERE "teamId" = (SELECT id FROM "Team" WHERE slug = 'ahmed')
ORDER BY "createdAt" DESC LIMIT 5;
SQL""",
    timeout=60,
)
print(stdout.read().decode("utf-8", errors="replace"))

_, stdout, _ = client.exec_command(
    "grep -E 'AI_API_KEY|AI_' /root/whatsapp_GitHub/.env | grep -v SECRET | head -5",
    timeout=30,
)
print("=== ENV ===")
print(stdout.read().decode("utf-8", errors="replace"))

_, stdout, _ = client.exec_command(
    "pm2 logs api --lines 200 --nostream 2>&1 | grep -iE 'AiInbound|orchestrator|No AI provider|AI provider failed|inbound job' | tail -20",
    timeout=30,
)
print("=== AI LOGS ===")
print(stdout.read().decode("utf-8", errors="replace"))

client.close()
