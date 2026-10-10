import { OfficialWhatsAppOtpService } from '../official-whatsapp.otp.service';
import { TokenHashService } from '../../security/token-hash.service';

describe('OfficialWhatsAppOtpService', () => {
  const tokens = new TokenHashService();

  function makeService(prisma: any, sender: any = { sendAuthenticationTemplate: jest.fn() }) {
    return new OfficialWhatsAppOtpService(prisma, tokens, sender, { get: () => undefined } as any);
  }

  it('rejects expired OTP', async () => {
    const prisma = {
      phoneOtpVerification: {
        findUnique: jest.fn(async () => ({
          id: 'v1',
          otpHash: tokens.hash('123456'),
          expiresAt: new Date(Date.now() - 1000),
          attempts: 0,
          maxAttempts: 5,
          verifiedAt: null,
        })),
      },
    };
    const svc = makeService(prisma);
    await expect(svc.verify('v1', '123456')).rejects.toThrow(/expired/i);
  });

  it('rejects wrong OTP and increments attempts', async () => {
    const update = jest.fn();
    const prisma = {
      phoneOtpVerification: {
        findUnique: jest.fn(async () => ({
          id: 'v1',
          otpHash: tokens.hash('123456'),
          expiresAt: new Date(Date.now() + 60_000),
          attempts: 0,
          maxAttempts: 5,
          verifiedAt: null,
        })),
        update,
      },
    };
    const svc = makeService(prisma);
    await expect(svc.verify('v1', '000000')).rejects.toThrow(/Invalid verification code/);
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ data: { attempts: 1 } }));
  });

  it('locks after max attempts', async () => {
    const prisma = {
      phoneOtpVerification: {
        findUnique: jest.fn(async () => ({
          id: 'v1',
          otpHash: tokens.hash('123456'),
          expiresAt: new Date(Date.now() + 60_000),
          attempts: 5,
          maxAttempts: 5,
          verifiedAt: null,
        })),
      },
    };
    const svc = makeService(prisma);
    await expect(svc.verify('v1', '123456')).rejects.toThrow(/Too many/);
  });

  it('accepts a valid OTP and does not store plaintext', async () => {
    const update = jest.fn();
    const userUpdate = jest.fn();
    const prisma = {
      phoneOtpVerification: {
        findUnique: jest.fn(async () => ({
          id: 'v1',
          userId: 'u1',
          phone: '964700000000',
          email: 'a@b.com',
          purpose: 'signup',
          otpHash: tokens.hash('654321'),
          expiresAt: new Date(Date.now() + 60_000),
          attempts: 0,
          maxAttempts: 5,
          verifiedAt: null,
          metadata: {},
        })),
        update,
      },
      user: { update: userUpdate },
    };
    const svc = makeService(prisma);
    const result = await svc.verify('v1', '654321');
    expect(result.phone).toBe('964700000000');
    expect(JSON.stringify(update.mock.calls)).not.toMatch(/654321/);
  });
});
