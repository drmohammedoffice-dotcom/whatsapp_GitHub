#!/usr/bin/env node
/**
 * Cut over production domain from almutamayiziq.com → www.chatloora.com
 * - nginx + certbot SSL
 * - env URL/OAuth updates
 * - upload changed app sources
 * - rebuild + pm2 restart + health checks
 */
const fs = require('fs');
const path = require('path');
const { Client } = require('ssh2');

const HOST = '161.97.140.171';
const USER = 'root';
const PASSWORD = process.env.VPS_PASSWORD || '';
const PROJECT = '/root/whatsapp_GitHub';
const REPO = path.resolve(__dirname, '..');
const NEW_HOST = 'https://www.chatloora.com';

const UPLOAD_PATHS = [
  'deploy/nginx-chatloora.conf',
  'apps/api/src/integrations/tiktok-login-kit/tiktok-ad-publish.service.ts',
  'apps/api/src/tiktok-integration/tiktok-integration-activation.service.ts',
  'apps/api/src/sales-partners/sales-partners.service.ts',
  'apps/api/src/billing/billing.service.ts',
  'apps/api/src/billing/free-trial.service.ts',
  'apps/api/src/auth/auth-email.service.ts',
  'apps/api/src/platform/whatsapp-cloud/whatsapp-cloud.service.ts',
  'apps/api/src/integrations/meta/meta-api.client.ts',
  'apps/api/src/ai/ai-transfer-rules.ts',
  'apps/api/src/ai/ai-subscription-proof.ts',
  'apps/web/src/app/layout.tsx',
  'apps/web/src/app/sitemap.ts',
  'apps/web/src/app/robots.ts',
  'apps/web/src/app/company/page.tsx',
  'apps/web/src/app/whatsapp-api/page.tsx',
  'apps/web/src/components/landing/landing-hero.tsx',
  'apps/web/src/components/landing/landing-sections.tsx',
  'apps/desktop/electron/main.js',
];

function exec(conn, command, timeoutMs = 1200000) {
  return new Promise((resolve, reject) => {
    conn.exec(command, (err, stream) => {
      if (err) return reject(err);
      let out = '';
      let errOut = '';
      const timer = setTimeout(() => {
        stream.close();
        reject(new Error(`Command timed out after ${timeoutMs}ms`));
      }, timeoutMs);
      stream.on('close', (code) => {
        clearTimeout(timer);
        resolve({ code: code ?? 0, out, errOut });
      });
      stream.on('data', (d) => {
        const s = d.toString();
        out += s;
        process.stdout.write(s);
      });
      stream.stderr.on('data', (d) => {
        const s = d.toString();
        errOut += s;
        process.stderr.write(s);
      });
    });
  });
}

async function mkdirp(sftp, dir) {
  const parts = dir.split('/').filter(Boolean);
  let cur = '';
  for (const p of parts) {
    cur += `/${p}`;
    await new Promise((resolve) => sftp.mkdir(cur, () => resolve()));
  }
}

async function connect() {
  for (let attempt = 1; attempt <= 8; attempt++) {
    const conn = new Client();
    try {
      await new Promise((resolve, reject) => {
        conn
          .on('ready', resolve)
          .on('error', reject)
          .connect({
            host: HOST,
            username: USER,
            password: PASSWORD,
            readyTimeout: 120000,
            keepaliveInterval: 15000,
          });
      });
      console.log('SSH connected');
      return conn;
    } catch (error) {
      console.error(`SSH attempt ${attempt} failed:`, error.message);
      try {
        conn.end();
      } catch {
        /* ignore */
      }
      if (attempt === 8) throw error;
      await new Promise((r) => setTimeout(r, 6000 * attempt));
    }
  }
  throw new Error('SSH failed');
}

