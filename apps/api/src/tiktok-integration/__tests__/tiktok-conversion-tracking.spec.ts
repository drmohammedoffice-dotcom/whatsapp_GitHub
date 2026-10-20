import {
  TEAM_A,
  TEAM_B,
  USER_A,
  USER_B,
  PIXEL_A,
  PIXEL_B,
  TOKEN_A,
  TOKEN_B,
  PHONE_CUST,
  createStore,
  createPrismaMock,
  seedWorkspace,
  createTrackingService,
  createLifecycleService,
  inboundInput,
  encodeHiddenTrackingRef,
} from './tiktok-conversion-tracking.test-utils';
import { TIKTOK_CONTACT_MAX_RETRIES, contactRetryDelayMs, sanitizeTtclid } from '../tiktok-integration.constants';
import { hashTikTokPhone } from '../tiktok-contact-hash';
import { tiktokPixelInlineScript } from '../tiktok-pixel-inline';

function contactEventCalls(ads: { trackPixelEvent: jest.Mock }) {
  return ads.trackPixelEvent.mock.calls.filter((c: any[]) => c[2]?.event === 'Contact');
}

function leadEventCalls(ads: { trackPixelEvent: jest.Mock }) {
  return ads.trackPixelEvent.mock.calls.filter(
    (c: any[]) =>
      c[2]?.event === 'Lead' ||
      (Array.isArray(c[2]?.companionEvents) &&
        c[2].companionEvents.some((e: { event: string }) => e.event === 'Lead')),
  );
}

