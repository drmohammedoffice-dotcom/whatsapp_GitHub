const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

(async () => {
  const pixel = await p.tikTokIntegration.findFirst({
    where: {
      OR: [
        { id: 'cmrmoprit002vkb28x7n7aqi0' },
        { name: { contains: 'ذكي' } },
        { pixelName: { contains: 'ذكي' } },
      ],
    },
    select: {
      id: true,
      name: true,
      pixelName: true,
      pixelCode: true,
      pixelId: true,
      whatsappNumber: true,
      eventsApiConnected: true,
      eventsApiStatus: true,
      lastEventName: true,
      lastEventSentAt: true,
      lastApiHttpStatus: true,
      lastApiError: true,
      teamId: true,
    },
  });

  if (!pixel) {
    console.log(JSON.stringify({ error: 'pixel_not_found' }));
    await p.$disconnect();
    return;
  }

  const contacts = await p.tikTokIntegrationConversion.findMany({
    where: { integrationId: pixel.id, eventName: 'Contact' },
    orderBy: { createdAt: 'desc' },
    take: 10,
    select: {
      id: true,
      eventId: true,
      contactSent: true,
      tiktokStatus: true,
      tiktokResponse: true,
      tiktokError: true,
      whatsappPhone: true,
      ttclid: true,
      createdAt: true,
      sentAt: true,
      firstMessageAt: true,
      retryCount: true,
    },
  });

  const logs = await p.tikTokIntegrationApiLog.findMany({
    where: { integrationId: pixel.id, eventName: 'Contact' },
    orderBy: { createdAt: 'desc' },
    take: 10,
    select: {
      id: true,
      eventId: true,
      attempt: true,
      httpStatus: true,
      success: true,
      processingMs: true,
      responseBody: true,
      requestPayload: true,
      createdAt: true,
      conversionId: true,
    },
  });

  const stats = {
    contactsTotal: await p.tikTokIntegrationConversion.count({
      where: { integrationId: pixel.id, eventName: 'Contact', contactSent: true },
    }),
    contactsFailed: await p.tikTokIntegrationConversion.count({
      where: { integrationId: pixel.id, eventName: 'Contact', tiktokStatus: 'failed' },
    }),
    clicks: await p.tikTokIntegrationClick.count({ where: { integrationId: pixel.id } }),
  };

  console.log(JSON.stringify({ pixel, stats, contacts, logs }, null, 2));
  await p.$disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
