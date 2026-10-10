#!/usr/bin/env node
/** Deploy customer dashboard IA, plans, and UI updates. */
const fs = require('fs');
const path = require('path');
const { Client } = require('ssh2');

const HOST = '161.97.140.171';
const USER = 'root';
const PASSWORD = process.env.VPS_PASSWORD || '';
const PROJECT = '/root/whatsapp_GitHub';
const REPO = path.resolve(__dirname, '..');

const UPLOAD_PATHS = [
  'apps/web/src/components/layout/nav-config.ts',
  'apps/web/src/components/layout/sidebar.tsx',
  'apps/web/src/components/layout/app-shell.tsx',
  'apps/web/src/components/layout/topbar.tsx',
  'apps/web/src/app/connect/page.tsx',
  'apps/web/src/app/plans/page.tsx',
  'apps/web/src/app/tiktok/page.tsx',
  'apps/web/src/app/settings/page.tsx',
  'apps/web/src/app/settings/integrations/page.tsx',
  'apps/web/src/app/globals.css',
  'apps/web/src/middleware.ts',
  'apps/web/src/lib/subscription-routes.ts',
  'apps/web/src/lib/i18n/ar.ts',
  'apps/web/src/lib/i18n/en.ts',
  'apps/web/src/lib/i18n/types.ts',
  'apps/web/src/components/tiktok/pixel-edit-dialog.tsx',
  'apps/web/src/components/ui/dialog.tsx',
  'apps/web/src/components/ui/scroll-area.tsx',
  'apps/web/src/components/billing/plan-upgrade-dialog.tsx',
  'apps/web/src/components/billing/subscription-expired-block.tsx',
  'apps/web/src/components/billing/subscription-required.tsx',
  'apps/web/src/components/channels/channel-brand-icon.tsx',
  'apps/api/src/assistant/assistant-nav.ts',
  'apps/api/src/assistant/assistant-realtime.util.spec.ts',
  'apps/api/src/billing/billing.service.ts',
  'apps/api/src/billing/billing-carryover.ts',
  'apps/api/src/billing/billing-carryover.spec.ts',
  'apps/api/src/billing/plan-entitlements.service.ts',
];

function exec(conn, command, timeoutMs = 600000) {
  return new Promise((resolve, reject) => {
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
pnpm --filter @watsapp/api test -- billing-carryover.spec.ts assistant-realtime.util.spec.ts
pnpm --filter @watsapp/api build
pnpm --filter @watsapp/web build
pm2 restart api --update-env
pm2 restart web --update-env
sleep 10
curl -sS -o /dev/null -w 'web:%{http_code}\\n' https://www.chatloora.com/ || true
echo DASHBOARD_IA_OK
`;
  const { code, errOut } = await exec(conn, cmd, 600000);
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