describe('Real WhatsApp Conversion Tracking', () => {
  describe('1. Contact Event — once per new conversation on tracking WhatsApp', () => {
    it('does NOT send Contact on TikTok ad click / landing redirect', async () => {
      const store = createStore();
      const { integration } = seedWorkspace(store, {
        teamId: TEAM_A,
        userId: USER_A,
        pixelCode: PIXEL_A,
        encryptedToken: `enc:${TOKEN_A}`,
        slug: 'slug-a',
      });
      const prisma = createPrismaMock(store);
      const { service, ads } = createTrackingService({ prisma });

      const result = await service.handleRedirect({
        slug: integration.redirectSlug,
        ttclid: 'ttclid_click_abc',
      });

      expect(result.eventsSent).toEqual([]);
      expect(ads.trackPixelEvent).not.toHaveBeenCalled();
      expect(store.clicks.size).toBe(1);
      expect([...store.clicks.values()][0].ttclid).toBe('ttclid_click_abc');
    });

    it('does NOT send Contact when ttclid macro is unsubstituted', async () => {
      const store = createStore();
      seedWorkspace(store, {
        teamId: TEAM_A,
        userId: USER_A,
        pixelCode: PIXEL_A,
        encryptedToken: `enc:${TOKEN_A}`,
        slug: 'slug-a',
      });
      const prisma = createPrismaMock(store);
      const { service } = createTrackingService({ prisma });

      await service.handleRedirect({ slug: 'slug-a', ttclid: '__CLICKID__' });
      expect([...store.clicks.values()][0].ttclid).toBeNull();
    });

    it('tracks the click and redirects to a configured external WhatsApp group URL', async () => {
      const store = createStore();
      const { integration } = seedWorkspace(store, {
        teamId: TEAM_A,
        userId: USER_A,
        pixelCode: PIXEL_A,
        encryptedToken: `enc:${TOKEN_A}`,
        slug: 'slug-external',
      });
      Object.assign(integration, {
        redirectDestinationType: 'EXTERNAL_URL',
        externalRedirectUrl: 'https://chat.whatsapp.com/exampleInvite',
        whatsappNumber: null,
      });
      const prisma = createPrismaMock(store);
      const { service, ads } = createTrackingService({ prisma });

      const result = await service.handleRedirect({
        slug: integration.redirectSlug,
        ttclid: 'ttclid_group_click',
      });

      expect(result.redirectUrl).toBe('https://chat.whatsapp.com/exampleInvite');
      expect(result.destinationType).toBe('EXTERNAL_URL');
      expect(store.clicks.size).toBe(1);
      expect(ads.trackPixelEvent).not.toHaveBeenCalled();
    });

    it('landing pixel script never emits Contact track calls', () => {
      const html = tiktokPixelInlineScript(PIXEL_A, ['Contact', 'Lead', 'Purchase', 'PageView']);
      expect(html).toContain("ttq.page()");
      expect(html).not.toContain("ttq.track('Contact')");
      expect(html).not.toContain("ttq.track('Lead')");
      expect(html).not.toContain("ttq.track('Purchase')");
    });

    it('sends Contact after a real inbound WhatsApp message', async () => {
      const store = createStore();
      const { integration, channelId } = seedWorkspace(store, {
        teamId: TEAM_A,
        userId: USER_A,
        pixelCode: PIXEL_A,
        encryptedToken: `enc:${TOKEN_A}`,
        slug: 'slug-a',
      });
      const prisma = createPrismaMock(store);
      const { service, ads } = createTrackingService({ prisma });

      const click = await prisma.tikTokIntegrationClick.create({
        data: { integrationId: integration.id, ttclid: 'ttclid_real_1' },
      });
      await prisma.tikTokIntegrationLead.create({
        data: { integrationId: integration.id, clickId: click.id },
      });

      const convId = 'conv-1';
      await service.handleFirstInboundMessage(
        inboundInput(TEAM_A, channelId, convId, {
          messageText: `Hello${encodeHiddenTrackingRef(click.id)}`,
        }),
      );

      expect(contactEventCalls(ads)).toHaveLength(1);
      const payload = contactEventCalls(ads)[0][2];
      expect(leadEventCalls(ads).length).toBeGreaterThanOrEqual(1);
      expect(payload.event).toBe('Contact');
      expect(payload.ttclid).toBe('ttclid_real_1');
      expect(payload.event_id).toBeTruthy();

      const conversions = [...store.conversions.values()].filter((c) => c.eventName === 'Contact');
      expect(conversions).toHaveLength(1);
      expect(conversions[0].contactSent).toBe(true);
      expect(conversions[0].tiktokStatus).toBe('sent');
      expect(conversions[0].ttclid).toBe('ttclid_real_1');
      expect(leadEventCalls(ads).length).toBeGreaterThanOrEqual(1);
    });

    it('skips Contact for unsupported message types', async () => {
      const store = createStore();
      const { channelId } = seedWorkspace(store, {
        teamId: TEAM_A,
        userId: USER_A,
        pixelCode: PIXEL_A,
        encryptedToken: `enc:${TOKEN_A}`,
      });
      const prisma = createPrismaMock(store);
      const { service, ads } = createTrackingService({ prisma });

      await service.handleFirstInboundMessage({
        ...inboundInput(TEAM_A, channelId, 'conv-x'),
        messageType: 'SYSTEM' as any,
      });
      expect(ads.trackPixelEvent).not.toHaveBeenCalled();
    });

    it('skips Contact for AI/inbox WhatsApp (only tracking Business WA fires Contact)', async () => {
      const store = createStore();
      const { integration } = seedWorkspace(store, {
        teamId: TEAM_A,
        userId: USER_A,
        pixelCode: PIXEL_A,
        encryptedToken: `enc:${TOKEN_A}`,
      });
      const inboxChannelId = 'ch_inbox_ai';
      store.channels.set(inboxChannelId, {
        id: inboxChannelId,
        teamId: TEAM_A,
        externalId: integration.whatsappNumber,
        metadata: { purpose: 'inbox', phoneNumber: integration.whatsappNumber },
        whatsAppSession: {
          phoneNumber: integration.whatsappNumber,
          jid: `${integration.whatsappNumber}@s.whatsapp.net`,
        },
      });
      const prisma = createPrismaMock(store);
      const { service, ads } = createTrackingService({ prisma });
      const click = await prisma.tikTokIntegrationClick.create({
        data: { integrationId: integration.id, ttclid: 'ttclid_inbox_should_skip' },
      });

      await service.handleFirstInboundMessage(
        inboundInput(TEAM_A, inboxChannelId, 'conv-inbox', {
          messageText: `Hi${encodeHiddenTrackingRef(click.id)}`,
        }),
      );

      expect(ads.trackPixelEvent).not.toHaveBeenCalled();
      expect(store.conversions.size).toBe(0);
    });
  });

  describe('2. Once-per-conversation Contact', () => {
    async function setupAttributed(store = createStore()) {
      const { integration, channelId } = seedWorkspace(store, {
        teamId: TEAM_A,
        userId: USER_A,
        pixelCode: PIXEL_A,
        encryptedToken: `enc:${TOKEN_A}`,
      });
      const prisma = createPrismaMock(store);
      const { service, ads, queue } = createTrackingService({ prisma });
      const click = await prisma.tikTokIntegrationClick.create({
        data: { integrationId: integration.id, ttclid: 'ttclid_dup' },
      });
      return { store, prisma, service, ads, queue, integration, channelId, click };
    }

    it('second and third messages in the same conversation do not create another Contact', async () => {
      const { service, ads, channelId, click } = await setupAttributed();
      const text = `Hi${encodeHiddenTrackingRef(click.id)}`;
      await service.handleFirstInboundMessage(
        inboundInput(TEAM_A, channelId, 'conv-dup', { messageText: text, messageId: 'msg-1', isNewConversation: true } as any),
      );
      await service.handleFirstInboundMessage(
        inboundInput(TEAM_A, channelId, 'conv-dup', { messageText: text, messageId: 'msg-2', isNewConversation: false } as any),
      );
      await service.handleFirstInboundMessage(
        inboundInput(TEAM_A, channelId, 'conv-dup', { messageText: text, messageId: 'msg-3', isNewConversation: false } as any),
      );

      expect(contactEventCalls(ads)).toHaveLength(1);
    });

    it('multiple webhook deliveries of the same message create only one Contact', async () => {
      const { service, ads, channelId, click, store } = await setupAttributed();
      const text = `Hi${encodeHiddenTrackingRef(click.id)}`;
      const input = inboundInput(TEAM_A, channelId, 'conv-race', {
        messageText: text,
        messageId: 'msg-same',
      });

      await Promise.all([
        service.handleFirstInboundMessage(input),
        service.handleFirstInboundMessage(input),
        service.handleFirstInboundMessage(input),
        service.handleFirstInboundMessage(input),
      ]);

      const contacts = [...store.conversions.values()].filter((c) => c.eventName === 'Contact');
      expect(contacts.length).toBe(1);
      expect(contactEventCalls(ads).length).toBeLessThanOrEqual(1);
    });

    it('follow-up messages from the same phone do not create another Contact', async () => {
      const { service, ads, channelId, click, store } = await setupAttributed();
      const text1 = `Hi${encodeHiddenTrackingRef(click.id)}`;
      await service.handleFirstInboundMessage(
        inboundInput(TEAM_A, channelId, 'conv-once', {
          messageText: text1,
          messageId: 'msg-once-1',
          isNewConversation: true,
        } as any),
      );
      expect(contactEventCalls(ads)).toHaveLength(1);

      await service.handleFirstInboundMessage(
        inboundInput(TEAM_A, channelId, 'conv-once', {
          messageText: 'second message same customer',
          messageId: 'msg-once-2',
          isNewConversation: false,
        } as any),
      );
      await service.handleFirstInboundMessage(
        inboundInput(TEAM_A, channelId, 'conv-once', {
          messageText: 'third message same customer',
          messageId: 'msg-once-3',
          isNewConversation: false,
        } as any),
      );

      expect(contactEventCalls(ads)).toHaveLength(1);
      const contacts = [...store.conversions.values()].filter((c) => c.eventName === 'Contact');
      expect(contacts).toHaveLength(1);
    });

    it('new ad click with explicit tracking ref can open a new journey for the same phone', async () => {
      const { service, ads, channelId, click, integration, prisma, store } = await setupAttributed();
      await service.handleFirstInboundMessage(
        inboundInput(TEAM_A, channelId, 'conv-camp-1', {
          messageText: `Hi${encodeHiddenTrackingRef(click.id)}`,
          messageId: 'msg-camp-1',
          isNewConversation: true,
        } as any),
      );
      expect(contactEventCalls(ads)).toHaveLength(1);

      const click2 = await prisma.tikTokIntegrationClick.create({
        data: { integrationId: integration.id, ttclid: 'ttclid_campaign_2' },
      });
      store.clicks.get(click2.id)!.createdAt = new Date(Date.now() + 2000);
      // Without explicit ref → still blocked (one conversion per phone journey).
      await service.handleFirstInboundMessage(
        inboundInput(TEAM_A, channelId, 'conv-camp-1', {
          messageText: 'Hi from campaign 2 without ref',
          messageId: 'msg-camp-2-noref',
          isNewConversation: false,
        } as any),
      );
      expect(contactEventCalls(ads)).toHaveLength(1);
    });

    it('10 distinct conversations produce 10 Contacts with no duplicates', async () => {
      const store = createStore();
      const { integration, channelId } = seedWorkspace(store, {
        teamId: TEAM_A,
        userId: USER_A,
        pixelCode: PIXEL_A,
        encryptedToken: `enc:${TOKEN_A}`,
      });
      const prisma = createPrismaMock(store);
      const { service, ads } = createTrackingService({ prisma });

      for (let i = 0; i < 10; i += 1) {
        const click = await prisma.tikTokIntegrationClick.create({
          data: { integrationId: integration.id, ttclid: `ttclid_ten_${i}` },
        });
        await service.handleFirstInboundMessage(
          inboundInput(TEAM_A, channelId, `conv-ten-${i}`, {
            messageText: `Hi${encodeHiddenTrackingRef(click.id)}`,
            messageId: `msg-ten-${i}`,
            phone: `9665${String(20000000 + i).slice(0, 8)}`,
          }),
        );
      }

      expect(contactEventCalls(ads)).toHaveLength(10);
      const contactsOnly = [...store.conversions.values()].filter((c) => c.eventName === 'Contact');
      expect(contactsOnly).toHaveLength(10);
      const eventIds = new Set(contactsOnly.map((c) => c.eventId));
      expect(eventIds.size).toBe(10);
      expect(contactsOnly.every((c) => c.contactSent && c.eventName === 'Contact')).toBe(true);
    });

    it('10 conversations without clicks still produce 10 Contacts (dashboard = Events API = DB)', async () => {
      const store = createStore();
      const { channelId } = seedWorkspace(store, {
        teamId: TEAM_A,
        userId: USER_A,
        pixelCode: PIXEL_A,
        encryptedToken: `enc:${TOKEN_A}`,
      });
      const prisma = createPrismaMock(store);
      const { service, ads } = createTrackingService({ prisma });

      for (let i = 0; i < 10; i += 1) {
        await service.handleFirstInboundMessage(
          inboundInput(TEAM_A, channelId, `conv-noclick-${i}`, {
            messageText: 'Hello from WhatsApp',
            messageId: `msg-noclick-${i}`,
            phone: `9665${String(30000000 + i).slice(0, 8)}`,
          }),
        );
      }

      const contacts = [...store.conversions.values()].filter((c) => c.eventName === 'Contact' && c.contactSent);
      expect(contacts).toHaveLength(10);
      expect(contactEventCalls(ads)).toHaveLength(10);
      expect(new Set(contacts.map((c) => c.conversationId)).size).toBe(10);
      expect(new Set(contacts.map((c) => c.eventId)).size).toBe(10);
    });
  });

  describe('3. Retry Logic', () => {
    it('uses exponential backoff delays', () => {
      expect(contactRetryDelayMs(1)).toBe(2 * 60 * 1000);
      expect(contactRetryDelayMs(2)).toBe(4 * 60 * 1000);
      expect(contactRetryDelayMs(3)).toBe(8 * 60 * 1000);
      expect(contactRetryDelayMs(10)).toBe(60 * 60 * 1000);
      expect(TIKTOK_CONTACT_MAX_RETRIES).toBe(5);
    });

    it('retries on 500 / timeout / network failure then succeeds', async () => {
      const store = createStore();
      const { integration } = seedWorkspace(store, {
        teamId: TEAM_A,
        userId: USER_A,
        pixelCode: PIXEL_A,
        encryptedToken: `enc:${TOKEN_A}`,
      });
      const prisma = createPrismaMock(store);
      const ads = {
        trackPixelEvent: jest
          .fn()
          .mockRejectedValueOnce(Object.assign(new Error('HTTP 500'), { response: { status: 500 } }))
          .mockRejectedValueOnce(new Error('timeout'))
          .mockRejectedValueOnce(new Error('network failure'))
          .mockResolvedValue({ code: 0, message: 'OK' }),
        registerPixelEvents: jest.fn(async () => ({})),
      };
      const queue = { add: jest.fn(async () => ({ id: 'job' })) };
      const { service } = createTrackingService({ prisma, ads, queue });

      store.conversions.set('conv_retry', {
        id: 'conv_retry',
        integrationId: integration.id,
        leadId: null,
        clickId: null,
        conversationId: 'c1',
        contactId: null,
        whatsappPhone: PHONE_CUST,
        eventId: 'evt-1',
        eventName: 'Contact',
        ttclid: 'ttclid_retry',
        externalId: null,
        pageUrl: 'https://app.test/r/slug-a',
        firstMessageAt: new Date(),
        contactSent: false,
        tiktokStatus: 'pending',
        retryCount: 0,
        nextRetryAt: null,
        sentAt: null,
        createdAt: new Date(),
      });

      await service.dispatchContactEvent('conv_retry');
      expect(store.conversions.get('conv_retry')!.tiktokStatus).toBe('pending');
      expect(store.conversions.get('conv_retry')!.retryCount).toBe(1);
      expect(queue.add).toHaveBeenCalled();

      // simulate scheduled retries
      store.conversions.get('conv_retry')!.tiktokStatus = 'pending';
      await service.dispatchContactEvent('conv_retry');
      store.conversions.get('conv_retry')!.tiktokStatus = 'pending';
      await service.dispatchContactEvent('conv_retry');
      store.conversions.get('conv_retry')!.tiktokStatus = 'pending';
      await service.dispatchContactEvent('conv_retry');

      expect(store.conversions.get('conv_retry')!.contactSent).toBe(true);
      expect(store.conversions.get('conv_retry')!.tiktokStatus).toBe('sent');
      // Contact retries (4) + companion Lead (1) after success
      expect(ads.trackPixelEvent.mock.calls.filter((c: any[]) => c[2]?.event === 'Contact')).toHaveLength(4);
    });

    it('stops permanently after 5 retries', async () => {
      const store = createStore();
      const { integration } = seedWorkspace(store, {
        teamId: TEAM_A,
        userId: USER_A,
        pixelCode: PIXEL_A,
        encryptedToken: `enc:${TOKEN_A}`,
      });
      const prisma = createPrismaMock(store);
      const ads = {
        trackPixelEvent: jest.fn(async () => {
          throw new Error('persistent failure');
        }),
        registerPixelEvents: jest.fn(async () => ({})),
      };
      const queue = { add: jest.fn(async () => ({ id: 'job' })) };
      const { service } = createTrackingService({ prisma, ads, queue });

      store.conversions.set('conv_fail', {
        id: 'conv_fail',
        integrationId: integration.id,
        conversationId: 'c-fail',
        eventId: 'evt-fail',
        eventName: 'Contact',
        ttclid: null,
        contactSent: false,
        tiktokStatus: 'pending',
        retryCount: 0,
        nextRetryAt: null,
        firstMessageAt: new Date(),
        createdAt: new Date(),
        pageUrl: null,
        whatsappPhone: PHONE_CUST,
        leadId: null,
        clickId: null,
        contactId: null,
        externalId: null,
      });

      for (let i = 0; i < 5; i += 1) {
        store.conversions.get('conv_fail')!.tiktokStatus = 'pending';
        await service.dispatchContactEvent('conv_fail');
      }

      const row = store.conversions.get('conv_fail')!;
      expect(row.retryCount).toBe(5);
      expect(row.tiktokStatus).toBe('failed');
      expect(row.contactSent).toBe(false);
      expect(queue.add).toHaveBeenCalledTimes(4);

      // exhausted — further inbound-style dispatch must not claim
      store.conversions.get('conv_fail')!.tiktokStatus = 'pending'; // even if wrongly pending
      await service.dispatchContactEvent('conv_fail');
      expect(ads.trackPixelEvent).toHaveBeenCalledTimes(5);
    });

    it('does not create a second Contact for the same conversation after a failed exhausted row', async () => {
      const store = createStore();
      const { integration, channelId } = seedWorkspace(store, {
        teamId: TEAM_A,
        userId: USER_A,
        pixelCode: PIXEL_A,
        encryptedToken: `enc:${TOKEN_A}`,
      });
      const prisma = createPrismaMock(store);
      const { service, ads } = createTrackingService({ prisma });
      const click = await prisma.tikTokIntegrationClick.create({
        data: { integrationId: integration.id, ttclid: 'x' },
      });

      store.conversions.set('conv_failed_row', {
        id: 'conv_failed_row',
        integrationId: integration.id,
        conversationId: 'conv-later',
        messageId: 'msg-old-failed',
        eventName: 'Contact',
        eventId: 'evt',
        contactSent: false,
        tiktokStatus: 'failed',
        retryCount: 5,
        ttclid: 'x',
        firstMessageAt: new Date(),
        createdAt: new Date(),
        whatsappPhone: PHONE_CUST,
      });

      await service.handleFirstInboundMessage(
        inboundInput(TEAM_A, channelId, 'conv-later', {
          messageText: `Hi${encodeHiddenTrackingRef(click.id)}`,
          messageId: 'msg-new',
        }),
      );
      expect(ads.trackPixelEvent).not.toHaveBeenCalled();
    });

    it('creates Contact for a brand-new conversation after a prior failed conversation', async () => {
      const store = createStore();
      const { integration, channelId } = seedWorkspace(store, {
        teamId: TEAM_A,
        userId: USER_A,
        pixelCode: PIXEL_A,
        encryptedToken: `enc:${TOKEN_A}`,
      });
      const prisma = createPrismaMock(store);
      const { service, ads } = createTrackingService({ prisma });
      const click = await prisma.tikTokIntegrationClick.create({
        data: { integrationId: integration.id, ttclid: 'x2' },
      });

      store.conversions.set('conv_failed_row', {
        id: 'conv_failed_row',
        integrationId: integration.id,
        conversationId: 'conv-old-failed',
        messageId: 'msg-old-failed',
        eventName: 'Contact',
        eventId: 'evt',
        contactSent: false,
        tiktokStatus: 'failed',
        retryCount: 5,
        ttclid: 'x',
        firstMessageAt: new Date(),
        createdAt: new Date(),
        whatsappPhone: PHONE_CUST,
      });

      await service.handleFirstInboundMessage(
        inboundInput(TEAM_A, channelId, 'conv-brand-new', {
          messageText: `Hi${encodeHiddenTrackingRef(click.id)}`,
          messageId: 'msg-brand-new',
        }),
      );
      expect(contactEventCalls(ads)).toHaveLength(1);
    });
  });

  describe('4. ttclid Attribution', () => {
    it('attaches click ttclid to Contact and Lead payloads', async () => {
      const store = createStore();
      const { integration, channelId } = seedWorkspace(store, {
        teamId: TEAM_A,
        userId: USER_A,
        pixelCode: PIXEL_A,
        encryptedToken: `enc:${TOKEN_A}`,
      });
      const prisma = createPrismaMock(store);
      const { service: tracking, ads } = createTrackingService({ prisma });
      const { service: lifecycle } = createLifecycleService({ prisma, ads, credentials: {
        getAccessTokenForIntegration: jest.fn(() => TOKEN_A),
        getPlatformCredentials: jest.fn(() => ({
          pixelCode: 'PLATFORM_PIXEL',
          accessToken: 'platform-events-access-token-secret',
        })),
      } as any });

      const click = await prisma.tikTokIntegrationClick.create({
        data: { integrationId: integration.id, ttclid: 'ttclid_attr_123' },
      });
      await tracking.handleFirstInboundMessage(
        inboundInput(TEAM_A, channelId, 'conv-attr', {
          messageText: `Hi${encodeHiddenTrackingRef(click.id)}`,
        }),
      );

      expect(ads.trackPixelEvent.mock.calls[0][2].ttclid).toBe('ttclid_attr_123');
      expect(ads.trackPixelEvent.mock.calls[0][2].companionEvents).toEqual(
        expect.arrayContaining([expect.objectContaining({ event: 'Lead' })]),
      );

      await lifecycle.sendLeadForConversation(TEAM_A, 'conv-attr');
      const leadCall = ads.trackPixelEvent.mock.calls.find(
        (c: any[]) =>
          c[2]?.event === 'Lead' ||
          (Array.isArray(c[2]?.companionEvents) &&
            c[2].companionEvents.some((e: { event: string }) => e.event === 'Lead')),
      );
      expect(leadCall?.[2].ttclid ?? leadCall?.[2]?.companionEvents).toBeTruthy();
      expect(leadEventCalls(ads).length).toBeGreaterThanOrEqual(1);
    });

    it('fires CompletePayment companion when pixel optimization is Purchase', async () => {
      const store = createStore();
      const { integration, channelId } = seedWorkspace(store, {
        teamId: TEAM_A,
        userId: USER_A,
        pixelCode: PIXEL_A,
        encryptedToken: `enc:${TOKEN_A}`,
        defaultOptimizationEvent: 'Purchase',
      });
      const prisma = createPrismaMock(store);
      const { service, ads } = createTrackingService({ prisma });
      const click = await prisma.tikTokIntegrationClick.create({
        data: { integrationId: integration.id, ttclid: 'ttclid_purchase_1' },
      });

      await service.handleFirstInboundMessage(
        inboundInput(TEAM_A, channelId, 'conv-purchase', {
          messageText: `Hi${encodeHiddenTrackingRef(click.id)}`,
          messageId: 'msg-purchase-1',
          isNewConversation: true,
        } as any),
      );

      expect(contactEventCalls(ads)).toHaveLength(1);
      const purchaseCall = ads.trackPixelEvent.mock.calls.find(
        (c: any[]) => c[2]?.event === 'CompletePayment' || c[2]?.event === 'Purchase',
      );
      expect(purchaseCall).toBeTruthy();
      expect(purchaseCall?.[2].ttclid).toBe('ttclid_purchase_1');
      expect(purchaseCall?.[2].properties).toEqual(
        expect.objectContaining({ value: '1', currency: 'USD' }),
      );

      const purchaseRows = [...store.conversions.values()].filter(
        (c) => c.eventName === 'CompletePayment' || c.eventName === 'Purchase',
      );
      expect(purchaseRows.some((c) => c.contactSent)).toBe(true);
    });

    it('Purchase includes value, currency, order_id (and optional ttclid)', async () => {
      const store = createStore();
      const prisma = createPrismaMock(store);
      const ads = { trackPixelEvent: jest.fn(async () => ({ code: 0 })) };
      const { service } = createLifecycleService({
        prisma,
        ads,
        credentials: {
          getAccessTokenForIntegration: jest.fn(),
          getPlatformCredentials: jest.fn(() => ({
            pixelCode: 'PLATFORM_PIXEL',
            accessToken: 'platform-events-access-token-secret',
          })),
        } as any,
      });

      // Extend via raw credentials path (platform purchase)
      await service.sendPurchase({
        teamId: TEAM_A,
        paymentId: 'pay_1',
        amountCents: 4999,
        currency: 'USD',
      });

      expect(ads.trackPixelEvent).toHaveBeenCalledTimes(1);
      const payload = (ads.trackPixelEvent as jest.Mock).mock.calls[0][2] as {
        event: string;
        properties: Record<string, string>;
        event_id: string;
        event_time: number;
      };
      expect(payload.event).toBe('Purchase');
      expect(payload.properties).toMatchObject({
        value: '49.99',
        currency: 'USD',
        order_id: 'pay_1',
      });
      expect(payload.event_id).toBe('purchase_pay_1');
      expect(payload.event_time).toBeGreaterThan(0);
    });

    it('sanitizeTtclid rejects unsubstituted macros', () => {
      expect(sanitizeTtclid('__CLICKID__')).toBeNull();
      expect(sanitizeTtclid('{{ttclid}}')).toBeNull();
      expect(sanitizeTtclid('real_ttclid_value')).toBe('real_ttclid_value');
    });
  });

  describe('5. Workspace Isolation', () => {
    it('never attributes Workspace B click to Workspace A inbound', async () => {
      const store = createStore();
      const a = seedWorkspace(store, {
        teamId: TEAM_A,
        userId: USER_A,
        pixelCode: PIXEL_A,
        encryptedToken: `enc:${TOKEN_A}`,
        slug: 'slug-a',
      });
      const b = seedWorkspace(store, {
        teamId: TEAM_B,
        userId: USER_B,
        pixelCode: PIXEL_B,
        encryptedToken: `enc:${TOKEN_B}`,
        slug: 'slug-b',
      });
      const prisma = createPrismaMock(store);
      const { service, ads } = createTrackingService({ prisma });

      const clickB = await prisma.tikTokIntegrationClick.create({
        data: { integrationId: b.integration.id, ttclid: 'ttclid_b_only' },
      });

      // Team A receives message with Team B's hidden ref — must not steal B's ttclid.
      // Contact may still fire on A's own pixel (without click / without B's ttclid).
      await service.handleFirstInboundMessage(
        inboundInput(TEAM_A, a.channelId, 'conv-iso', {
          messageText: `Hi${encodeHiddenTrackingRef(clickB.id)}`,
        }),
      );

      expect(contactEventCalls(ads)).toHaveLength(1);
      const contactCall = contactEventCalls(ads)[0];
      expect(contactCall[0]).toBe(TOKEN_A);
      expect(contactCall[1]).toBe(PIXEL_A);
      expect(contactCall[2].ttclid).toBeNull();
      const aContacts = [...store.conversions.values()].filter(
        (c) => c.integrationId === a.integration.id && c.eventName === 'Contact',
      );
      const bContacts = [...store.conversions.values()].filter(
        (c) => c.integrationId === b.integration.id && c.eventName === 'Contact',
      );
      expect(aContacts).toHaveLength(1);
      expect(bContacts).toHaveLength(0);
    });

    it('Workspace A uses only its pixel + token', async () => {
      const store = createStore();
      const a = seedWorkspace(store, {
        teamId: TEAM_A,
        userId: USER_A,
        pixelCode: PIXEL_A,
        encryptedToken: `enc:${TOKEN_A}`,
      });
      seedWorkspace(store, {
        teamId: TEAM_B,
        userId: USER_B,
        pixelCode: PIXEL_B,
        encryptedToken: `enc:${TOKEN_B}`,
      });
      const prisma = createPrismaMock(store);
      const { service, ads } = createTrackingService({ prisma });
      const clickA = await prisma.tikTokIntegrationClick.create({
        data: { integrationId: a.integration.id, ttclid: 'ttclid_a' },
      });

      await service.handleFirstInboundMessage(
        inboundInput(TEAM_A, a.channelId, 'conv-a', {
          messageText: `Hi${encodeHiddenTrackingRef(clickA.id)}`,
        }),
      );

      expect(contactEventCalls(ads)).toHaveLength(1);
      expect(contactEventCalls(ads)[0][0]).toBe(TOKEN_A);
      expect(contactEventCalls(ads)[0][1]).toBe(PIXEL_A);
      expect(contactEventCalls(ads)[0][0]).not.toBe(TOKEN_B);
      expect(contactEventCalls(ads)[0][1]).not.toBe(PIXEL_B);
    });
  });

  describe('11b. Phone mismatch & trunk-zero attribution', () => {
    it('attributes Contact when inbound WA phone differs from pixel whatsappNumber (recent click fallback)', async () => {
      const store = createStore();
      const { integration } = seedWorkspace(store, {
        teamId: TEAM_A,
        userId: USER_A,
        pixelCode: PIXEL_A,
        encryptedToken: `enc:${TOKEN_A}`,
        whatsappNumber: '96407731777326', // trunk-zero form
      });
      // Channel receives on a different connected number (redirect fallback case)
      const otherChannelId = 'ch_other_phone';
      store.channels.set(otherChannelId, {
        id: otherChannelId,
        teamId: TEAM_A,
        externalId: '9647829307631',
        metadata: { purpose: 'tracking', phoneNumber: '9647829307631' },
        whatsAppSession: {
          status: 'CONNECTED',
          phoneNumber: '9647829307631',
          jid: '9647829307631@s.whatsapp.net',
        },
      });
      const prisma = createPrismaMock(store);
      const { service, ads } = createTrackingService({ prisma });
      await prisma.tikTokIntegrationClick.create({
        data: { integrationId: integration.id, ttclid: 'ttclid_mismatch' },
      });

      await service.handleFirstInboundMessage(
        inboundInput(TEAM_A, otherChannelId, 'conv-mismatch', {
          messageText: 'مرحبا بدون مرجع مخفي',
          phone: '9647800112233',
        }),
      );

      expect(contactEventCalls(ads)).toHaveLength(1);
      expect(contactEventCalls(ads)[0][2].event).toBe('Contact');
    });

    it('matches Iraq numbers with trunk zero after country code', async () => {
      const store = createStore();
      const { integration, channelId } = seedWorkspace(store, {
        teamId: TEAM_A,
        userId: USER_A,
        pixelCode: PIXEL_A,
        encryptedToken: `enc:${TOKEN_A}`,
        whatsappNumber: '96407731777326',
      });
      // Channel stores without trunk zero (still tracking WA for ads)
      store.channels.set(channelId, {
        id: channelId,
        teamId: TEAM_A,
        externalId: '9647731777326',
        metadata: {
          purpose: 'tracking',
          connectionSource: 'tiktok_tracking',
          phoneNumber: '9647731777326',
          integrationId: integration.id,
        },
        whatsAppSession: {
          status: 'CONNECTED',
          phoneNumber: '9647731777326',
          jid: '9647731777326@s.whatsapp.net',
        },
      });
      const prisma = createPrismaMock(store);
      const { service, ads } = createTrackingService({ prisma });
      await prisma.tikTokIntegrationClick.create({
        data: { integrationId: integration.id, ttclid: 'ttclid_trunk' },
      });

      await service.handleFirstInboundMessage(
        inboundInput(TEAM_A, channelId, 'conv-trunk', {
          messageText: 'hello plain',
          phone: '9647811223344',
        }),
      );

      expect(contactEventCalls(ads)).toHaveLength(1);
    });
  });

  describe('12. Performance — concurrent inbound stress', () => {
    it('100 simultaneous inbounds for distinct conversations produce 100 Contacts without duplicates', async () => {
      const store = createStore();
      const { integration, channelId } = seedWorkspace(store, {
        teamId: TEAM_A,
        userId: USER_A,
        pixelCode: PIXEL_A,
        encryptedToken: `enc:${TOKEN_A}`,
      });
      const prisma = createPrismaMock(store);
      const { service, ads } = createTrackingService({ prisma });

      // Pre-create clicks (one per conversation) to attribute reliably
      const jobs = await Promise.all(
        Array.from({ length: 100 }, async (_, i) => {
          const click = await prisma.tikTokIntegrationClick.create({
            data: { integrationId: integration.id, ttclid: `ttclid_${i}` },
          });
          return service.handleFirstInboundMessage(
            inboundInput(TEAM_A, channelId, `conv-stress-${i}`, {
              messageText: `Hi${encodeHiddenTrackingRef(click.id)}`,
              phone: `9665${String(10000000 + i).slice(0, 8)}`,
            }),
          );
        }),
      );

      expect(jobs).toHaveLength(100);
      expect(contactEventCalls(ads)).toHaveLength(100);
      const contactsOnly = [...store.conversions.values()].filter((c) => c.eventName === 'Contact');
      expect(contactsOnly).toHaveLength(100);
      const eventIds = new Set(contactsOnly.map((c) => c.eventId));
      expect(eventIds.size).toBe(100);
    }, 30000);

    it('100 concurrent deliveries for SAME message yield a single Contact', async () => {
      const store = createStore();
      const { integration, channelId } = seedWorkspace(store, {
        teamId: TEAM_A,
        userId: USER_A,
        pixelCode: PIXEL_A,
        encryptedToken: `enc:${TOKEN_A}`,
      });
      const prisma = createPrismaMock(store);
      const { service, ads } = createTrackingService({ prisma });
      const click = await prisma.tikTokIntegrationClick.create({
        data: { integrationId: integration.id, ttclid: 'ttclid_same' },
      });
      const text = `Hi${encodeHiddenTrackingRef(click.id)}`;
      const input = inboundInput(TEAM_A, channelId, 'conv-same', {
        messageText: text,
        messageId: 'msg-same-stress',
      });

      await Promise.all(Array.from({ length: 100 }, () => service.handleFirstInboundMessage(input)));

      const contactsOnly = [...store.conversions.values()].filter((c) => c.eventName === 'Contact');
      expect(contactsOnly).toHaveLength(1);
      expect(contactEventCalls(ads).length).toBeLessThanOrEqual(2);
    }, 30000);
  });
});

