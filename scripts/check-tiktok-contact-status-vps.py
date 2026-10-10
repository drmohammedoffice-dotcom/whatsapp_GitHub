#!/usr/bin/env python3
import os
import paramiko

HOST = "161.97.140.171"
PASSWORD = os.environ.get("VPS_PASSWORD", "")

cmd = r"""
cd /root/whatsapp_GitHub
DBURL=$(grep -E '^DATABASE_URL=' apps/api/.env 2>/dev/null | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'")
# strip prisma-only query params for psql
PSQLURL=$(python3 - <<'PY'
import os,re
u=os.environ.get('U','')
print(re.sub(r'\?.*$','',u))
PY
)
U="$DBURL" PSQLURL=$(python3 -c "import os,re; print(re.sub(r'\?.*$','', os.environ['U']))")
echo "--- recent conversions ---"
psql "$PSQLURL" -c "SELECT whatsapp_phone, event_name, contact_sent, tiktok_status, (ttclid IS NOT NULL) AS has_ttclid, sent_at, left(coalesce(tiktok_error,''), 100) AS err, created_at FROM tiktok_integration_conversions ORDER BY created_at DESC LIMIT 10;"
echo "--- sent outcomes in logs ---"
pm2 logs api --lines 800 --nostream 2>&1 | grep -E 'outcome.:.sent|/event/track/|Contact failed|tiktokStatus|dispatchContact' | tail -40
"""

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(HOST, username="root", password=PASSWORD, timeout=30)
_, stdout, stderr = client.exec_command(cmd, timeout=120)
print(stdout.read().decode("utf-8", "replace"))
err = stderr.read().decode("utf-8", "replace")
if err.strip():
    print("STDERR:", err[-2000:])
client.close()
