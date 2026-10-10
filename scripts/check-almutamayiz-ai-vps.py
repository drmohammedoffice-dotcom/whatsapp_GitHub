#!/usr/bin/env python3
import os, sys
import paramiko

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect("161.97.140.171", username="root", password=os.environ.get("VPS_PASSWORD", ""), timeout=30)

_, stdout, _ = client.exec_command(
    """psql postgresql://postgres:postgres@localhost:5432/watsapp <<'SQL'
SELECT c.name, c.status, ch.provider, (ct.id IS NOT NULL) AS has_token,
  count(cv.id) AS conversations,
  max(cv."lastMessageAt") AS last_msg
FROM "Conversation" cv
JOIN "Channel" ch ON ch.id = cv."channelId"
JOIN "Channel" c ON c.id = ch.id
LEFT JOIN "ChannelToken" ct ON ct."channelId" = ch.id
WHERE cv."teamId" = (SELECT id FROM "Team" WHERE slug = 'ahmed')
GROUP BY c.name, c.status, ch.provider, ct.id
ORDER BY last_msg DESC NULLS LAST
LIMIT 10;

SELECT m.type, m.direction, LEFT(COALESCE(m.text,''), 60) AS text, m."createdAt", ch.name AS channel
FROM "ConversationMessage" m
JOIN "Conversation" cv ON cv.id = m."conversationId"
JOIN "Channel" ch ON ch.id = cv."channelId"
WHERE m."teamId" = (SELECT id FROM "Team" WHERE slug = 'ahmed')
  AND ch.name LIKE '%almutamayiz%'
ORDER BY m."createdAt" DESC LIMIT 10;
SQL""",
    timeout=60,
)
print(stdout.read().decode("utf-8", errors="replace"))
client.close()