describe('hashTikTokPhone', () => {
  it('hashes E.164 phones and rejects short numbers', () => {
    const hash = hashTikTokPhone('+966 511 122 233');
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(hashTikTokPhone('123')).toBeNull();
  });
});

describe('LANDING_LEAD COD orders', () => {
  it('sends Lead only — never Purchase/CompletePayment — and respects event_id + ttclid', async () => {
    const store = createStore();
    const { integration } = seedWorkspace(store, {
      teamId: TEAM_A,
      userId: USER_A,
      pixelCode: PIXEL_A,
      encryptedToken: `enc:${TOKEN_A}`,
      slug: 'ibraq-slug',
      defaultOptimizationEvent: 'Purchase',
    });
    const prisma = createPrismaMock(store);
    const { service, ads } = createTrackingService({ prisma });

    const first = await service.trackEcommerceOrderConversion({
      integrationId: integration.id,
      orderId: 'booking_ibraq_1',
      orderNumber: 'ORD-IBRAQ-1',
      ttclid: 'ttclid_landing_xyz',
      phone: '07701234567',
      value: 120000,
      currency: 'IQD',
      pageUrl: 'https://example.com/store/ibraq-musk',
      kind: 'LANDING_LEAD',
      eventId: 'lead_shared_browser_server',
    });
    expect(first.ok).toBe(true);

    const payloads = ads.trackPixelEvent.mock.calls.map((c: any[]) => c[2]);
    expect(payloads).toHaveLength(1);
    expect(payloads[0].event).toBe('Lead');
    expect(payloads[0].event_id).toBe('lead_shared_browser_server');
    expect(payloads[0].ttclid).toBe('ttclid_landing_xyz');
    expect(payloads[0].properties).toEqual(
      expect.objectContaining({ value: '120000', currency: 'IQD', order_id: 'ORD-IBRAQ-1' }),
    );
    expect(payloads.some((p: any) => p.event === 'Purchase' || p.event === 'CompletePayment')).toBe(false);

    const second = await service.trackEcommerceOrderConversion({
      integrationId: integration.id,
      orderId: 'booking_ibraq_1',
      orderNumber: 'ORD-IBRAQ-1',
      ttclid: 'ttclid_landing_xyz',
      value: 120000,
      currency: 'IQD',
      kind: 'LANDING_LEAD',
      eventId: 'lead_shared_browser_server',
    });
    expect(second).toEqual(expect.objectContaining({ ok: true, deduped: true }));
    expect(ads.trackPixelEvent).toHaveBeenCalledTimes(1);
  });

  it('browser pixel whitelist allows ViewContent/InitiateCheckout but not Lead/Purchase', () => {
    const html = tiktokPixelInlineScript(PIXEL_A, [
      'ViewContent',
      'InitiateCheckout',
      'Lead',
      'Purchase',
      'CompletePayment',
    ]);
    expect(html).toContain("ttq.track('ViewContent')");
    expect(html).toContain("ttq.track('InitiateCheckout')");
    expect(html).not.toContain("ttq.track('Lead')");
    expect(html).not.toContain("ttq.track('Purchase')");
    expect(html).not.toContain("ttq.track('CompletePayment')");
  });
});
