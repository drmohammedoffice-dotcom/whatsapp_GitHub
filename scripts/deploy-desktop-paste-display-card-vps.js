#!/usr/bin/env node
/**
 * Deploy: Electron paste/nav fixes (via rebuilt Setup.exe) + display-card upload hardening.
 */
const fs = require('fs');
const path = require('path');
const { Client } = require('ssh2');

const HOST = '161.97.140.171';
const USER = 'root';
const PASSWORD = process.env.VPS_PASSWORD || '';
const PROJECT = '/root/whatsapp_GitHub';
const REPO = path.resolve(__dirname, '..');

const API_WEB_PATHS = [
  'apps/api/src/integrations/tiktok-login-kit/tiktok-ads.service.ts',
  'apps/api/src/integrations/tiktok-login-kit/tiktok-ad-publish.service.ts',
  'apps/api/src/integrations/tiktok-login-kit/tiktok-business-public.controller.ts',
  'apps/web/src/lib/tiktok-business.ts',
];

const DESKTOP_OPTIONAL = [
  'apps/web/public/downloads/ChatLoora-Setup.exe',
  'apps/web/public/downloads/README.txt',
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
  if (!PASSWORD) throw new Error('Set VPS_PASSWORD env var');

  const upload = [...API_WEB_PATHS];
  for (const rel of DESKTOP_OPTIONAL) {
    if (fs.existsSync(path.join(REPO, rel))) upload.push(rel);
    else console.warn('Skip missing (pack desktop first):', rel);
  }

  let conn;
  for (let attempt = 1; attempt <= 6; attempt++) {
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
      if (attempt === 6) throw error;
      await new Promise((r) => setTimeout(r, 5000 * attempt));
    }
  }

  const sftp = await new Promise((resolve, reject) => {
    conn.sftp((err, s) => (err ? reject(err) : resolve(s)));
  });

  for (const rel of upload) {
    const local = path.join(REPO, rel);
    if (!fs.existsSync(local)) throw new Error(`Missing: ${local}`);
    const remote = `${PROJECT}/${rel.replace(/\\/g, '/')}`;
    await mkdirp(sftp, path.posix.dirname(remote));
    console.log('Upload', rel);
    await new Promise((resolve, reject) => {
      sftp.fastPut(local, remote, (err) => (err ? reject(err) : resolve()));
    });
  }

  const hasExe = upload.includes('apps/web/public/downloads/ChatLoora-Setup.exe');
  const cmd = `
set -e
cd ${PROJECT}
grep -q "attachClipboardShortcuts\\|before-input-event" apps/desktop/electron/main.js 2>/dev/null || true
grep -q "تعذر إنشاء بطاقة العرض" apps/api/src/integrations/tiktok-login-kit/tiktok-ad-publish.service.ts
grep -q "جلسة غير مكتملة" apps/api/src/integrations/tiktok-login-kit/tiktok-business-public.controller.ts
pnpm --filter @watsapp/api build
pnpm --filter @watsapp/web build
pm2 restart api web --update-env
sleep 10
curl -sS -o /dev/null -w 'api:%{http_code}\\n' https://www.chatloora.com/api/v1/health || true
curl -sS -o /dev/null -w 'web:%{http_code}\\n' https://www.chatloora.com/ || true
${hasExe ? "curl -sS -o /dev/null -w 'exe:%{http_code}\\n' https://www.chatloora.com/downloads/ChatLoora-Setup.exe || true" : 'echo no_exe_upload'}
echo DESKTOP_PASTE_DISPLAY_CARD_OK
`;
  const result = await exec(conn, cmd);
  conn.end();
  if (result.code !== 0) throw new Error(`Remote deploy failed with code ${result.code}`);
  console.log('Deploy finished');
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
