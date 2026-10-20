const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

(async () => {
  const pixels = await p.tikTokIntegration.findMany({
    where: {
      OR: [
        { pixelCode: { contains: 'D9ALM' } },
        { pixelName: { contains: '33' } },
        { name: { contains: '33' } },
        { pixelCode: { contains: 'D9AL' } },
      ],
    },
    orderBy: { updatedAt: 'desc' },
    take: 30,
    select: {
      id: true,
      name: true,
      pixelName: true,
      pixelCode: true,
      pixelId: true,
      whatsappNumber: true,
      wizardCompleted: true,
      eventsApiConnected: true,
      eventsApiStatus: true,
      eventsApiStatusMessage: true,
      lastEventName: true,
      lastEventSentAt: true,
      lastApiError: true,
      teamId: true,
      userId: true,
      encryptedEventsApiAccessToken: true,
      createdAt: true,
      updatedAt: true,
      billingSuspended: true,
    },
  });

  const out = [];
  for (const i of pixels) {
    const hasToken = Boolean(i.encryptedEventsApiAccessToken);
    delete i.encryptedEventsApiAccessToken;
    const [clicks, contacts, failed, pending] = await Promise.all([
      p.tikTokIntegrationClick.count({ where: { integrationId: i.id } }),
      p.tikTokIntegrationConversion.count({
        where: { integrationId: i.id, eventName: 'Contact', contactSent: true },
      }),
      p.tikTokIntegrationConversion.count({
        where: { integrationId: i.id, tiktokStatus: 'failed' },
      }),
      p.tikTokIntegrationConversion.count({
        where: { integrationId: i.id, contactSent: false },
      }),
    ]);
    const recentConv = await p.tikTokIntegrationConversion.findMany({
      where: { integrationId: i.id },
      orderBy: { createdAt: 'desc' },
      take: 8,
      select: {
        id: true,
        eventName: true,
        contactSent: true,
        tiktokStatus: true,
        tiktokError: true,
        whatsappPhone: true,
        createdAt: true,
        sentAt: true,
        ttclid: true,
        retryCount: true,
      },
    });
    const recentClicks = await p.tikTokIntegrationClick.findMany({
      where: { integrationId: i.id },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true,
        ttclid: true,
        createdAt: true,
        optimizationEventSent: true,
      },
    });
    const channels = await p.channel.findMany({
      where: {
        teamId: i.teamId,
        provider: { in: ['WHATSAPP_BAILEYS', 'WHATSAPP_CLOUD'] },
      },
      select: {
        id: true,
        status: true,
        externalId: true,
        metadata: true,
        whatsAppSession: {
          select: { status: true, phoneNumber: true, jid: true, connectedAt: true },
        },
      },
    });
    out.push({
      ...i,
      hasToken,
      clicks,
      contacts,
      failed,
      pending,
      recentConv,
      recentClicks,
      channels: channels.map((c) => ({
        id: c.id,
        status: c.status,
        purpose: c.metadata && typeof c.metadata === 'object' ? c.metadata.purpose : null,
        phone: c.whatsAppSession?.phoneNumber || c.externalId,
        sessionStatus: c.whatsAppSession?.status,
        metaPhone: c.metadata && typeof c.metadata === 'object' ? c.metadata.phoneNumber : null,
      })),
    });
  }

  const recentSent = await p.tikTokIntegrationConversion.findMany({
    where: { eventName: 'Contact', contactSent: true },
    orderBy: { sentAt: 'desc' },
    take: 15,
    select: {
      integrationId: true,
      whatsappPhone: true,
      sentAt: true,
      tiktokStatus: true,
      ttclid: true,
    },
  });

  const recentFailed = await p.tikTokIntegrationConversion.findMany({
    where: {
      createdAt: { gte: new Date(Date.now() - 2 * 24 * 3600 * 1000) },
      OR: [{ tiktokStatus: 'failed' }, { contactSent: false }],
    },
    orderBy: { createdAt: 'desc' },
    take: 20,
    select: {
      integrationId: true,
      eventName: true,
      tiktokStatus: true,
      tiktokError: true,
      whatsappPhone: true,
      createdAt: true,
      contactSent: true,
      retryCount: true,
    },
  });

  // Phone mismatch cases: integrations whose whatsappNumber is not on any connected tracking channel
  console.log(JSON.stringify({ pixels: out, recentSent, recentFailed }, null, 2));
  await p.$disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
