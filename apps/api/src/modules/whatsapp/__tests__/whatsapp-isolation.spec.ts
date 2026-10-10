import { ChannelPurpose } from '@watsapp/database';
import { WhatsAppRepository } from '../whatsapp.repository';

describe('WhatsApp Inbox vs TikTok tracking isolation', () => {
  it('lists Inbox sessions without TRACKING purpose sessions', async () => {
    const calls: any[] = [];
    const prisma = {
      whatsAppSession: {
        findMany: jest.fn(async (args: any) => {
          calls.push(args);
          return [];
        }),
      },
    };
    const repo = new WhatsAppRepository(prisma as any);
    await repo.listSessions('team-1', 'user-1');
    expect(calls[0].where.purpose).toBe(ChannelPurpose.INBOX);
    expect(calls[0].where.teamId).toBe('team-1');
  });

  it('clearPhoneForOtherSessions scopes by purpose so Inbox and Tracking can share a number', async () => {
    const updateMany = jest.fn(async () => ({ count: 0 }));
    const prisma = { whatsAppSession: { updateMany } };
    const repo = new WhatsAppRepository(prisma as any);
    await repo.clearPhoneForOtherSessions('team-1', 'sess-track', '966500000000', ChannelPurpose.TRACKING);
    expect(updateMany).toHaveBeenCalledWith({
      where: {
        teamId: 'team-1',
        phoneNumber: '966500000000',
        purpose: ChannelPurpose.TRACKING,
        id: { not: 'sess-track' },
      },
      data: { phoneNumber: null },
    });
  });
});
