#!/usr/bin/env node
/** Fix ALL devices targeting: omit operating_systems (TikTok allows only one OS value). */
const fs = require('fs');
const path = require('path');
const { Client } = require('ssh2');

const HOST = '161.97.140.171';
const USER = 'root';
const PASSWORD = process.env.VPS_PASSWORD || '';
const PROJECT = '/root/whatsapp_GitHub';
const REPO = path.resolve(__dirname, '..');

const UPLOAD_PATHS = [
  'apps/api/src/integrations/tiktok-login-kit/tiktok-ad-publish.service.ts',
  'apps/api/src/integrations/tiktok-login-kit/tiktok-ads.service.ts',
];

function exec(conn, command, timeoutMs = 900000) {
  return new Promise((resolve, reject) => {
    conn.exec(command, (err, stream) => {
      if (err) return reject(err);
      let out = '';
      const timer = setTimeout(() => {
        stream.close();
        reject(new Error(`Command timed out after ${timeoutMs}ms`));
      }, timeoutMs);
      stream.on('close', (code) => {
        clearTimeout(timer);
        resolve({ code: code ?? 0, out });
      });
      stream.on('data', (d) => {
        const s = d.toString();
        out += s;
        process.stdout.write(s);
      });
      stream.stderr.on('data', (d) => process.stderr.write(d.toString()));
    });
  });
}

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
            host: HOST,
            username: USER,
            password: PASSWORD,
            readyTimeout: 120000,
            keepaliveInterval: 15000,
          });
      });
      console.log('SSH connected');
      break;
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

  const sftp = await new Promise((resolve, reject) => {
    conn.sftp((err, s) => (err ? reject(err) : resolve(s)));
  });

  for (const rel of UPLOAD_PATHS) {
    const local = path.join(REPO, rel);
    if (!fs.existsSync(local)) throw new Error(`Missing: ${local}`);
    const remote = `${PROJECT}/${rel.replace(/\\/g, '/')}`;
    console.log('Upload', rel);
    await new Promise((resolve, reject) => {
      sftp.fastPut(local, remote, (err) => (err ? reject(err) : resolve()));
    });
  }

  const result = await exec(
    conn,
    `
set -e
cd ${PROJECT}
grep -q "delete body.operating_systems" apps/api/src/integrations/tiktok-login-kit/tiktok-ad-publish.service.ts
grep -q "systems.length === 1" apps/api/src/integrations/tiktok-login-kit/tiktok-ads.service.ts
if grep -n "operating_systems = \\['ANDROID', 'IOS'\\]" apps/api/src/integrations/tiktok-login-kit/tiktok-ad-publish.service.ts; then
  echo "FAIL: still sending both OS values" >&2
  exit 1
fi
pnpm --filter @watsapp/api build
pm2 restart api --update-env
sleep 8
curl -sS -o /dev/null -w 'api_health:%{http_code}\\n' https://www.chatloora.com/api/v1/health || true
echo DEVICES_ALL_OS_FIX_OK
`,
  );
  conn.end();
  if (result.code !== 0) throw new Error(`Remote deploy failed with code ${result.code}`);
  console.log('Deploy finished');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
