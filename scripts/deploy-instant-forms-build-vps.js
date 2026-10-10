#!/usr/bin/env node
/** Deploy Instant Forms — SQL migrate + generate + build + restart. */
const { Client } = require('ssh2');

const HOST = '161.97.140.171';
const USER = 'root';
const PASSWORD = process.env.VPS_PASSWORD || '';
const PROJECT = '/root/whatsapp_GitHub';

function exec(conn, command, timeoutMs = 900000) {
  return new Promise((resolve, reject) => {
    console.log('\n$ remote build script');
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

async function main() {
  const conn = new Client();
  await new Promise((resolve, reject) => {
    conn
      .on('ready', resolve)
      .on('error', reject)
      .connect({ host: HOST, username: USER, password: PASSWORD, readyTimeout: 60000 });
  });
  console.log(`Connected ${HOST}`);

  const cmd = `
set -e
cd ${PROJECT}

# Extract DATABASE_URL without sourcing broken .env lines
DATABASE_URL=$(grep -E '^DATABASE_URL=' .env | head -n1 | cut -d= -f2- | sed 's/^"//;s/"$//;s/^'\\''//;s/'\\''$//')
export DATABASE_URL
# psql does not accept Prisma's ?schema= query param
PSQL_URL=$(echo "$DATABASE_URL" | sed 's/?.*$//')
echo "DB host check: $(echo "$PSQL_URL" | sed 's/:[^:@]*@/:***@/')"

SQL_FILE="${PROJECT}/packages/database/prisma/migrations/20260720180000_instant_forms/migration.sql"
echo "Applying Instant Forms SQL..."
psql "$PSQL_URL" -v ON_ERROR_STOP=0 -f "$SQL_FILE" || true
psql "$PSQL_URL" -c "SELECT to_regclass('public.instant_forms') AS instant_forms, to_regclass('public.instant_form_orders') AS instant_form_orders;"

echo "Prisma generate..."
cd ${PROJECT}/packages/database
DATABASE_URL="$DATABASE_URL" pnpm exec prisma generate

cd ${PROJECT}
echo "Build API..."
pnpm --filter @watsapp/api build

echo "Build Web..."
pnpm --filter @watsapp/web build

pm2 restart api web --update-env
sleep 12
curl -sS -o /dev/null -w 'api:%{http_code}\\n' https://www.chatloora.com/api/v1/health || true
curl -sS -o /dev/null -w 'web:%{http_code}\\n' https://www.chatloora.com/ || true
curl -sS -o /dev/null -w 'forms:%{http_code}\\n' https://www.chatloora.com/tiktok/integration/forms || true
echo INSTANT_FORMS_BUILD_OK
`;

  const { code, errOut } = await exec(conn, cmd, 900000);
  conn.end();
  if (code !== 0) {
    console.error('Deploy failed with code', code);
    if (errOut) console.error(errOut.slice(-5000));
    process.exit(code || 1);
  }
  console.log('Deploy finished OK');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
