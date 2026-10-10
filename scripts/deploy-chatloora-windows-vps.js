#!/usr/bin/env node
/** Deploy ChatLoora Windows Setup.exe + landing download links to VPS. */
const fs = require('fs');
const path = require('path');
const { Client } = require('ssh2');

const HOST = '161.97.140.171';
const USER = 'root';
const PASSWORD = process.env.VPS_PASSWORD || '';
const PROJECT = '/root/whatsapp_GitHub';
const REPO = path.resolve(__dirname, '..');

const UPLOAD_PATHS = [
  'apps/web/next.config.ts',
  'apps/web/src/lib/chatloora-downloads.ts',
  'apps/web/src/lib/i18n/landing-copy.ts',
  'apps/web/src/components/landing/landing-hero.tsx',
  'apps/web/src/components/landing/landing-sections.tsx',
  'apps/web/public/downloads/ChatLoora-Setup.exe',
  'apps/web/public/downloads/README.txt',
];

function exec(conn, command, timeoutMs = 700000) {
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
    await new Promise((resolve) => {
      sftp.mkdir(cur, () => resolve());
    });
  }
}

async function main() {
  for (const rel of UPLOAD_PATHS) {
    const local = path.join(REPO, rel);
    if (!fs.existsSync(local)) throw new Error(`Missing: ${local}`);
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

  for (const rel of UPLOAD_PATHS) {
    const local = path.join(REPO, rel);
    const remote = `${PROJECT}/${rel.replace(/\\/g, '/')}`;
    await mkdirp(sftp, path.posix.dirname(remote));
    console.log('Upload', rel);
    await uploadFile(sftp, local, remote);
  }

  // Remove legacy zip from public downloads on VPS
  await exec(
    conn,
    `rm -f ${PROJECT}/apps/web/public/downloads/ChatLoora-Windows.zip || true`,
    60000,
  );

  const cmd = `
set -e
cd ${PROJECT}
pnpm --filter @watsapp/web typecheck
pnpm --filter @watsapp/web build
pm2 restart web --update-env
sleep 8
curl -sS -o /dev/null -w 'exe:%{http_code}\\n' https://www.chatloora.com/downloads/ChatLoora-Setup.exe || true
curl -sS -o /dev/null -w 'home:%{http_code}\\n' https://www.chatloora.com/ || true
echo CHATLOORA_WINDOWS_EXE_DEPLOY_OK
`;
  const { code, errOut } = await exec(conn, cmd);
  conn.end();
  if (code !== 0) {
    console.error('Deploy failed with code', code);
    if (errOut) console.error(errOut.slice(-4000));
    process.exit(code || 1);
  }
  console.log('Deploy finished OK');
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
