#!/usr/bin/env node
/** Auto-seed Contact/Lead/Purchase on new pixel create (no WhatsApp needed). */
const fs = require('fs');
const path = require('path');
const { Client } = require('ssh2');

const HOST = '161.97.140.171';
const USER = 'root';
const PASSWORD = process.env.VPS_PASSWORD || '';
const PROJECT = '/root/whatsapp_GitHub';
const REPO = path.resolve(__dirname, '..');

const UPLOAD_PATHS = [
  'apps/api/src/tiktok-integration/tiktok-integration.constants.ts',
  'apps/api/src/tiktok-integration/tiktok-integration-activation.service.ts',
  'apps/api/src/tiktok-integration/tiktok-integration.service.ts',
  'apps/web/src/lib/i18n/ar.ts',
  'apps/web/src/lib/i18n/en.ts',
];

function exec(conn, command, timeoutMs = 900000) {
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
    await mkdirp(sftp, path.posix.dirname(remote));
    console.log('Upload', rel);
    await new Promise((resolve, reject) => {
      sftp.fastPut(local, remote, (err) => (err ? reject(err) : resolve()));
    });
  }

  const cmd = `
set -e
cd ${PROJECT}
grep -q "activationOptimizationSeedEvents" apps/api/src/tiktok-integration/tiktok-integration.constants.ts
grep -q "optimization seed" apps/api/src/tiktok-integration/tiktok-integration-activation.service.ts
pnpm --filter @watsapp/api build
pnpm --filter @watsapp/web build
pm2 restart api --update-env
pm2 restart web --update-env
sleep 12
curl -sS -o /dev/null -w 'api_health:%{http_code}\\n' https://www.chatloora.com/api/v1/health || true
curl -sS -o /dev/null -w 'web_home:%{http_code}\\n' https://www.chatloora.com/ || true
echo PIXEL_OPT_SEEDS_OK
`;
  const result = await exec(conn, cmd);
  conn.end();
  if (result.code !== 0) throw new Error(`Remote deploy failed with code ${result.code}`);
  console.log('Deploy finished');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
