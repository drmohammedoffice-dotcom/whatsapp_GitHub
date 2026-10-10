#!/usr/bin/env node
const { Client } = require('ssh2');

const cmd = `
set -e
sleep 2
echo '=== correct path api/v1 ==='
curl -sS -o /tmp/reset_body.txt -w 'post_reset:%{http_code}\\n' -X POST https://www.chatloora.com/api/v1/auth/reset-password \\
  -H 'content-type: application/json' -d '{"email":"nonexistent-reset-probe@chatloora.com"}'
head -c 300 /tmp/reset_body.txt; echo
echo '=== compiled email method present ==='
grep -n "sendPasswordResetEmail\\|Password reset email queued" /root/whatsapp_GitHub/apps/api/dist/auth/auth-email.service.js /root/whatsapp_GitHub/apps/api/dist/auth/auth.service.js 2>/dev/null | head -10 || \\
grep -n "sendPasswordResetEmail\\|Password reset email queued" /root/whatsapp_GitHub/apps/api/dist/**/*.js 2>/dev/null | head -10 || true
ls /root/whatsapp_GitHub/apps/api/dist/auth/ | head
echo PASSWORD_RESET_VERIFY_OK
`;

async function main() {
  let conn;
  for (let attempt = 1; attempt <= 8; attempt++) {
    conn = new Client();
    try {
      await new Promise((resolve, reject) => {
        conn
          .on('ready', resolve)
          .on('error', reject)
          .connect({
            host: '161.97.140.171',
            username: 'root',
            password: process.env.VPS_PASSWORD || '',
            readyTimeout: 120000,
            keepaliveInterval: 15000,
          });
      });
      break;
    } catch (error) {
      console.error(`SSH attempt ${attempt} failed:`, error.message);
      try {
        conn.end();
      } catch {
        /* ignore */
      }
      if (attempt === 8) throw error;
      await new Promise((r) => setTimeout(r, 5000 * attempt));
    }
  }

  await new Promise((resolve, reject) => {
    conn.exec(cmd, (err, stream) => {
      if (err) return reject(err);
      stream.on('data', (d) => process.stdout.write(d));
      stream.stderr.on('data', (d) => process.stderr.write(d));
      stream.on('close', (code) => {
        conn.end();
        if (code) reject(new Error(`exit ${code}`));
        else resolve();
      });
    });
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
