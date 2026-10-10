#!/usr/bin/env node
/** Deploy Instant Lead Form Builder to VPS. */
const fs = require('fs');
const path = require('path');
const { Client } = require('ssh2');

const HOST = '161.97.140.171';
const USER = 'root';
const PASSWORD = process.env.VPS_PASSWORD || '';
const PROJECT = '/root/whatsapp_GitHub';
const REPO = path.resolve(__dirname, '..');

const UPLOAD_PATHS = [
  // Schema + migration
  'packages/database/prisma/schema.prisma',
  'packages/database/prisma/migrations/20260720180000_instant_forms/migration.sql',
  // API
  'apps/api/src/app.module.ts',
  'apps/api/src/instant-forms/instant-form.document.ts',
  'apps/api/src/instant-forms/instant-form.templates.ts',
  'apps/api/src/instant-forms/instant-forms.module.ts',
  'apps/api/src/instant-forms/instant-forms.service.ts',
  'apps/api/src/instant-forms/instant-forms.controller.ts',
  'apps/api/src/instant-forms/instant-forms-public.controller.ts',
  'apps/api/src/instant-forms/dto/instant-form.dto.ts',
  // Web lib + components
  'apps/web/src/lib/instant-forms/api.ts',
  'apps/web/src/lib/instant-forms/document.ts',
  'apps/web/src/components/instant-forms/form-builder.tsx',
  'apps/web/src/components/instant-forms/form-renderer.tsx',
  'apps/web/src/components/instant-forms/public-form-client.tsx',
  // Web pages
  'apps/web/src/app/tiktok/integration/forms/page.tsx',
  'apps/web/src/app/tiktok/integration/forms/new/page.tsx',
  'apps/web/src/app/tiktok/integration/forms/orders/page.tsx',
  'apps/web/src/app/tiktok/integration/forms/[id]/builder/page.tsx',
  'apps/web/src/app/f/[slug]/page.tsx',
  'apps/web/src/app/f/[slug]/thanks/page.tsx',
  'apps/web/src/app/f/s/[code]/page.tsx',
  // Integration UI + i18n
  'apps/web/src/app/tiktok/integration/page.tsx',
  'apps/web/src/components/tiktok/tiktok-integration-shell.tsx',
  'apps/web/src/lib/tiktok-integration.ts',
  'apps/web/src/lib/i18n/types.ts',
  'apps/web/src/lib/i18n/ar.ts',
  'apps/web/src/lib/i18n/en.ts',
];

function exec(conn, command, timeoutMs = 900000) {
  return new Promise((resolve, reject) => {
    console.log(`\n$ ${command.split('\n').map((l) => l.trim()).filter(Boolean).join(' && ')}`);
    conn.exec(command, { timeout: timeoutMs }, (err, stream) => {
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
  const conn = new Client();
  await new Promise((resolve, reject) => {
    conn
      .on('ready', resolve)
      .on('error', reject)
      .connect({ host: HOST, username: USER, password: PASSWORD, readyTimeout: 60000 });
  });
  console.log(`Connected ${HOST}`);

  const sftp = await new Promise((resolve, reject) => {
    conn.sftp((err, s) => (err ? reject(err) : resolve(s)));
  });

  for (const rel of UPLOAD_PATHS) {
    const local = path.join(REPO, rel);
    if (!fs.existsSync(local)) throw new Error(`Missing: ${local}`);
    const remote = `${PROJECT}/${rel.replace(/\\/g, '/')}`;
    await mkdirp(sftp, path.posix.dirname(remote));
    console.log('Upload', rel);
    await uploadFile(sftp, local, remote);
  }

  const cmd = `
set -e
cd ${PROJECT}
pnpm --filter @watsapp/database exec prisma db push --accept-data-loss
pnpm --filter @watsapp/database exec prisma generate
pnpm --filter @watsapp/api build
pnpm --filter @watsapp/web build
pm2 restart api web --update-env
sleep 10
curl -sS -o /dev/null -w 'api:%{http_code}\\n' https://www.chatloora.com/api/v1/health || true
curl -sS -o /dev/null -w 'web:%{http_code}\\n' https://www.chatloora.com/ || true
curl -sS -o /dev/null -w 'forms:%{http_code}\\n' https://www.chatloora.com/tiktok/integration/forms || true
echo INSTANT_FORMS_DEPLOY_OK
`;
  const { code, errOut } = await exec(conn, cmd, 900000);
  conn.end();
  if (code !== 0) {
    console.error('Deploy failed with code', code);
    if (errOut) console.error(errOut.slice(-4000));
    process.exit(code || 1);
  }
  console.log('Deploy finished OK');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
