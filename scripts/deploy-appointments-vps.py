#!/usr/bin/env python3
"""Deploy AI Appointment System to production VPS + migrate + seed clinic profile."""
from __future__ import annotations

import os
import sys
import tarfile
import tempfile
from pathlib import Path

import paramiko

HOST = "161.97.140.171"
USER = "root"
PASSWORD = os.environ.get("VPS_PASSWORD", "")
PROJECT_DIR = "/root/whatsapp_GitHub"
REPO_ROOT = Path(__file__).resolve().parents[1]
TEAM_ID = "cmqwrykfu0009kbi7ccvvax53"

UPLOAD_PATHS = [
    # Database
    "packages/database/prisma/schema.prisma",
    "packages/database/prisma/migrations/20260717180000_ai_appointment_system/migration.sql",
    # Billing / queues / config
    "apps/api/src/billing/plan-limits.ts",
    "apps/api/src/billing/plan-entitlements.service.ts",
    "apps/api/src/config/env.ts",
    "apps/api/src/queues/queues.constants.ts",
    "apps/api/src/queues/queues.module.ts",
    "apps/api/src/app.module.ts",
    # Appointments module
    "apps/api/src/appointments/appointment-slots.util.ts",
    "apps/api/src/appointments/appointment-slots.util.spec.ts",
    "apps/api/src/appointments/appointment-profile.service.ts",
    "apps/api/src/appointments/appointment-reminder.service.ts",
    "apps/api/src/appointments/appointment-reminder.processor.ts",
    "apps/api/src/appointments/appointments.service.ts",
    "apps/api/src/appointments/appointments.controller.ts",
    "apps/api/src/appointments/appointments.module.ts",
    "apps/api/src/appointments/google-calendar.controller.ts",
    "apps/api/src/appointments/dto/appointment.dto.ts",
    # Google Calendar integration
    "apps/api/src/integrations/google-calendar/google-calendar-api.client.ts",
    "apps/api/src/integrations/google-calendar/google-calendar-token.service.ts",
    "apps/api/src/integrations/google-calendar/google-calendar-oauth.service.ts",
    "apps/api/src/integrations/google-calendar/calendar.service.ts",
    # AI wiring
    "apps/api/src/ai/ai.module.ts",
    "apps/api/src/ai/ai-orchestrator.service.ts",
    # Web
    "apps/web/src/app/appointments/page.tsx",
    "apps/web/src/app/appointments/settings/page.tsx",
    "apps/web/src/components/layout/nav-config.ts",
    "apps/web/src/lib/subscription-routes.ts",
    "apps/web/src/lib/plan-limits.ts",
    "apps/web/src/lib/i18n/types.ts",
    "apps/web/src/lib/i18n/en.ts",
    "apps/web/src/lib/i18n/ar.ts",
    ".env.example",
]


def collect_files() -> list[tuple[Path, str]]:
    pairs: list[tuple[Path, str]] = []
    for rel in UPLOAD_PATHS:
        src = REPO_ROOT / rel
        if not src.exists():
            raise FileNotFoundError(f"Missing deploy path: {src}")
        pairs.append((src, rel.replace("\\", "/")))
    return pairs


def make_tarball(pairs: list[tuple[Path, str]]) -> str:
    fd, tar_path = tempfile.mkstemp(suffix=".tar.gz")
    os.close(fd)
    with tarfile.open(tar_path, "w:gz") as tar:
        for local, arc in pairs:
            tar.add(local, arcname=arc)
    return tar_path


def run_remote(client: paramiko.SSHClient, command: str, timeout: int = 1200) -> int:
    print(f"\n$ {command[:220]}...")
    _, stdout, stderr = client.exec_command(command, timeout=timeout)
    out = stdout.read().decode("utf-8", errors="replace")
    err = stderr.read().decode("utf-8", errors="replace")
    code = stdout.channel.recv_exit_status()
    if out.strip():
        print(out.encode("ascii", errors="replace").decode("ascii").rstrip())
    if err.strip():
        print(err.encode("ascii", errors="replace").decode("ascii").rstrip(), file=sys.stderr)
    return code


