import { BadRequestException } from '@nestjs/common';
import { EncryptionService } from '../../security/encryption.service';
import {
  TEAM_A,
  USER_A,
  PIXEL_A,
  TOKEN_A,
  createStore,
  createPrismaMock,
  seedWorkspace,
  createCredentialsService,
  createLifecycleService,
  createTrackingService,
  encodeHiddenTrackingRef,
  inboundInput,
} from './tiktok-conversion-tracking.test-utils';
import { TikTokIntegrationService } from '../tiktok-integration.service';

describe('Token Security + Pixel Validation + Lifecycle Events', () => {
  describe('6. Token Security', () => {
    it('encrypts Events API Access Token at rest (never plaintext)', () => {
      const encryption = new EncryptionService({
        getOrThrow: () => 'test-encryption-key-32-characters!!',
      } as any);
      const encrypted = encryption.encryptJson(TOKEN_A);
      expect(encrypted).not.toContain(TOKEN_A);
      expect(encrypted).not.toContain('events-api-access-token');
      expect(encryption.decryptJson(encrypted)).toBe(TOKEN_A);
    });

    it('saveCredentials stores encrypted token and returns only a hint', async () => {
      const store = createStore();
      seedWorkspace(store, {
        teamId: TEAM_A,
        userId: USER_A,
        pixelCode: PIXEL_A,
        encryptedToken: null,
      });
      const prisma = createPrismaMock(store);
      const ads = {
        trackPixelEvent: jest.fn(async () => ({ code: 0, message: 'OK' })),
        listPixels: jest.fn(async () => [
          {
            pixel_id: `pid_${TEAM_A}`,
            pixel_code: PIXEL_A,
            pixel_name: 'Pixel A',
            activity_status: 'ENABLE',
            raw: {},
          },
        ]),
      };
      const { service, encryption } = createCredentialsService({ prisma, ads });

      const result = await service.saveCredentials(USER_A, TEAM_A, `integ_${TEAM_A}`, {
        pixelCode: PIXEL_A,
        accessToken: TOKEN_A,
      });

      const stored = store.integrations.get(`integ_${TEAM_A}`)!;
      expect(stored.encryptedEventsApiAccessToken).toBeTruthy();
      expect(stored.encryptedEventsApiAccessToken).not.toContain(TOKEN_A);
      expect(encryption.decryptJson(stored.encryptedEventsApiAccessToken)).toBe(TOKEN_A);

      expect(JSON.stringify(result)).not.toContain(TOKEN_A);
      expect(result.hasEventsApiToken).toBe(true);
      expect(result.eventsApiTokenHint).toMatch(/…/);
      expect((result as any).accessToken).toBeUndefined();
      expect((result as any).encryptedEventsApiAccessToken).toBeUndefined();
    });

    it('toView never exposes encrypted or plaintext token', () => {
      const store = createStore();
      const { integration } = seedWorkspace(store, {
        teamId: TEAM_A,
        userId: USER_A,
        pixelCode: PIXEL_A,
        encryptedToken: 'enc:super-secret-token-value-xxxxxx',
      });

      // Use private toView via prototype
      const svc = Object.create(TikTokIntegrationService.prototype) as any;
      const view = svc.toView(
        { ...integration, encryptedEventsApiAccessToken: 'ENCRYPTED_BLOB_SECRET' },
        'https://app.test',
      );

      expect(JSON.stringify(view)).not.toContain('ENCRYPTED_BLOB_SECRET');
      expect(JSON.stringify(view)).not.toContain('super-secret-token');
      expect(view.hasEventsApiToken).toBe(true);
      expect(view.accessToken).toBeUndefined();
      expect(view.encryptedEventsApiAccessToken).toBeUndefined();
    });

    it('API logs never contain access tokens', async () => {
      const store = createStore();
      const { integration, channelId } = seedWorkspace(store, {
        teamId: TEAM_A,
        userId: USER_A,
        pixelCode: PIXEL_A,
        encryptedToken: `enc:${TOKEN_A}`,
      });
      const prisma = createPrismaMock(store);
      const { service } = createTrackingService({ prisma });
      const click = await prisma.tikTokIntegrationClick.create({
        data: { integrationId: integration.id, ttclid: 'ttclid_log' },
      });

      await service.handleFirstInboundMessage(
        inboundInput(TEAM_A, channelId, 'conv-log', {
          messageText: `Hi${encodeHiddenTrackingRef(click.id)}`,
        }),
      );

      expect(store.apiLogs.length).toBeGreaterThan(0);
      const serialized = JSON.stringify(store.apiLogs);
      expect(serialized).not.toContain(TOKEN_A);
      expect(serialized).not.toMatch(/access[_-]?token":\s*"[^"]{10,}/i);
      expect(store.apiLogs[0].requestPayload.event).toBe('Contact');
      expect(store.apiLogs[0].attempt).toBe(1);
    });
  });

  describe('7. Pixel Validation', () => {
    it('rejects invalid access token on save', async () => {
      const store = createStore();
      seedWorkspace(store, {
        teamId: TEAM_A,
        userId: USER_A,
        pixelCode: PIXEL_A,
      });
      const prisma = createPrismaMock(store);
      const ads = {
        trackPixelEvent: jest.fn(async () => {
          throw new Error('401 Unauthorized invalid token');
        }),
        listPixels: jest.fn(async () => []),
      };
      const { service } = createCredentialsService({ prisma, ads });

      await expect(
        service.saveCredentials(USER_A, TEAM_A, `integ_${TEAM_A}`, {
          pixelCode: PIXEL_A,
          accessToken: 'this-is-an-invalid-but-long-enough-token',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(store.integrations.get(`integ_${TEAM_A}`)!.encryptedEventsApiAccessToken).toBeNull();
    });

    it('rejects short access token', async () => {
      const store = createStore();
      seedWorkspace(store, { teamId: TEAM_A, userId: USER_A, pixelCode: PIXEL_A });
      const prisma = createPrismaMock(store);
      const { service } = createCredentialsService({ prisma });

      await expect(
        service.saveCredentials(USER_A, TEAM_A, `integ_${TEAM_A}`, {
          pixelCode: PIXEL_A,
          accessToken: 'short',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('Test Connection fails for missing credentials', async () => {
      const store = createStore();
      seedWorkspace(store, { teamId: TEAM_A, userId: USER_A, pixelCode: PIXEL_A });
      const prisma = createPrismaMock(store);
      const { service } = createCredentialsService({ prisma });

      const result = await service.testConnection(USER_A, TEAM_A, `integ_${TEAM_A}`);
      expect(result.ok).toBe(false);
      expect(result.message).toMatch(/required/i);
    });

    it('Test Connection fails for expired / invalid token', async () => {
      const store = createStore();
      const encryption = new EncryptionService({
        getOrThrow: () => 'test-encryption-key-32-characters!!',
      } as any);
      seedWorkspace(store, {
        teamId: TEAM_A,
        userId: USER_A,
        pixelCode: PIXEL_A,
        encryptedToken: encryption.encryptJson(TOKEN_A),
      });
      const prisma = createPrismaMock(store);
      const ads = {
        trackPixelEvent: jest.fn(async () => {
          throw new Error('token expired / unauthorized');
        }),
        listPixels: jest.fn(async () => []),
      };
      const { service } = createCredentialsService({ prisma, ads, encryption });

      const result = await service.testConnection(USER_A, TEAM_A, `integ_${TEAM_A}`);
      expect(result.ok).toBe(false);
      expect(result.message).toMatch(/Invalid Access Token|Permission|unavailable|token/i);
    });

    it('valid credentials pass validation and connect', async () => {
      const store = createStore();
      seedWorkspace(store, { teamId: TEAM_A, userId: USER_A, pixelCode: PIXEL_A });
      // Avoid Marketing pixel-list mismatch: clear advertiser so Events API probe is the gate.
      store.integrations.get(`integ_${TEAM_A}`)!.advertiserId = null;
      const prisma = createPrismaMock(store);
      const ads = {
        trackPixelEvent: jest.fn(async () => ({ code: 0, message: 'OK' })),
        listPixels: jest.fn(async () => []),
      };
      const { service } = createCredentialsService({ prisma, ads });

      const saved = await service.saveCredentials(USER_A, TEAM_A, `integ_${TEAM_A}`, {
        pixelCode: PIXEL_A,
        accessToken: TOKEN_A,
        pixelName: 'Valid Pixel',
      });
      expect(saved.ok).toBe(true);
      expect(saved.status).toBe('connected');

      const test = await service.testConnection(USER_A, TEAM_A, `integ_${TEAM_A}`);
      expect(test.ok).toBe(true);
    });

    it('rejects pixel not found for advertiser when Marketing list available', async () => {
      const store = createStore();
      seedWorkspace(store, { teamId: TEAM_A, userId: USER_A, pixelCode: PIXEL_A });
      const prisma = createPrismaMock(store);
      const ads = {
        trackPixelEvent: jest.fn(async () => ({ code: 0 })),
        listPixels: jest.fn(async () => [
          { pixel_id: 'other', pixel_code: 'OTHERPIXEL', pixel_name: 'Other', activity_status: 'ENABLE', raw: {} },
        ]),
      };
      const { service } = createCredentialsService({ prisma, ads });

      await expect(
        service.saveCredentials(USER_A, TEAM_A, `integ_${TEAM_A}`, {
          pixelCode: PIXEL_A,
          accessToken: TOKEN_A,
        }),
      ).rejects.toThrow(/Pixel not found|Token does not belong/i);
    });
  });

  describe('8–10. Purchase / CompleteRegistration / Lead', () => {
    it('CompleteRegistration sends once and dedupes', async () => {
      const store = createStore();
      const prisma = createPrismaMock(store);
      const ads = { trackPixelEvent: jest.fn(async () => ({ code: 0 })) };
      const { service } = createLifecycleService({ prisma, ads });

      const first = await service.sendCompleteRegistration({
        teamId: TEAM_A,
        userId: 'user_new',
        email: 'a@test.com',
      });
      expect(first).toMatchObject({ ok: true });
      expect(ads.trackPixelEvent).toHaveBeenCalledTimes(1);
      const regPayload = (ads.trackPixelEvent as jest.Mock).mock.calls[0][2] as {
        event: string;
        event_id: string;
      };
      expect(regPayload.event).toBe('CompleteRegistration');
      expect(regPayload.event_id).toBe('reg_user_new');

      // Dedup via successful api log
      const second = await service.sendCompleteRegistration({
        teamId: TEAM_A,
        userId: 'user_new',
        email: 'a@test.com',
      });
      expect(second).toMatchObject({ ok: true, deduped: true });
      expect(ads.trackPixelEvent).toHaveBeenCalledTimes(1);
    });

    it('Purchase sends once with value/currency/order_id and dedupes', async () => {
      const store = createStore();
      const prisma = createPrismaMock(store);
      const ads = { trackPixelEvent: jest.fn(async () => ({ code: 0 })) };
      const { service } = createLifecycleService({ prisma, ads });

      await service.sendPurchase({
        teamId: TEAM_A,
        paymentId: 'pay_99',
        amountCents: 19900,
        currency: 'SAR',
      });
      await service.sendPurchase({
        teamId: TEAM_A,
        paymentId: 'pay_99',
        amountCents: 19900,
        currency: 'SAR',
      });

      expect(ads.trackPixelEvent).toHaveBeenCalledTimes(1);
      const purchasePayload = (ads.trackPixelEvent as jest.Mock).mock.calls[0][2] as {
        properties: Record<string, string>;
      };
      expect(purchasePayload.properties).toEqual(
        expect.objectContaining({ value: '199.00', currency: 'SAR', order_id: 'pay_99' }),
      );
    });

    it('Lead is sent exactly once; re-qualify does not duplicate', async () => {
      const store = createStore();
      const { integration } = seedWorkspace(store, {
        teamId: TEAM_A,
        userId: USER_A,
        pixelCode: PIXEL_A,
        encryptedToken: `enc:${TOKEN_A}`,
      });
      const prisma = createPrismaMock(store);
      const ads = {
        trackPixelEvent: jest.fn(async () => ({ code: 0 })),
        registerPixelEvents: jest.fn(async () => ({})),
      };
      const { service } = createLifecycleService({
        prisma,
        ads,
        credentials: {
          getAccessTokenForIntegration: jest.fn(() => TOKEN_A),
          getPlatformCredentials: jest.fn(() => null),
        } as any,
      });

      store.conversions.set('contact_sent', {
        id: 'contact_sent',
        integrationId: integration.id,
        conversationId: 'conv-lead',
        eventName: 'Contact',
        contactSent: true,
        ttclid: 'ttclid_lead',
        contactId: 'ct1',
        whatsappPhone: '966511122233',
        clickId: null,
        leadId: null,
        externalId: 'ext',
        pageUrl: 'https://app.test/r/x',
        sentAt: new Date(),
        createdAt: new Date(),
        eventId: 'evt-c',
      });

      await service.sendLeadForConversation(TEAM_A, 'conv-lead');
      await service.sendLeadForConversation(TEAM_A, 'conv-lead');
      // "removing qualification" then re-qualify — still only one Lead row
      await service.sendLeadForConversation(TEAM_A, 'conv-lead');

      const leads = [...store.conversions.values()].filter((c) => c.eventName === 'Lead');
      expect(leads).toHaveLength(1);
      expect(ads.trackPixelEvent.mock.calls.filter((c: any[]) => c[2]?.event === 'Lead')).toHaveLength(1);
      expect(leads[0].ttclid).toBe('ttclid_lead');
    });
  });

  describe('11. Logging', () => {
    it('logs workspace/pixel/event/retry metadata without secrets', async () => {
      const store = createStore();
      const { integration } = seedWorkspace(store, {
        teamId: TEAM_A,
        userId: USER_A,
        pixelCode: PIXEL_A,
        encryptedToken: `enc:${TOKEN_A}`,
      });
      const prisma = createPrismaMock(store);
      const ads = {
        trackPixelEvent: jest.fn(async () => ({ code: 0, message: 'ok', request_id: 'req_1' })),
        registerPixelEvents: jest.fn(async () => ({})),
      };
      const { service } = createTrackingService({ prisma, ads });

      store.conversions.set('log_conv', {
        id: 'log_conv',
        integrationId: integration.id,
        conversationId: 'c-log',
        eventName: 'Contact',
        eventId: 'evt-log',
        contactSent: false,
        tiktokStatus: 'pending',
        retryCount: 0,
        ttclid: 'ttclid_present',
        firstMessageAt: new Date(),
        createdAt: new Date(),
        pageUrl: 'https://app.test/r/slug-a',
        whatsappPhone: '966511122233',
        leadId: null,
        clickId: null,
        contactId: null,
        externalId: null,
        nextRetryAt: null,
      });

      await service.dispatchContactEvent('log_conv');

      expect(store.apiLogs[0]).toEqual(
        expect.objectContaining({
          integrationId: integration.id,
          eventName: 'Contact',
          eventId: 'evt-log',
          attempt: 1,
          success: true,
        }),
      );
      expect(store.apiLogs[0].responseBody).toEqual(expect.objectContaining({ code: 0 }));
      expect(store.apiLogs[0].requestPayload.ttclid).toBe('[present]');
      expect(JSON.stringify(store.apiLogs)).not.toContain(TOKEN_A);
      expect(['Contact', 'Lead']).toContain(store.integrations.get(integration.id)!.lastEventName);
      expect(store.integrations.get(integration.id)!.teamId).toBe(TEAM_A);
      expect(store.integrations.get(integration.id)!.pixelCode).toBe(PIXEL_A);
    });
  });
});
