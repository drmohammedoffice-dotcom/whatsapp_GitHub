#!/usr/bin/env python3
import os
import paramiko

HOST = "161.97.140.171"
PASSWORD = os.environ.get("VPS_PASSWORD", "")
PHONE = "9647829387631"

cmd = f"""
cd /root/whatsapp_GitHub
DBURL=$(grep -E '^DATABASE_URL=' apps/api/.env 2>/dev/null | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'")
PSQLURL=$(python3 -c "import re,sys; print(re.sub(r'[?].*$','', sys.argv[1]))" "$DBURL")

echo "=== conversions for phone ==="
psql "$PSQLURL" -c "SELECT id, click_id, left(coalesce(ttclid,'NULL'),40) AS ttclid, contact_sent, tiktok_status, sent_at, created_at FROM tiktok_integration_conversions WHERE whatsapp_phone LIKE '%{PHONE}%' ORDER BY created_at DESC LIMIT 10;"

echo "=== related clicks ==="
psql "$PSQLURL" -c "SELECT c.id, left(coalesce(c.ttclid,'NULL'),40) AS ttclid, c.created_at, c.integration_id FROM tiktok_integration_clicks c JOIN tiktok_integration_conversions v ON v.click_id = c.id WHERE v.whatsapp_phone LIKE '%{PHONE}%' ORDER BY c.created_at DESC LIMIT 10;"

echo "=== latest clicks overall (any ttclid) ==="
psql "$PSQLURL" -c "SELECT id, left(coalesce(ttclid,'NULL'),40) AS ttclid, created_at FROM tiktok_integration_clicks ORDER BY created_at DESC LIMIT 15;"

echo "=== recent attribution logs ==="
pm2 logs api --lines 400 --nostream 2>&1 | grep -E '{PHONE}|recent_click|no_click|missing|ttclid|TikTokRedirect|outbound' | tail -40
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
