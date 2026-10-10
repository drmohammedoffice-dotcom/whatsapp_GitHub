#!/usr/bin/env python3
import os
import paramiko

HOST = "161.97.140.171"
USER = "root"
PASSWORD = os.environ.get("VPS_PASSWORD", "")

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(HOST, username=USER, password=PASSWORD, timeout=30)

cmds = [
    "pm2 logs api --lines 100 --nostream 2>&1 | grep -iE 'AI|inbound|provider|autoReply|enabled' | tail -40",
    "pm2 logs worker --lines 50 --nostream 2>&1 | tail -30",
    """psql postgresql://postgres:postgres@localhost:5432/watsapp <<'SQL'
SELECT t.slug, s.platform, s.enabled, s."autoReplyEnabled", LEFT(s."systemPromptOverride", 40) AS prompt
FROM "AiSettings" s JOIN "Team" t ON t.id = s."teamId" ORDER BY t.slug, s.platform;

SELECT t.slug, p.provider, p.model, p."hasApiKey" IS NOT NULL AS has_key, p."lastTestOk"
FROM "AiProviderConfig" p JOIN "Team" t ON t.id = p."teamId";

SELECT "aiMode", count(*) FROM "Conversation" GROUP BY "aiMode";

SELECT c.provider, count(*) FROM "Conversation" cv
JOIN "Channel" c ON c.id = cv."channelId"
GROUP BY c.provider;
SQL""",
]

for cmd in cmds:
    print(f"\n=== {cmd[:60]}... ===")
    _, stdout, stderr = client.exec_command(cmd, timeout=60)
    out = stdout.read().decode("utf-8", errors="replace")
    err = stderr.read().decode("utf-8", errors="replace")
    print(out or err)

client.close()
