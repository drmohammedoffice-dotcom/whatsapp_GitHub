#!/usr/bin/env node
const { PrismaClient } = require('@prisma/client');

async function main() {
  const p = new PrismaClient();
  const user = await p.user.findFirst({
    where: { email: { equals: 'drmohammedoffice@gmail.com', mode: 'insensitive' } },
    select: { id: true, email: true },
  });
  if (!user) {
    console.log(JSON.stringify({ ok: false, reason: 'user_not_found' }));
    await p.$disconnect();
    return;
  }
  const members = await p.teamMember.findMany({ where: { userId: user.id }, select: { teamId: true } });
  const teamIds = members.map((m) => m.teamId);
  const pixels = await p.tikTokIntegration.findMany({
    where: {
      teamId: { in: teamIds },
      OR: [{ redirectDestinationType: 'INSTANT_FORM' }, { externalRedirectUrl: { contains: '/f/' } }],
    },
    orderBy: { updatedAt: 'desc' },
    take: 8,
    select: {
      id: true,
      name: true,
      pixelCode: true,
      pixelStatus: true,
      eventsApiConnected: true,
      eventsApiStatus: true,
      defaultOptimizationEvent: true,
      customEventName: true,
      redirectDestinationType: true,
      externalRedirectUrl: true,
      wizardCompleted: true,
      lastEventSentAt: true,
      lastEventName: true,
      lastApiError: true,
      advertiserId: true,
      pixelId: true,
    },
  });
  const forms = await p.instantForm.findMany({
    where: { teamId: { in: teamIds } },
    orderBy: { updatedAt: 'desc' },
    take: 8,
    select: { id: true, name: true, slug: true, status: true, pixelIntegrationId: true, updatedAt: true },
  });
  const orders = await p.instantFormOrder.findMany({
    where: { form: { teamId: { in: teamIds } } },
    orderBy: { createdAt: 'desc' },
    take: 10,
    select: {
      id: true,
      formId: true,
      orderNumber: true,
      status: true,
      createdAt: true,
      totalAmount: true,
      phone: true,
      ttclid: true,
      utmSource: true,
    },
  });
  const conversions = await p.tikTokIntegrationConversion.findMany({
    where: { integrationId: { in: pixels.map((x) => x.id) } },
    orderBy: { createdAt: 'desc' },
    take: 20,
    select: {
      id: true,
      integrationId: true,
      eventName: true,
      orderId: true,
      contactSent: true,
      tiktokStatus: true,
      tiktokError: true,
      valueAmount: true,
      currency: true,
      createdAt: true,
      ttclid: true,
    },
  });
  console.log(JSON.stringify({ email: user.email, pixels, forms, orders, conversions }, null, 2));
  await p.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