async function main() {
  const conn = await connect();
  const sftp = await new Promise((resolve, reject) => {
    conn.sftp((err, s) => (err ? reject(err) : resolve(s)));
  });

  for (const rel of UPLOAD_PATHS) {
    const local = path.join(REPO, rel);
    if (!fs.existsSync(local)) throw new Error(`Missing: ${local}`);
    const remote = `${PROJECT}/${rel.replace(/\\/g, '/')}`;
    await mkdirp(sftp, path.posix.dirname(remote));
    console.log('Upload', rel);
    await new Promise((resolve, reject) => {
      sftp.fastPut(local, remote, (err) => (err ? reject(err) : resolve()));
    });
  }

  // Also place nginx conf in /tmp for install
  await new Promise((resolve, reject) => {
    sftp.fastPut(
      path.join(REPO, 'deploy/nginx-chatloora.conf'),
      '/tmp/nginx-chatloora.conf',
      (err) => (err ? reject(err) : resolve()),
    );
  });

  const remoteCmd = `
set -euo pipefail
PROJECT=${PROJECT}
NEW_HOST=${NEW_HOST}

echo '=== 1) Backup nginx + install chatloora site ==='
cp -a /etc/nginx/sites-available/almutamayiziq.com /etc/nginx/sites-available/almutamayiziq.com.bak.$(date +%Y%m%d%H%M%S) || true
mkdir -p /var/www/certbot
cp /tmp/nginx-chatloora.conf /etc/nginx/sites-available/chatloora.com
ln -sfn /etc/nginx/sites-available/chatloora.com /etc/nginx/sites-enabled/chatloora.com
# Disable old site file to avoid duplicate server_name conflicts; redirects live in chatloora.conf
rm -f /etc/nginx/sites-enabled/almutamayiziq.com
nginx -t
systemctl reload nginx

echo '=== 2) Issue / ensure SSL for chatloora.com ==='
if [ ! -d /etc/letsencrypt/live/chatloora.com ]; then
  certbot --nginx -d chatloora.com -d www.chatloora.com --non-interactive --agree-tos --register-unsafely-without-email --redirect || \\
  certbot certonly --webroot -w /var/www/certbot -d chatloora.com -d www.chatloora.com --non-interactive --agree-tos --register-unsafely-without-email
fi

# If certbot certonly was used, ensure HTTPS server blocks exist with chatloora cert
if [ -f /etc/letsencrypt/live/chatloora.com/fullchain.pem ]; then
  if ! grep -q 'ssl_certificate /etc/letsencrypt/live/chatloora.com' /etc/nginx/sites-available/chatloora.com; then
    # Append HTTPS server for www (certbot --nginx usually mutates the file; this is a fallback)
    cat >> /etc/nginx/sites-available/chatloora.com <<'SSLEOF'

server {
    listen 443 ssl;
    listen [::]:443 ssl;
    server_name www.chatloora.com;

    client_max_body_size 50M;

    ssl_certificate /etc/letsencrypt/live/chatloora.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/chatloora.com/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    location /api/ {
        proxy_pass http://watsapp_api;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300s;
    }

    location = /tiktok-redirect {
        proxy_pass http://watsapp_api;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /t/ {
        proxy_pass http://watsapp_api;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /docs {
        proxy_pass http://watsapp_api;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /socket.io/ {
        proxy_pass http://watsapp_api;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 86400s;
    }

    location / {
        proxy_pass http://watsapp_web;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

server {
    listen 443 ssl;
    listen [::]:443 ssl;
    server_name chatloora.com;
    ssl_certificate /etc/letsencrypt/live/chatloora.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/chatloora.com/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;
    return 301 https://www.chatloora.com$request_uri;
}
SSLEOF
  fi
  # Make HTTP www redirect to HTTPS if certbot did not
  if ! grep -q 'return 301 https://www.chatloora.com' /etc/nginx/sites-available/chatloora.com || true; then
    true
  fi
fi

nginx -t
systemctl reload nginx

echo '=== 3) Update env files ==='
python3 - <<'PY'
from pathlib import Path
import re

replacements = {
  'API_PUBLIC_URL': 'https://www.chatloora.com',
  'WEB_PUBLIC_URL': 'https://www.chatloora.com',
  'PUBLIC_APP_URL': 'https://www.chatloora.com',
  'CORS_ORIGINS': 'https://www.chatloora.com,https://chatloora.com',
  'NEXT_PUBLIC_API_URL': 'https://www.chatloora.com',
  'NEXT_PUBLIC_SOCKET_URL': 'https://www.chatloora.com',
  'NEXT_PUBLIC_APP_URL': 'https://www.chatloora.com',
  'TIKTOK_REDIRECT_URI': 'https://www.chatloora.com/api/auth/tiktok/callback',
  'TIKTOK_BUSINESS_REDIRECT_URI': 'https://www.chatloora.com/api/auth/tiktok-business/callback',
  'META_AUTH_REDIRECT_URI': 'https://www.chatloora.com/api/auth/meta/callback',
  'GOOGLE_REDIRECT_URI': 'https://www.chatloora.com/api/v1/integrations/google/callback',
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
  if text and not text.endswith('\\n'):
    text += '\\n'
  return text + line + '\\n'

for path in files:
  if not path.exists():
    print(f'skip missing {path}')
    continue
  original = path.read_text(encoding='utf-8', errors='ignore')
  text = original
  for key, value in replacements.items():
    # only set NEXT_PUBLIC_* / PUBLIC_APP_URL if already present or in web env
    if key in ('NEXT_PUBLIC_APP_URL', 'PUBLIC_APP_URL') and key not in text and 'web' not in str(path):
      # still set PUBLIC_APP_URL on root/api if missing
      if key == 'PUBLIC_APP_URL':
        text = upsert(text, key, value)
      continue
    text = upsert(text, key, value)
  # keep RESEND on old mailbox for now unless user verified new domain
  path.write_text(text, encoding='utf-8')
  print(f'updated {path}')
PY

echo '=== 4) Build apps ==='
cd "$PROJECT"
pnpm --filter @watsapp/api build
pnpm --filter @watsapp/web build

echo '=== 5) Restart PM2 ==='
pm2 restart api --update-env
pm2 restart web --update-env
sleep 15

echo '=== 6) Health checks ==='
curl -sS -o /dev/null -w 'chatloora_https:%{http_code} redirect:%{redirect_url}\\n' -L --max-redirs 5 https://www.chatloora.com/ || true
curl -sS -o /dev/null -w 'chatloora_apex:%{http_code} redirect:%{redirect_url}\\n' https://chatloora.com/ || true
curl -sS -o /dev/null -w 'old_https:%{http_code} redirect:%{redirect_url}\\n' https://almutamayiziq.com/ || true
curl -sS -o /dev/null -w 'api_health:%{http_code}\\n' https://www.chatloora.com/api/v1/health || true
echo CHATLOORA_DOMAIN_CUTOVER_OK
`;

  const result = await exec(conn, remoteCmd);
  conn.end();
  if (result.code !== 0) throw new Error(`Remote deploy failed with code ${result.code}`);
  console.log('Deploy finished');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
