#!/usr/bin/env node
/** Deploy TikTok Ads OAuth session-preserve fix (returnOrigin). */
const fs = require('fs');
const path = require('path');
const { Client } = require('ssh2');

const HOST = '161.97.140.171';
const USER = 'root';
const PASSWORD = process.env.VPS_PASSWORD || '';
const PROJECT = '/root/whatsapp_GitHub';
const REPO = path.resolve(__dirname, '..');

const UPLOAD_PATHS = [
  'apps/api/src/integrations/tiktok-login-kit/tiktok-marketing-oauth.service.ts',
  'apps/api/src/integrations/tiktok-login-kit/tiktok-marketing-oauth.controller.ts',
  'apps/api/src/integrations/tiktok-login-kit/tiktok-business-public.controller.ts',
  'apps/api/src/integrations/tiktok-login-kit/__tests__/tiktok-marketing-return-origin.spec.ts',
  'apps/api/src/tiktok-integration/tiktok-integration.service.ts',
  'apps/api/src/tiktok-integration/tiktok-integration.controller.ts',
  'apps/web/src/lib/tiktok-business.ts',
  'apps/web/src/lib/tiktok-integration.ts',
  'apps/web/src/app/tiktok/page.tsx',
  'apps/web/src/app/tiktok/business/page.tsx',
  'apps/web/src/app/settings/tiktok-business/page.tsx',
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

function uploadFile(sftp, local, remote) {
  return new Promise((resolve, reject) => {
    sftp.fastPut(local, remote, (err) => (err ? reject(err) : resolve()));
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
  const conn = new Client();
  await new Promise((resolve, reject) => {
    conn.on('ready', resolve).on('error', reject).connect({
      host: HOST,
      username: USER,
      password: PASSWORD,
      readyTimeout: 60000,
    });
  });
  const sftp = await new Promise((resolve, reject) => {
    conn.sftp((err, s) => (err ? reject(err) : resolve(s)));
  });
  for (const rel of UPLOAD_PATHS) {
    const local = path.join(REPO, rel);
    if (!fs.existsSync(local)) throw new Error(`Missing ${rel}`);
    const remote = `${PROJECT}/${rel.replace(/\\/g, '/')}`;
    await mkdirp(sftp, path.posix.dirname(remote));
    console.log('Upload', rel);
    await uploadFile(sftp, local, remote);
  }
  const cmd = `
set -e
cd ${PROJECT}
pnpm --filter @watsapp/api build
pnpm --filter @watsapp/web build
pm2 restart api --update-env
pm2 restart web --update-env
pm2 save || true
sleep 6
curl -sS -o /dev/null -w 'api:%{http_code}\\n' http://127.0.0.1:4000/api/v1/health || true
curl -sS -o /dev/null -w 'web:%{http_code}\\n' https://www.chatloora.com/tiktok || true
echo TIKTOK_OAUTH_SESSION_FIX_OK
`;
  const { code, errOut } = await exec(conn, cmd, 1200000);
  conn.end();
  if (code !== 0) {
    console.error('Deploy failed', code);
    if (errOut) console.error(errOut.slice(-3000));
    process.exit(code || 1);
  }
  console.log('Deploy finished OK');
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
