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
SELECT ce.type, count(*) FROM "ConversationEvent" ce
WHERE ce."conversationId" IN (SELECT id FROM "Conversation" WHERE "teamId" = (SELECT id FROM "Team" WHERE slug='ahmed'))
GROUP BY ce.type ORDER BY count DESC;

SELECT direction, type, LEFT(text, 80) AS text, "createdAt"
FROM "ConversationMessage"
WHERE "teamId" = (SELECT id FROM "Team" WHERE slug='ahmed')
  AND direction = 'OUTBOUND'
ORDER BY "createdAt" DESC LIMIT 10;

SELECT m.direction, m.type, LEFT(m.text, 60) AS text, m."createdAt", c.provider
FROM "ConversationMessage" m
JOIN "Conversation" cv ON cv.id = m."conversationId"
JOIN "Channel" c ON c.id = cv."channelId"
WHERE m."teamId" = (SELECT id FROM "Team" WHERE slug='ahmed')
  AND m."createdAt" > NOW() - INTERVAL '24 hours'
ORDER BY m."createdAt" DESC LIMIT 15;
SQL""",
    timeout=60,
)
print(stdout.read().decode("utf-8", errors="replace"))

_, stdout, _ = client.exec_command(
    "redis-cli KEYS 'bull:ai-inbound:*' 2>/dev/null | head -20; redis-cli LLEN bull:ai-inbound:wait 2>/dev/null; redis-cli LLEN bull:ai-inbound:failed 2>/dev/null",
    timeout=30,
)
print("=== REDIS QUEUE ===")
print(stdout.read().decode("utf-8", errors="replace"))

client.close()
