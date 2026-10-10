#!/usr/bin/env node
/**
 * Bridge TikTok OAuth after domain cutover:
 * - Point TIKTOK_*_REDIRECT_URI back to almutamayiziq.com (still registered in TikTok portal)
 * - Proxy OAuth callbacks on legacy domain directly to API (no 301)
 * - Restart API
 *
 * Permanent fix: in TikTok Ads Developer Portal set Advertiser Redirect URL to
 * https://www.chatloora.com/api/auth/tiktok-business/callback then flip env back.
 */
const { Client } = require('ssh2');

const remoteScript = String.raw`
set -euo pipefail
ROOT=/root/whatsapp_GitHub
NGINX_AVAIL=/etc/nginx/sites-available/chatloora.com

echo '=== 1) Patch legacy domain OAuth callback proxy (no full overwrite) ==='
python3 - <<'PY'
from pathlib import Path
import re

path = Path('/etc/nginx/sites-available/chatloora.com')
text = path.read_text(encoding='utf-8', errors='ignore')
backup = path.with_suffix(path.suffix + f'.bak.oauth-bridge')
if not backup.exists():
    backup.write_text(text, encoding='utf-8')

oauth = '''
    # OAuth callbacks must hit the API without 301 (TikTok redirect_uri exact match)
    location ^~ /api/auth/tiktok {
        proxy_pass http://watsapp_api;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300s;
    }

    location ^~ /api/auth/meta {
        proxy_pass http://watsapp_api;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300s;
    }

    location ^~ /api/v1/integrations/google/callback {
        proxy_pass http://watsapp_api;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300s;
    }
'''

# Inject into every almutamayiziq server block, before the catch-all 301 location /
pattern = re.compile(
    r'(server_name\s+almutamayiziq\.com\s+www\.almutamayiziq\.com;\s*)(.*?)(location\s+/\s*\{\s*return\s+301\s+https://www\.chatloora\.com\$request_uri;\s*\})',
    re.S,
)

def inject(match):
    head, middle, tail = match.group(1), match.group(2), match.group(3)
    if '/api/auth/tiktok' in middle:
        return match.group(0)
    return head + middle + oauth + '\n    ' + tail

new_text, n = pattern.subn(inject, text)
if n == 0:
    raise SystemExit('ERROR: could not find almutamayiziq server blocks to patch')
path.write_text(new_text, encoding='utf-8')
print(f'patched {n} legacy server block(s)')
PY

nginx -t
systemctl reload nginx

echo '=== 2) Point TikTok redirect URIs at legacy domain (portal match) ==='
python3 - <<'PY'
from pathlib import Path
import re

replacements = {
  'TIKTOK_REDIRECT_URI': 'https://almutamayiziq.com/api/auth/tiktok/callback',
  'TIKTOK_BUSINESS_REDIRECT_URI': 'https://almutamayiziq.com/api/auth/tiktok-business/callback',
}
files = [
  Path('/root/whatsapp_GitHub/.env'),
  Path('/root/whatsapp_GitHub/apps/api/.env'),
  Path('/root/whatsapp_GitHub/apps/web/.env.local'),
]

def upsert(text: str, key: str, value: str) -> str:
  pattern = re.compile(rf'^{re.escape(key)}=.*$', re.M)
  line = f'{key}={value}'
  if pattern.search(text):
    return pattern.sub(line, text)
  if text and not text.endswith('\n'):
    text += '\n'
  return text + line + '\n'

for path in files:
  if not path.exists():
    print(f'skip missing {path}')
    continue
  original = path.read_text(encoding='utf-8', errors='ignore')
  text = original
  for key, value in replacements.items():
    text = upsert(text, key, value)
  if text != original:
    path.write_text(text, encoding='utf-8')
    print(f'updated {path}')
  else:
    print(f'unchanged {path}')
PY

echo '=== 3) Restart API ==='
cd "$ROOT"
pm2 restart whatsapp-api --update-env 2>/dev/null || pm2 restart watsapp-api --update-env 2>/dev/null || pm2 restart all --update-env
sleep 4
pm2 list | head -30 || true

echo '=== 4) Verify ==='
grep -E '^(TIKTOK_REDIRECT_URI|TIKTOK_BUSINESS_REDIRECT_URI)=' /root/whatsapp_GitHub/.env
curl -sS -o /dev/null -w 'legacy_business_cb:%{http_code} redirect:%{redirect_url}\n' 'https://almutamayiziq.com/api/auth/tiktok-business/callback' || true
curl -sS -o /dev/null -w 'new_business_cb:%{http_code}\n' 'https://www.chatloora.com/api/auth/tiktok-business/callback' || true
echo TIKTOK_OAUTH_REDIRECT_BRIDGE_OK
`;

const conn = new Client();
conn
  .on('ready', () => {
    conn.exec(remoteScript, (err, stream) => {
      if (err) throw err;
      stream.on('data', (d) => process.stdout.write(d));
      stream.stderr.on('data', (d) => process.stderr.write(d));
      stream.on('close', (code) => {
        conn.end();
        process.exit(code || 0);
      });
    });
  })
  .on('error', (e) => {
    console.error(e);
    process.exit(1);
  })
  .connect({
    host: '161.97.140.171',
    username: 'root',
    password: process.env.VPS_PASSWORD || '',
    readyTimeout: 120000,
  });
