#!/usr/bin/env python3
import os, paramiko
from pathlib import Path
out = Path(__file__).resolve().parents[1] / 'tmp' / 'vps-redirect-check.txt'
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('161.97.140.171', username='root', password=os.environ.get('VPS_PASSWORD',''), timeout=30)
cmds = [
    "curl -s -o /dev/null -w 'step1: %{http_code} loc: %{redirect_url}\\n' 'https://almutamayiziq.com/r/5tx7lb9w?ttclid=TESTCLICK123'",
    "curl -s -o /dev/null -w 'api: %{http_code} loc: %{redirect_url}\\n' 'http://127.0.0.1:4000/r/5tx7lb9w?ttclid=TESTCLICK456'",
    "sleep 2; pm2 logs api --lines 60 --nostream 2>/dev/null | grep -iE 'event/track|trackPixel|pixel=|Pixel events' | tail -15",
    "sudo -u postgres psql -d watsapp -c 'SELECT id, ttclid, page_view_sent, optimization_event_sent, events_payload FROM tiktok_integration_clicks ORDER BY created_at DESC LIMIT 3;' 2>/dev/null",
]
text = []
for cmd in cmds:
    _, o, e = c.exec_command(cmd, timeout=90000)
    text.append(f'$ {cmd[:100]}\n{o.read().decode("utf-8",errors="replace")}\n{e.read().decode("utf-8",errors="replace")}\n---')
out.write_text('\n'.join(text), encoding='utf-8')
print('done')
c.close()
