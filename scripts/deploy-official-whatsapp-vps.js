#!/usr/bin/env node
/**
 * Deploy Customer WhatsApp Cloud hardening + Chatloora Official WhatsApp System
 * (Admin OTP / subscription notifications) to the production VPS.
 *
 * Does NOT print secrets. Uses VPS_PASSWORD env when set.
 */
const fs = require('fs');
const path = require('path');
const { Client } = require('ssh2');

const HOST = '161.97.140.171';
const USER = 'root';
const PASSWORD = process.env.VPS_PASSWORD || '';
const PROJECT = '/root/whatsapp_GitHub';
const REPO = path.resolve(__dirname, '..');

function walk(relDir) {
  const abs = path.join(REPO, relDir);
  if (!fs.existsSync(abs)) return [];
  const out = [];
  const stack = [abs];
  while (stack.length) {
    const dir = stack.pop();
    for (const name of fs.readdirSync(dir)) {
      const full = path.join(dir, name);
      const st = fs.statSync(full);
      if (st.isDirectory()) stack.push(full);
      else out.push(path.relative(REPO, full).replace(/\\/g, '/'));
    }
  }
  return out;
}

const UPLOAD_PATHS = [
  ...walk('apps/api/src/official-whatsapp'),
  ...walk('apps/api/src/platform/whatsapp-cloud'),
  'apps/api/src/admin/admin.module.ts',
  'apps/api/src/app.module.ts',
  'apps/api/src/auth/auth.service.ts',
  'apps/api/src/auth/auth.controller.ts',
  'apps/api/src/auth/auth.module.ts',
  'apps/api/src/auth/dto/register.dto.ts',
  'apps/api/src/billing/billing.service.ts',
  'apps/api/src/billing/billing.module.ts',
  'apps/api/src/billing/plan-entitlements.service.ts',
  'apps/api/src/config/env.ts',
  'apps/api/src/integrations/meta/meta.service.ts',
  'packages/database/prisma/schema.prisma',
  'packages/database/prisma/migrations/20260914120000_official_whatsapp_system/migration.sql',
  'packages/database/package.json',
  '.env.example',
  'apps/web/src/app/admin/whatsapp-system/page.tsx',
  'apps/web/src/lib/admin-api.ts',
  'apps/web/src/app/whatsapp/page.tsx',
  'apps/web/src/app/register/page.tsx',
  'apps/web/src/app/login/page.tsx',
  'apps/web/src/app/reset-password/page.tsx',
  'apps/web/src/components/auth/otp-verification-modal.tsx',
  'apps/web/src/lib/auth.ts',
  'apps/web/src/lib/i18n/ar.ts',
  'apps/web/src/lib/i18n/en.ts',
  'apps/web/src/lib/i18n/types.ts',
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
    await new Promise((resolve) => {
      sftp.mkdir(cur, () => resolve());
    });
  }
}

async function main() {
  const files = [...new Set(UPLOAD_PATHS)];
  const missing = files.filter((rel) => !fs.existsSync(path.join(REPO, rel)));
  if (missing.length) {
    console.error('Missing local files:', missing.join('\n'));
    process.exit(1);
  }

  console.log(`Uploading ${files.length} files to ${HOST}:${PROJECT}`);
  const conn = new Client();
  await new Promise((resolve, reject) => {
    conn
      .on('ready', resolve)
      .on('error', reject)
      .connect({ host: HOST, username: USER, password: PASSWORD, readyTimeout: 60000 });
  });

  const sftp = await new Promise((resolve, reject) => {
    conn.sftp((err, s) => (err ? reject(err) : resolve(s)));
  });

  for (const rel of files) {
    const local = path.join(REPO, rel);
    const remote = `${PROJECT}/${rel.replace(/\\/g, '/')}`;
    await mkdirp(sftp, path.posix.dirname(remote));
    console.log('Upload', rel);
    await uploadFile(sftp, local, remote);
  }

  const cmd = `
set -e
cd ${PROJECT}
echo '--- migrate status ---'
pnpm --filter @watsapp/database exec prisma migrate status || true
echo '--- prisma generate ---'
pnpm --filter @watsapp/database prisma:generate
echo '--- build api ---'
pnpm --filter @watsapp/api build
echo '--- build web ---'
pnpm --filter @watsapp/web build
echo '--- restart pm2 ---'
pm2 restart api --update-env || pm2 restart api
pm2 restart worker --update-env || pm2 restart worker
pm2 restart web --update-env || pm2 restart web
pm2 save || true
sleep 8
echo '--- health ---'
curl -sS -o /dev/null -w 'api_health:%{http_code}\\n' http://127.0.0.1:4000/api/v1/health || true
curl -sS -o /dev/null -w 'web:%{http_code}\\n' https://www.chatloora.com/ || true
curl -sS -o /dev/null -w 'admin_wa_system:%{http_code}\\n' https://www.chatloora.com/admin/whatsapp-system || true
echo OFFICIAL_WHATSAPP_DEPLOY_OK
`;

  const { code, errOut } = await exec(conn, cmd, 1200000);
  conn.end();
  if (code !== 0) {
    console.error('Deploy failed with code', code);
    if (errOut) console.error(errOut.slice(-4000));
    process.exit(code || 1);
  }
  console.log('Deploy finished OK');
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
