#!/usr/bin/env python3
import os
import re
import paramiko

HOST = "161.97.140.171"
PASSWORD = os.environ.get("VPS_PASSWORD", "")

cmd = r"""
cd /root/whatsapp_GitHub
DBURL=$(grep -E '^DATABASE_URL=' apps/api/.env 2>/dev/null | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'")
PSQLURL=$(python3 -c "import os,re; print(re.sub(r'[?].*$','', '''$DBURL'''))")

echo "=== conversion counts ==="
psql "$PSQLURL" -c "SELECT event_name, contact_sent, tiktok_status, count(*) FROM tiktok_integration_conversions GROUP BY 1,2,3 ORDER BY count(*) DESC;"

echo "=== last 12 conversions ==="
psql "$PSQLURL" -c "SELECT left(whatsapp_phone,20) AS phone, event_name, contact_sent, tiktok_status, (ttclid IS NOT NULL) AS has_ttclid, sent_at, left(coalesce(tiktok_error,''),120) AS err FROM tiktok_integration_conversions ORDER BY created_at DESC LIMIT 12;"

echo "=== event/track posts recently ==="
pm2 logs api --lines 2000 --nostream 2>&1 | grep -E 'POST /event/track/|outcome.:.sent|outcome.:.failed|Activation\]' | tail -60

echo "=== contact vs pageview counts in recent logs ==="
pm2 logs api --lines 3000 --nostream 2>&1 | grep -c 'event=Contact' || true
pm2 logs api --lines 3000 --nostream 2>&1 | grep -c 'event=PageView' || true
pm2 logs api --lines 3000 --nostream 2>&1 | grep -c 'event=ViewContent' || true
"""

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(HOST, username="root", password=PASSWORD, timeout=60)
_, stdout, stderr = client.exec_command(cmd, timeout=180)
print(stdout.read().decode("utf-8", "replace"))
err = stderr.read().decode("utf-8", "replace")
if err.strip():
    print("STDERR:", err[-2500:])
client.close()
