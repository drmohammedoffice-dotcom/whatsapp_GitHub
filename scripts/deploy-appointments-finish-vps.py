#!/usr/bin/env python3
"""Finish appointments deploy: web fix + seed clinic + restart."""
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
    "apps/web/src/lib/billing.ts",
    "apps/web/src/components/billing/plan-upgrade-dialog.tsx",
    "apps/web/src/lib/i18n/en.ts",
    "apps/web/src/lib/i18n/ar.ts",
    "apps/web/src/lib/i18n/types.ts",
    "apps/web/src/app/appointments/page.tsx",
    "apps/web/src/app/appointments/settings/page.tsx",
    "apps/web/src/components/layout/nav-config.ts",
    "apps/web/src/lib/subscription-routes.ts",
    "apps/web/src/lib/plan-limits.ts",
]

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
      timezone: "Asia/Baghdad",
      defaultDurationMin: 30,
      instructions:
        "رحّب بالمريض، اسأله عن نوع الخدمة، اقترح أقرب المواعيد المتاحة، وأكد الحجز بعد موافقة المريض.",
    },
  });

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

  await prisma.aiSettings.updateMany({
    where: { teamId, platform: "WHATSAPP" },
    data: { enabled: true, autoReplyEnabled: true },
  });

  console.log(JSON.stringify({
    ok: true,
    profileId: profile.id,
    enabled: profile.enabled,
    staffId: staff.id,
    services: await prisma.appointmentServiceOffer.count({ where: { teamId } }),
  }));
  await prisma.$disconnect();
})().catch(async (e) => { console.error(e); process.exit(1); });
"""


def main() -> int:
    pairs = [(REPO_ROOT / p, p.replace("\\", "/")) for p in UPLOAD_PATHS]
    fd, tar_path = tempfile.mkstemp(suffix=".tar.gz")
    os.close(fd)
    with tarfile.open(tar_path, "w:gz") as tar:
        for local, arc in pairs:
            tar.add(local, arcname=arc)

    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(HOST, username=USER, password=PASSWORD, timeout=30)
    sftp = client.open_sftp()
    sftp.put(tar_path, f"{PROJECT_DIR}/deploy-appointments-finish.tar.gz")
    with sftp.file(f"{PROJECT_DIR}/apps/api/tmp-seed-appointments.js", "w") as f:
        f.write(SEED_JS)
    sftp.close()
    os.remove(tar_path)

    cmd = f"""
set -e
cd {PROJECT_DIR}
tar xzf deploy-appointments-finish.tar.gz
rm -f deploy-appointments-finish.tar.gz
pnpm --filter @watsapp/web build
pm2 restart api --update-env
pm2 restart web --update-env
sleep 5
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
r = subprocess.run(['node','tmp-seed-appointments.js'], cwd='/root/whatsapp_GitHub/apps/api', env=env, capture_output=True, text=True)
print(r.stdout)
print(r.stderr)
raise SystemExit(r.returncode)
PY
rm -f apps/api/tmp-seed-appointments.js
curl -s -o /dev/null -w "WEB_HTTP=%{{http_code}}\\n" https://almutamayiziq.com/appointments || true
pm2 status
echo DEPLOY_OK
"""
    print("Finishing deploy...")
    _, stdout, stderr = client.exec_command(cmd, timeout=900)
    out = stdout.read().decode("utf-8", errors="replace")
    err = stderr.read().decode("utf-8", errors="replace")
    code = stdout.channel.recv_exit_status()
    print(out.encode("ascii", errors="replace").decode("ascii"))
    if err.strip():
        print(err.encode("ascii", errors="replace").decode("ascii"), file=sys.stderr)
    client.close()
    return code


if __name__ == "__main__":
    raise SystemExit(main())
