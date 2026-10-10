#!/usr/bin/env python3
import os, sys
import paramiko

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect("161.97.140.171", username="root", password=os.environ.get("VPS_PASSWORD", ""), timeout=30)

_, stdout, _ = client.exec_command(
    """psql postgresql://postgres:postgres@localhost:5432/watsapp <<'SQL'
SELECT m.direction, m.type, LEFT(COALESCE(m.text,''), 100) AS text, m."createdAt"
FROM "ConversationMessage" m
JOIN "Conversation" cv ON cv.id = m."conversationId"
JOIN "Channel" ch ON ch.id = cv."channelId"
WHERE ch.name LIKE '%almutamayiz%'
  AND m."createdAt" >= '2026-07-03 22:30:00'
ORDER BY m."createdAt";

SELECT ce.type, ce."createdAt", ce.metadata::text
FROM "ConversationEvent" ce
JOIN "Conversation" cv ON cv.id = ce."conversationId"
JOIN "Channel" ch ON ch.id = cv."channelId"
WHERE ch.name LIKE '%almutamayiz%'
  AND ce."createdAt" >= '2026-07-03 22:30:00'
ORDER BY ce."createdAt" DESC LIMIT 10;
SQL""",
    timeout=60,
)
print(stdout.read().decode("utf-8", errors="replace"))
client.close()
