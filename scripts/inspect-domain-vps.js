#!/usr/bin/env node
const { Client } = require('ssh2');

const cmd = `
set -e
echo '=== nginx sites ==='
ls -la /etc/nginx/sites-enabled/ /etc/nginx/sites-available/ 2>/dev/null || true
echo '=== certs ==='
ls /etc/letsencrypt/live/ 2>/dev/null || true
echo '=== active nginx server_name ==='
grep -R "server_name" /etc/nginx/sites-enabled/ 2>/dev/null | head -40 || true
echo '=== env keys (masked) ==='
for f in /root/whatsapp_GitHub/.env /root/whatsapp_GitHub/apps/web/.env.local /root/whatsapp_GitHub/apps/api/.env; do
  if [ -f "$f" ]; then
    echo "## $f"
    grep -E '^(WEB_PUBLIC_URL|API_PUBLIC_URL|CORS_ORIGINS|NEXT_PUBLIC_|PUBLIC_APP_URL|TIKTOK_REDIRECT|TIKTOK_BUSINESS_REDIRECT|META_.*REDIRECT|GOOGLE_REDIRECT|RESEND_FROM)' "$f" | sed 's/\\(SECRET\\|PASSWORD\\|KEY\\|TOKEN\\)=.*/\\1=***/' || true
  fi
done
echo '=== ssl conf snippet ==='
ls /etc/nginx/sites-enabled/*ssl* /etc/nginx/conf.d/* 2>/dev/null || true
grep -l "ssl_certificate" /etc/nginx/sites-enabled/* /etc/nginx/conf.d/* 2>/dev/null | head -10 || true
`;

const conn = new Client();
conn
  .on('ready', () => {
    conn.exec(cmd, (err, stream) => {
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
