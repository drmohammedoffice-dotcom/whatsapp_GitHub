import { BadRequestException } from '@nestjs/common';
import { ProductsService } from './products.service';

describe('ProductsService.checkoutLanding', () => {
  const product = {
    id: 'prod-1',
    teamId: 'team-owner',
    name: 'فلاشة ذهبية – 12 دورة احترافية',
    description: '',
    unitPrice: 35000,
    priceCents: 35000,
    currency: 'IQD',
    quantity: 20,
    outOfStockManual: false,
    isActive: true,
    metadata: { landingKey: 'flash-12-courses', compareAtPrice: 100000, freeDelivery: true },
    images: [{ id: 'img-1' }],
  };
  const prisma = {
    storeSettings: { findUnique: jest.fn() },
    product: { findFirst: jest.fn(), update: jest.fn() },
    booking: { findFirst: jest.fn(), delete: jest.fn() },
    $transaction: jest.fn(),
  };
  const bookings = { createFromStore: jest.fn() };
  const service = new ProductsService(prisma as never, {} as never, { get: () => 'http://localhost:4000' } as never, bookings as never);

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.product.findFirst.mockResolvedValue(product);
    prisma.storeSettings.findUnique.mockResolvedValue({ teamId: 'team-owner', slug: 'office', isPublished: true, currency: 'IQD' });
    prisma.booking.findFirst.mockResolvedValue(null);
    bookings.createFromStore.mockResolvedValue({ id: 'b1', orderNumber: 'ORD-00009', totalAmount: 35000, currency: 'IQD' });
    jest.spyOn(service, 'applySale').mockResolvedValue(undefined);
  });

  it('uses database price and owner team, ignoring client price fields', async () => {
    const result = await service.checkoutLanding('flash-12-courses', {
      phone: '07701234567',
      address: 'بغداد، الكرادة، شارع فلسطين',
      name: 'علي',
      idempotencyKey: 'abc',
    });
    expect(result.price).toBe(35000);
    expect(result.total).toBe(35000);
    expect(result.delivery).toBe(0);
    expect(bookings.createFromStore).toHaveBeenCalledWith(
      'team-owner',
      expect.objectContaining({
        totalAmount: 35000,
        phoneNumber: '07701234567',
      }),
    );
    const payload = bookings.createFromStore.mock.calls[0][1];
    expect(payload.items.lines[0].unitPrice).toBe(35000);
    expect(payload.items.lines[0].originalPrice).toBe(100000);
  });

  it('rejects invalid Iraqi phones', async () => {
    await expect(
      service.checkoutLanding('flash-12-courses', { phone: '123', address: 'بغداد الكرادة شارع 1' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(bookings.createFromStore).not.toHaveBeenCalled();
  });

  it('returns the existing order for the same idempotency key', async () => {
    prisma.booking.findFirst.mockResolvedValue({ orderNumber: 'ORD-00001', totalAmount: 35000, currency: 'IQD' });
    const result = await service.checkoutLanding('flash-12-courses', {
      phone: '07701234567',
      address: 'بغداد، الكرادة، شارع 12',
      idempotencyKey: 'same',
    });
    expect(result.orderNumber).toBe('ORD-00001');
    expect(result.duplicate).toBe(true);
    expect(bookings.createFromStore).not.toHaveBeenCalled();
  });

  it('does not reuse a previous order after the flash price changes', async () => {
    prisma.booking.findFirst.mockResolvedValue({ orderNumber: 'ORD-00001', totalAmount: 35000, currency: 'IQD' });
    prisma.product.findFirst.mockResolvedValue({ ...product, unitPrice: 25000, priceCents: 25000 });
    const result = await service.checkoutLanding('flash-12-courses', {
      phone: '07701234567',
      address: 'بغداد، الكرادة، شارع 12',
      idempotencyKey: 'same',
    });
    expect(result.duplicate).toBeUndefined();
    expect(result.price).toBe(25000);
    expect(result.total).toBe(25000);
    expect(bookings.createFromStore).toHaveBeenCalled();
  });
});
