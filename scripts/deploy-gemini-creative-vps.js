#!/usr/bin/env node
/** Deploy Gemini Creative Studio media provider (images + video) to VPS. */
const fs = require('fs');
const path = require('path');
const { Client } = require('ssh2');

const HOST = '161.97.140.171';
const USER = 'root';
const PASSWORD = process.env.VPS_PASSWORD || '';
const PROJECT = '/root/whatsapp_GitHub';
const REPO = path.resolve(__dirname, '..');

const UPLOAD_PATHS = [
  'apps/api/src/config/env.ts',
  'apps/api/src/creative-studio/providers/gemini.provider.ts',
  'apps/api/src/creative-studio/providers/provider-registry.ts',
  'apps/api/src/creative-studio/providers/openai.provider.ts',
  'apps/api/src/creative-studio/generation.service.ts',
  'apps/api/src/creative-studio/creative-studio.service.ts',
  'apps/api/src/creative-studio/creative-studio.controller.ts',
  'apps/api/src/creative-studio/creative-studio.core.module.ts',
  'apps/api/src/creative-studio/dto/creative.dto.ts',
  'apps/api/src/ai/ai-provider-config.service.ts',
  'apps/api/src/creative-studio/providers/provider-registry.spec.ts',
  'apps/api/src/creative-studio/generation.service.spec.ts',
  'apps/api/src/creative-studio/creative-studio.service.spec.ts',
  'apps/api/src/creative-studio/creative-phase4.spec.ts',
];

const ENV_UPDATES = {
  CREATIVE_GEMINI_IMAGE_MODEL: 'gemini-3.1-flash-image',
  CREATIVE_GEMINI_VIDEO_MODEL: 'veo-3.1-generate-preview',
  CREATIVE_OPENAI_IMAGE_MODEL: 'gemini-3.1-flash-image',
  CREATIVE_OPENAI_TEXT_MODEL: 'gemini-3.6-flash',
};

function upsertEnv(content, updates) {
  const lines = content.split(/\r?\n/);
  const seen = new Set();
  const out = [];
  for (const line of lines) {
    if (line.includes('=') && !line.trim().startsWith('#')) {
      const key = line.split('=', 1)[0].trim();
      if (Object.prototype.hasOwnProperty.call(updates, key)) {
        out.push(`${key}=${updates[key]}`);
        seen.add(key);
        continue;
      }
    }
    out.push(line);
  }
  for (const [key, value] of Object.entries(updates)) {
    if (!seen.has(key)) out.push(`${key}=${value}`);
  }
  return out.join('\n').replace(/\n*$/, '\n');
}

function exec(conn, command, timeoutMs = 700000) {
  return new Promise((resolve, reject) => {
    conn.exec(command, (err, stream) => {
      if (err) return reject(err);
      let out = '';
      let errOut = '';
      const timer = setTimeout(() => {
        stream.close();
        reject(new Error(`timeout ${timeoutMs}`));
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
  for (const rel of UPLOAD_PATHS) {
    const local = path.join(REPO, rel);
    if (!fs.existsSync(local)) throw new Error(`Missing: ${local}`);
  }

  const conn = new Client();
  await new Promise((resolve, reject) => {
    conn
      .on('ready', resolve)
      .on('error', reject)
      .connect({ host: HOST, username: USER, password: PASSWORD, readyTimeout: 120000 });
  });
  console.log('SSH connected');

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

  for (const envPath of [`${PROJECT}/.env`, `${PROJECT}/apps/api/.env`]) {
    try {
      const buf = await new Promise((resolve, reject) => {
        sftp.readFile(envPath, (err, data) => (err ? reject(err) : resolve(data)));
      });
      const next = upsertEnv(buf.toString('utf8'), ENV_UPDATES);
      await new Promise((resolve, reject) => {
        sftp.writeFile(envPath, next, (err) => (err ? reject(err) : resolve()));
      });
      console.log('Updated', envPath);
    } catch {
      console.log('Skip missing', envPath);
    }
  }

  const { code, errOut } = await exec(
    conn,
    `
set -e
cd ${PROJECT}
pnpm --filter @watsapp/api typecheck
pnpm --filter @watsapp/api build
# worker imports creative-studio from api dist / shared path — rebuild worker if present
pnpm --filter @watsapp/worker build || true
pm2 restart api worker --update-env
sleep 12
curl -sS -o /dev/null -w 'health:%{http_code}\\n' https://www.chatloora.com/api/v1/health || true
echo GEMINI_CREATIVE_DEPLOY_OK
`,
  );
  conn.end();
  if (code !== 0) {
    console.error('Deploy failed', code);
    if (errOut) console.error(errOut.slice(-4000));
    process.exit(code || 1);
  }
  console.log('Deploy finished OK');
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