SEED_JS = r"""
const { PrismaClient } = require("@watsapp/database");
const prisma = new PrismaClient();
(async () => {
  const teamId = process.env.SEED_TEAM_ID;
  const profile = await prisma.appointmentBusinessProfile.upsert({
    where: { teamId },
    update: {
      enabled: true,
      vertical: "CLINIC",
      orgName: "عيادة تجريبية ChatLoora",
      description: "عيادة تجريبية لاختبار نظام المواعيد الذكي",
      phone: "9647700000000",
      timezone: "Asia/Baghdad",
      defaultDurationMin: 30,
      bufferMin: 0,
      bookingWindowDays: 14,
      instructions:
        "رحّب بالمريض، اسأله عن نوع الخدمة، اقترح أقرب المواعيد المتاحة، وأكد الحجز بعد موافقة المريض.",
      aiCanReply: true,
      aiCanCreate: true,
      aiCanUpdate: true,
      aiCanCancel: true,
      aiCanReadCalendar: true,
      aiCanSendReminders: true,
      businessHours: {
        timezone: "Asia/Baghdad",
        schedule: [
          { day: 0, open: "09:00", close: "17:00" },
          { day: 1, open: "09:00", close: "17:00" },
          { day: 2, open: "09:00", close: "17:00" },
          { day: 3, open: "09:00", close: "17:00" },
          { day: 4, open: "09:00", close: "17:00" },
          { day: 5, open: "09:00", close: "14:00" },
        ],
      },
      faqJson: [
        { q: "ما أوقات العمل؟", a: "من الأحد إلى الخميس 9 صباحاً – 5 مساءً، والجمعة حتى 2 ظهراً." },
        { q: "كم مدة الكشف؟", a: "عادة 30 دقيقة." },
      ],
    },
    create: {
      teamId,
      enabled: true,
      vertical: "CLINIC",
      orgName: "عيادة تجريبية ChatLoora",
      description: "عيادة تجريبية لاختبار نظام المواعيد الذكي",
      phone: "9647700000000",
      timezone: "Asia/Baghdad",
      defaultDurationMin: 30,
      instructions:
        "رحّب بالمريض، اسأله عن نوع الخدمة، اقترح أقرب المواعيد المتاحة، وأكد الحجز بعد موافقة المريض.",
      businessHours: {
        timezone: "Asia/Baghdad",
        schedule: [
          { day: 0, open: "09:00", close: "17:00" },
          { day: 1, open: "09:00", close: "17:00" },
          { day: 2, open: "09:00", close: "17:00" },
          { day: 3, open: "09:00", close: "17:00" },
          { day: 4, open: "09:00", close: "17:00" },
          { day: 5, open: "09:00", close: "14:00" },
        ],
      },
    },
  });

  const staffCount = await prisma.appointmentStaff.count({ where: { teamId } });
  let staff = await prisma.appointmentStaff.findFirst({ where: { teamId, isActive: true } });
  if (!staff) {
    staff = await prisma.appointmentStaff.create({
      data: {
        teamId,
        profileId: profile.id,
        name: "د. أحمد العيادة",
        title: "طبيب عام",
        specialty: "طب عام",
        isActive: true,
        sortOrder: 0,
      },
    });
  }

  const serviceCount = await prisma.appointmentServiceOffer.count({ where: { teamId } });
  if (serviceCount === 0) {
    await prisma.appointmentServiceOffer.createMany({
      data: [
        {
          teamId,
          profileId: profile.id,
          staffId: staff.id,
          name: "كشف عام",
          description: "استشارة طبية عامة",
          durationMin: 30,
          priceCents: 2500000,
          currency: "IQD",
          isActive: true,
          sortOrder: 0,
        },
        {
          teamId,
          profileId: profile.id,
          staffId: staff.id,
          name: "متابعة",
          description: "زيارة متابعة",
          durationMin: 20,
          priceCents: 1500000,
          currency: "IQD",
          isActive: true,
          sortOrder: 1,
        },
      ],
    });
  }

  // Ensure WhatsApp AI auto-reply stays on for the test clinic
  await prisma.aiSettings.updateMany({
    where: { teamId, platform: "WHATSAPP" },
    data: { enabled: true, autoReplyEnabled: true },
  });

  console.log(
    JSON.stringify({
      ok: true,
      profileId: profile.id,
      enabled: profile.enabled,
      staffId: staff.id,
      staffCount,
      serviceCount: await prisma.appointmentServiceOffer.count({ where: { teamId } }),
    }),
  );
  await prisma.$disconnect();
})().catch(async (e) => {
  console.error(e);
  process.exit(1);
});
"""


