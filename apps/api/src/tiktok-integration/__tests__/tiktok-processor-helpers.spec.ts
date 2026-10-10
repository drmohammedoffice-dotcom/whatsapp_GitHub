import { TikTokContactProcessor } from '../tiktok-contact.processor';
import { TIKTOK_CONTACT_EVENT } from '../tiktok-integration.constants';
import {
  warmupEventsOnly,
  conversionEventName,
  optimizationEventApiName,
  optimizationEventProperties,
  eventsToActivate,
  activationTrackEvents,
  generateRedirectSlug,
  buildContactTrackingUrl,
  buildContactEventBuilderUrl,
} from '../tiktok-integration.constants';

describe('TikTokContactProcessor', () => {
  it('routes Contact jobs to tracking.dispatchContactEvent', async () => {
    const tracking = { dispatchContactEvent: jest.fn(async () => null) };
    const lifecycle = { dispatchLifecycleEvent: jest.fn(async () => null) };
    const prisma = {
      tikTokIntegrationConversion: {
        findUnique: jest.fn(async () => ({ eventName: TIKTOK_CONTACT_EVENT })),
      },
    };
    const processor = new TikTokContactProcessor(tracking as any, lifecycle as any, prisma as any);
    await processor.process({ data: { conversionId: 'c1' } } as any);
    expect(tracking.dispatchContactEvent).toHaveBeenCalledWith('c1');
    expect(lifecycle.dispatchLifecycleEvent).not.toHaveBeenCalled();
  });

  it('routes Lead/Purchase jobs to lifecycle.dispatchLifecycleEvent', async () => {
    const tracking = { dispatchContactEvent: jest.fn(async () => null) };
    const lifecycle = { dispatchLifecycleEvent: jest.fn(async () => null) };
    const prisma = {
      tikTokIntegrationConversion: {
        findUnique: jest.fn(async () => ({ eventName: 'Lead' })),
      },
    };
    const processor = new TikTokContactProcessor(tracking as any, lifecycle as any, prisma as any);
    await processor.process({ data: { conversionId: 'c2' } } as any);
    expect(lifecycle.dispatchLifecycleEvent).toHaveBeenCalledWith('c2');
  });

  it('no-ops when conversion row is missing', async () => {
    const tracking = { dispatchContactEvent: jest.fn() };
    const lifecycle = { dispatchLifecycleEvent: jest.fn() };
    const prisma = {
      tikTokIntegrationConversion: { findUnique: jest.fn(async () => null) },
    };
    const processor = new TikTokContactProcessor(tracking as any, lifecycle as any, prisma as any);
    await processor.process({ data: { conversionId: 'missing' } } as any);
    expect(tracking.dispatchContactEvent).not.toHaveBeenCalled();
  });
});

describe('optimization helpers', () => {
  it('warmup and activation never include Contact', () => {
    expect(warmupEventsOnly()).toEqual(['PageView']);
    expect(activationTrackEvents()).toEqual(['PageView']);
  });

  it('maps Purchase optimization to CompletePayment API name', () => {
    expect(optimizationEventApiName('Purchase')).toBe('CompletePayment');
    expect(optimizationEventApiName('Custom', 'MyEvent')).toBe('MyEvent');
    expect(conversionEventName({ defaultOptimizationEvent: 'Contact' })).toBe('Contact');
    expect(optimizationEventProperties('CompletePayment')).toEqual({ value: '1', currency: 'USD' });
    expect(optimizationEventProperties('Contact')).toBeUndefined();
  });

  it('eventsToActivate includes PageView + conversion', () => {
    const events = eventsToActivate({
      defaultOptimizationEvent: 'Contact',
      eventConfigurations: [
        { eventName: 'Lead', enabled: true },
        { eventName: 'ViewContent', enabled: true },
      ],
    });
    expect(events).toContain('PageView');
    expect(events).toContain('Contact');
    expect(events).toContain('Lead');
    expect(events).not.toContain('ViewContent');
  });

  it('generates redirect slug and deprecated URL helpers', () => {
    expect(generateRedirectSlug().length).toBeGreaterThanOrEqual(6);
    expect(buildContactTrackingUrl('https://x.test', 'abc')).toContain('/r/abc');
    expect(buildContactEventBuilderUrl('https://x.test', 'abc')).toContain('setup=1');
  });
});
