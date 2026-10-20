import { OfficialNotificationStatus, OfficialNotificationType } from '@watsapp/database';
import { OfficialWhatsAppNotificationService } from '../official-whatsapp.notifications.service';

describe('OfficialWhatsAppNotificationService idempotency', () => {
  it('does not resend when a SENT log already exists for the same day', async () => {
    const sendNamedTemplate = jest.fn();
    const prisma = {
      subscriptionNotificationLog: {
        findUnique: jest.fn(async () => ({
          id: 'log1',
          status: OfficialNotificationStatus.SENT,
        })),
        create: jest.fn(),
        update: jest.fn(),
      },
    };
    const svc = new OfficialWhatsAppNotificationService(prisma as any, { sendNamedTemplate } as any, { get: () => undefined } as any);
    const result = await svc.sendOnce({
      subscriptionId: 'sub1',
      teamId: 'team1',
      userId: 'user1',
      phone: '964700000000',
      type: OfficialNotificationType.SUBSCRIPTION_EXPIRING,
    });
    expect(result.skipped).toBe(true);
    expect(sendNamedTemplate).not.toHaveBeenCalled();
  });

  it('retries a FAILED log without creating a duplicate row', async () => {
    const sendNamedTemplate = jest.fn(async () => ({ messageId: 'wamid.1', templateName: 'expiry' }));
    const update = jest.fn();
    const prisma = {
      subscriptionNotificationLog: {
        findUnique: jest.fn(async () => ({
          id: 'log1',
          status: OfficialNotificationStatus.FAILED,
        })),
        create: jest.fn(),
        update,
      },
    };
    const svc = new OfficialWhatsAppNotificationService(prisma as any, { sendNamedTemplate } as any, { get: () => undefined } as any);
    const result = await svc.sendOnce({
      subscriptionId: 'sub1',
      teamId: 'team1',
      userId: 'user1',
      phone: '964700000000',
      type: OfficialNotificationType.SUBSCRIPTION_EXPIRED,
    });
    expect(result.skipped).toBe(false);
    expect(prisma.subscriptionNotificationLog.create).not.toHaveBeenCalled();
    expect(sendNamedTemplate).toHaveBeenCalled();
  });
});
