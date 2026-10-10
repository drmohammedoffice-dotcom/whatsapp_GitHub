#!/usr/bin/env node
/** Inspect TikTok Marketing OAuth redirect config + recent logs on VPS. */
const { Client } = require('ssh2');

const cmd = `
set -e
echo '=== redirect env ==='
grep -E '^(TIKTOK_BUSINESS_REDIRECT_URI|TIKTOK_REDIRECT_URI|TIKTOK_BUSINESS_APP_ID|API_PUBLIC_URL)=' /root/whatsapp_GitHub/.env \\
  | sed -E 's/(TIKTOK_BUSINESS_APP_ID=)(.{0,4}).*/\\1\\2…/'
echo '=== callback HTTP ==='
curl -sS -o /dev/null -w 'business_cb:%{http_code}\\n' 'https://www.chatloora.com/api/auth/tiktok-business/callback' || true
curl -sS -o /dev/null -w 'login_cb:%{http_code}\\n' 'https://www.chatloora.com/api/auth/tiktok/callback' || true
echo '=== recent Marketing OAuth logs ==='
pm2 logs whatsapp-api --lines 120 --nostream 2>/dev/null | grep -iE 'Marketing OAuth|redirect_uri|authorize URL' | tail -50 || true
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
