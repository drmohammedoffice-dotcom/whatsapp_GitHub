import { AiMemoryService } from './ai-memory.service';

describe('AiMemoryService', () => {
  it('encrypts memory before persistence and decrypts on read', async () => {
    const encryption = { encryptJson: jest.fn((value) => `encrypted:${value}`), decryptJson: jest.fn((value) => value.replace('encrypted:', '')) };
    const prisma = {
      aiMemory: {
        create: jest.fn().mockResolvedValue({ id: 'memory' }),
        findMany: jest.fn().mockResolvedValue([{ id: 'memory', teamId: 'team', scope: 'BUSINESS', key: 'policy', value: 'encrypted:Keep promises' }]),
      },
    };
    const service = new AiMemoryService(prisma as any, encryption as any);
    await service.upsert('team', 'user', { scope: 'BUSINESS' as any, key: 'policy', value: 'Keep promises' });
    expect(prisma.aiMemory.create).toHaveBeenCalledWith({ data: expect.objectContaining({ value: 'encrypted:Keep promises' }) });
    await expect(service.list('team')).resolves.toEqual([expect.objectContaining({ value: 'Keep promises' })]);
  });
});
