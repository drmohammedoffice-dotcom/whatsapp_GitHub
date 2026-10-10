#!/usr/bin/env python3
import os, sys
import paramiko

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

HOST = "161.97.140.171"
USER = "root"
PASSWORD = os.environ.get("VPS_PASSWORD", "")

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(HOST, username=USER, password=PASSWORD, timeout=30)

cmds = [
    "redis-cli LLEN bull:ai-inbound:wait; redis-cli LLEN bull:ai-inbound:active; redis-cli LLEN bull:ai-inbound:failed; redis-cli ZCARD bull:ai-inbound:completed",
    """psql postgresql://postgres:postgres@localhost:5432/watsapp -t -c "SELECT count(*) FROM \\"ConversationEvent\\" WHERE type='AI_REPLY_SENT';" """,
    """psql postgresql://postgres:postgres@localhost:5432/watsapp <<'SQL'
SELECT ce.type, count(*) FROM "ConversationEvent" ce GROUP BY ce.type ORDER BY count DESC LIMIT 10;
SQL""",
    "pm2 logs api --lines 500 --nostream 2>&1 | grep -iE 'AiInbound|orchestrator|AI provider|Skipped empty|Sending.*training|AI_REPLY' | tail -30",
]

for cmd in cmds:
    print(f"\n=== {cmd[:70]} ===")
    _, stdout, stderr = client.exec_command(cmd, timeout=60)
    print(stdout.read().decode("utf-8", errors="replace"))
    err = stderr.read().decode("utf-8", errors="replace")
    if err.strip():
        print(err)

client.close()
