const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const subs = await p.subscription.findMany({
    take: 15,
    include: { plan: true, team: { select: { id: true, name: true } } },
    orderBy: { updatedAt: 'desc' },
  });
  for (const s of subs) {
    const end = s.currentPeriodEnd ? new Date(s.currentPeriodEnd) : null;
    const days = end ? Math.ceil((end - Date.now()) / 86400000) : null;
    console.log(JSON.stringify({
      teamId: s.teamId,
      team: s.team?.name,
      status: s.status,
      end: s.currentPeriodEnd,
      daysLeft: days,
      plan: s.plan?.name,
    }));
  }
  const suspended = await p.tikTokIntegration.count({ where: { billingSuspended: true } });
  console.log('billingSuspended integrations:', suspended);
  await p.$disconnect();
})().catch(async (e) => {
  console.error(e);
  await p.$disconnect();
  process.exit(1);
});
