import { Injectable } from '@nestjs/common';
import { Prisma } from '@watsapp/database';
import { PrismaService } from '../prisma/prisma.service';

export type LandingVisibility = Record<string, boolean>;

export const DEFAULT_LANDING_VISIBILITY: LandingVisibility = {
  problems: true,
  features: true,
  tiktok: true,
  how: true,
  video: true,
  testimonials: true,
  stats: true,
  trial: true,
  pricing: true,
  faq: true,
  contact: true,
};

@Injectable()
export class LandingPageService {
  constructor(private readonly prisma: PrismaService) {}

  async getPublic() {
    const row = await this.prisma.landingPageConfig.findUnique({ where: { id: 'default' } });
    if (!row) {
      return {
        contentEn: null,
        contentAr: null,
        visibility: DEFAULT_LANDING_VISIBILITY,
        updatedAt: null,
      };
    }
    return {
      contentEn: row.contentEn,
      contentAr: row.contentAr,
      visibility: this.normalizeVisibility(row.visibility),
      updatedAt: row.updatedAt,
    };
  }

  async getAdmin() {
    return this.getPublic();
  }

  async save(
    adminUserId: string,
    input: {
      contentEn?: unknown;
      contentAr?: unknown;
      visibility?: LandingVisibility;
    },
  ) {
    const existing = await this.prisma.landingPageConfig.findUnique({ where: { id: 'default' } });
    const contentEn = (input.contentEn ?? existing?.contentEn ?? {}) as Prisma.InputJsonValue;
    const contentAr = (input.contentAr ?? existing?.contentAr ?? {}) as Prisma.InputJsonValue;
    const visibility = this.normalizeVisibility(
      input.visibility ?? (existing?.visibility as LandingVisibility | null) ?? DEFAULT_LANDING_VISIBILITY,
    ) as Prisma.InputJsonValue;

    const row = await this.prisma.landingPageConfig.upsert({
      where: { id: 'default' },
      create: {
        id: 'default',
        contentEn,
        contentAr,
        visibility,
        updatedById: adminUserId,
      },
      update: {
        contentEn,
        contentAr,
        visibility,
        updatedById: adminUserId,
      },
    });

    return {
      contentEn: row.contentEn,
      contentAr: row.contentAr,
      visibility: this.normalizeVisibility(row.visibility),
      updatedAt: row.updatedAt,
    };
  }

  async reset(adminUserId: string) {
    await this.prisma.landingPageConfig.deleteMany({ where: { id: 'default' } });
    return {
      contentEn: null,
      contentAr: null,
      visibility: DEFAULT_LANDING_VISIBILITY,
      updatedAt: null,
      resetBy: adminUserId,
    };
  }

  private normalizeVisibility(raw: unknown): LandingVisibility {
    const base = { ...DEFAULT_LANDING_VISIBILITY };
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return base;
    for (const key of Object.keys(base)) {
      const value = (raw as Record<string, unknown>)[key];
      if (typeof value === 'boolean') base[key] = value;
    }
    return base;
  }
}
