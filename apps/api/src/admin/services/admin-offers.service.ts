import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AdminAuditService } from './admin-audit.service';

@Injectable()
export class AdminOffersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AdminAuditService,
  ) {}

  list() {
    return this.prisma.landingOffer.findMany({ orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }] });
  }

  create(adminUserId: string, input: {
    title: string;
    titleAr?: string;
    description?: string;
    descriptionAr?: string;
    badgeText?: string;
    badgeTextAr?: string;
    ctaLabel?: string;
    ctaLabelAr?: string;
    ctaUrl?: string;
    sortOrder?: number;
    isActive?: boolean;
    startsAt?: string | null;
    endsAt?: string | null;
  }) {
    return this.prisma.landingOffer
      .create({
        data: {
          title: input.title.trim(),
          titleAr: input.titleAr?.trim() || null,
          description: input.description?.trim() || null,
          descriptionAr: input.descriptionAr?.trim() || null,
          badgeText: input.badgeText?.trim() || null,
          badgeTextAr: input.badgeTextAr?.trim() || null,
          ctaLabel: input.ctaLabel?.trim() || null,
          ctaLabelAr: input.ctaLabelAr?.trim() || null,
          ctaUrl: input.ctaUrl?.trim() || null,
          sortOrder: input.sortOrder ?? 0,
          isActive: input.isActive ?? true,
          startsAt: input.startsAt ? new Date(input.startsAt) : null,
          endsAt: input.endsAt ? new Date(input.endsAt) : null,
        },
      })
      .then(async (offer) => {
        await this.audit.log({
          adminUserId,
          action: 'offer.create',
          resource: 'landing_offer',
          resourceId: offer.id,
        });
        return offer;
      });
  }

  async update(adminUserId: string, id: string, input: Record<string, unknown>) {
    const existing = await this.prisma.landingOffer.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Offer not found');

    const data: Record<string, unknown> = {};
    if (typeof input.title === 'string') data.title = input.title.trim();
    if (typeof input.titleAr === 'string') data.titleAr = input.titleAr.trim() || null;
    if (typeof input.description === 'string') data.description = input.description.trim() || null;
    if (typeof input.descriptionAr === 'string') data.descriptionAr = input.descriptionAr.trim() || null;
    if (typeof input.badgeText === 'string') data.badgeText = input.badgeText.trim() || null;
    if (typeof input.badgeTextAr === 'string') data.badgeTextAr = input.badgeTextAr.trim() || null;
    if (typeof input.ctaLabel === 'string') data.ctaLabel = input.ctaLabel.trim() || null;
    if (typeof input.ctaLabelAr === 'string') data.ctaLabelAr = input.ctaLabelAr.trim() || null;
    if (typeof input.ctaUrl === 'string') data.ctaUrl = input.ctaUrl.trim() || null;
    if (typeof input.sortOrder === 'number') data.sortOrder = input.sortOrder;
    if (typeof input.isActive === 'boolean') data.isActive = input.isActive;
    if (input.startsAt === null) data.startsAt = null;
    else if (typeof input.startsAt === 'string') data.startsAt = new Date(input.startsAt);
    if (input.endsAt === null) data.endsAt = null;
    else if (typeof input.endsAt === 'string') data.endsAt = new Date(input.endsAt);

    return this.prisma.landingOffer.update({ where: { id }, data: data as never }).then(async (offer) => {
      await this.audit.log({
        adminUserId,
        action: 'offer.update',
        resource: 'landing_offer',
        resourceId: id,
      });
      return offer;
    });
  }

  delete(adminUserId: string, id: string) {
    return this.prisma.landingOffer.delete({ where: { id } }).then(async (offer) => {
      await this.audit.log({
        adminUserId,
        action: 'offer.delete',
        resource: 'landing_offer',
        resourceId: id,
      });
      return offer;
    });
  }
}