def main() -> int:
    pairs = collect_files()
    tar_path = make_tarball(pairs)
    print(f"Deploying {len(pairs)} files...")

    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(HOST, username=USER, password=PASSWORD, timeout=30)

    sftp = client.open_sftp()
    remote_tar = f"{PROJECT_DIR}/deploy-appointments.tar.gz"
    sftp.put(tar_path, remote_tar)
    with sftp.file(f"{PROJECT_DIR}/apps/api/tmp-seed-appointments.js", "w") as f:
        f.write(SEED_JS)
    sftp.close()
    os.remove(tar_path)

    # Ensure Google env placeholders exist (user fills secrets later)
    code = run_remote(
        client,
        f"""
set -e
cd {PROJECT_DIR}
python3 - <<'PY'
from pathlib import Path
env = Path('.env')
text = env.read_text(encoding='utf-8', errors='replace')
lines = text.splitlines()
keys = {{
  'GOOGLE_CLIENT_ID': '',
  'GOOGLE_CLIENT_SECRET': '',
  'GOOGLE_REDIRECT_URI': 'https://almutamayiziq.com/api/v1/integrations/google-calendar/callback',
}}
existing = set()
for line in lines:
    if '=' in line and not line.strip().startswith('#'):
        existing.add(line.split('=', 1)[0].strip())
changed = False
for k, v in keys.items():
    if k not in existing:
        lines.append(f'{{k}}={{v}}')
        changed = True
        print(f'ADDED {{k}}')
    else:
        print(f'HAS {{k}}')
if changed:
    env.write_text('\\n'.join(lines) + '\\n', encoding='utf-8')
    print('ENV_UPDATED')
else:
    print('ENV_OK')
PY

tar xzf deploy-appointments.tar.gz
rm -f deploy-appointments.tar.gz

echo ====MIGRATE====
pnpm --filter @watsapp/database prisma:generate
pnpm --filter @watsapp/database exec prisma migrate deploy

echo ====BUILD====
pnpm --filter @watsapp/api build
pnpm --filter @watsapp/web build

echo ====RESTART====
pm2 restart api --update-env
pm2 restart web --update-env
sleep 5

echo ====SEED====
python3 - <<'PY'
import os, subprocess
env = dict(os.environ)
for line in open('/root/whatsapp_GitHub/.env', encoding='utf-8', errors='replace'):
    line=line.strip()
    if not line or line.startswith('#') or '=' not in line: continue
    k,v=line.split('=',1)
    if k in ('DATABASE_URL','REDIS_URL'):
        env[k]=v.strip().strip('"').strip("'")
env['SEED_TEAM_ID'] = '{TEAM_ID}'
r = subprocess.run(
    ['node', 'tmp-seed-appointments.js'],
    cwd='/root/whatsapp_GitHub/apps/api',
    env=env,
    capture_output=True,
    text=True,
)
print(r.stdout)
print(r.stderr)
print('SEED_EXIT', r.returncode)
raise SystemExit(r.returncode)
PY

rm -f apps/api/tmp-seed-appointments.js
pm2 logs api --lines 12 --nostream
echo DEPLOY_OK
""",
        timeout=1200,
    )
    client.close()
    return code


if __name__ == "__main__":
    raise SystemExit(main())
