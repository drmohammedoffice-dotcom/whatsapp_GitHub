#!/usr/bin/env node
const { Client } = require('ssh2');

const cmd = `
set -e
sleep 6
echo '=== health ==='
curl -sS -o /dev/null -w 'www:%{http_code}\\n' https://www.chatloora.com/ || true
curl -sS -o /dev/null -w 'api_docs:%{http_code}\\n' https://www.chatloora.com/docs || true
curl -sS -o /dev/null -w 'legacy_cb:%{http_code} redir:%{redirect_url}\\n' 'https://almutamayiziq.com/api/auth/tiktok-business/callback' || true
curl -sS -o /dev/null -w 'new_cb:%{http_code}\\n' 'https://www.chatloora.com/api/auth/tiktok-business/callback' || true
echo '=== nginx oauth locations ==='
grep -n 'upstream\\|watsapp_api\\|api/auth/tiktok\\|server_name almutamayiziq' /etc/nginx/sites-available/chatloora.com | head -50
echo '=== pm2 ==='
pm2 list
echo '=== api log tail ==='
pm2 logs api --lines 30 --nostream 2>/dev/null | tail -40 || true
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
