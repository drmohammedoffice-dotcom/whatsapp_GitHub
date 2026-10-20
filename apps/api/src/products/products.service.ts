import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
  forwardRef,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ProductMediaKind, Prisma } from '@watsapp/database';
import { createReadStream } from 'fs';
import { stat } from 'fs/promises';
import { PlanEntitlementsService } from '../billing/plan-entitlements.service';
import { PrismaService } from '../prisma/prisma.service';
import { LocalStorageService } from '../storage/local-storage.service';
import { UploadedMediaFile } from '../common/uploaded-media-file';
import { BookingsService } from '../bookings/bookings.service';
import { TikTokIntegrationTrackingService } from '../tiktok-integration/tiktok-integration-tracking.service';
import { LandingCheckoutDto, ProductDto, StoreCategoryDto, StoreCheckoutDto, StoreThemeDto, UpdateProductDto, UpdateStoreSettingsDto } from './dto/store.dto';
import {
  FLASH_LANDING_KEY,
  FLASH_LANDING_SKU,
  IBRAQ_MUSK_LANDING_KEY,
  IBRAQ_PACK_PRICE_1,
  isSupportedLandingKey,
  landingSkuForKey,
  parseLandingMeta,
  landingSalePrice,
  normalizeIraqiMobile,
  resolveIbraqPackPricing,
  rollPromoEndsAt,
  sanitizeCustomerName,
  sanitizeMetaPixelId,
  validateOrderAddress,
} from './landing.util';
import { sanitizeLandingCopy } from './landing-copy.util';
import { parseThemeColors, resolveStoreTheme, STORE_THEME_PRESETS } from './store-themes';
import {
  parseIqdAmount,
  displayPrice,
  isProductInStock,
  IQ_GOVERNORATES,
  normalizeGiftPhone,
  parseDeliveryRates,
  resolveDeliveryFee,
  slugifyBrand,
} from './store.util';

export type StoreSaleLine = { productId: string; quantity: number; name?: string };

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: LocalStorageService,
    private readonly config: ConfigService,
    private readonly bookings: BookingsService,
    private readonly entitlements: PlanEntitlementsService,
    @Optional()
    @Inject(forwardRef(() => TikTokIntegrationTrackingService))
    private readonly tiktokTracking?: TikTokIntegrationTrackingService,
  ) {}

  async ensureSettings(teamId: string) {
    const existing = await this.prisma.storeSettings.findUnique({ where: { teamId } });
    if (existing) return this.withStoreUrl(existing);
    const team = await this.prisma.team.findUnique({ where: { id: teamId }, select: { name: true, slug: true } });
    const brandName = team?.name?.trim() || 'متجري';
    try {
      const created = await this.prisma.storeSettings.create({
        data: {
          teamId,
          slug: slugifyBrand(team?.slug || brandName),
          brandName,
          currency: 'IQD',
          defaultLocale: 'ar',
        },
      });
      return this.withStoreUrl(created);
    } catch (error) {
      if ((error as { code?: string }).code === 'P2002') {
        const again = await this.prisma.storeSettings.findUnique({ where: { teamId } });
        if (again) return this.withStoreUrl(again);
      }
      throw error;
    }
  }

  async updateSettings(teamId: string, dto: UpdateStoreSettingsDto) {
    await this.entitlements.assertOnlineStoreEnabled(teamId);
    await this.ensureSettings(teamId);
    const updated = await this.prisma.storeSettings.update({
      where: { teamId },
      data: {
        ...(dto.brandName !== undefined ? { brandName: dto.brandName.trim() || 'متجري' } : {}),
        ...(dto.deliveryMode ? { deliveryMode: dto.deliveryMode } : {}),
        ...(dto.deliveryFee !== undefined ? { deliveryFee: Number(dto.deliveryFee) || 0 } : {}),
        ...(dto.deliveryRates !== undefined ? { deliveryRates: parseDeliveryRates(dto.deliveryRates) } : {}),
        ...(dto.giftWhatsappPhone !== undefined
          ? { giftWhatsappPhone: normalizeGiftPhone(dto.giftWhatsappPhone) || null }
          : {}),
        ...(dto.defaultLocale ? { defaultLocale: dto.defaultLocale } : {}),
        ...(dto.currency?.trim() ? { currency: dto.currency.trim().toUpperCase() } : {}),
        ...(dto.isPublished !== undefined ? { isPublished: dto.isPublished } : {}),
        ...(dto.promoEnabled !== undefined ? { promoEnabled: dto.promoEnabled } : {}),
        ...(dto.promoEndsAt !== undefined
          ? { promoEndsAt: dto.promoEndsAt ? new Date(dto.promoEndsAt) : null }
          : {}),
        ...(dto.promoText !== undefined ? { promoText: dto.promoText?.trim() || null } : {}),
        ...(dto.themeKey
          ? {
              themeKey: dto.themeKey,
              themeColors: (dto.themeColors ? parseThemeColors(dto.themeColors) : resolveStoreTheme(dto.themeKey)) as Prisma.InputJsonValue,
            }
          : {}),
        ...(dto.themeColors !== undefined && !dto.themeKey && parseThemeColors(dto.themeColors)
          ? { themeColors: parseThemeColors(dto.themeColors) as Prisma.InputJsonValue }
          : {}),
      },
    });
    return this.withStoreUrl(updated);
  }

  async uploadLogo(teamId: string, file: UploadedMediaFile) {
    if (!file?.buffer?.length) throw new BadRequestException('Logo file is required');
    if (!file.mimetype.startsWith('image/')) throw new BadRequestException('Logo must be an image');
    const settings = await this.ensureSettings(teamId);
    if (settings.logoStorageKey) await this.storage.remove(settings.logoStorageKey);
    const stored = await this.storage.putMedia(teamId, file);
    const updated = await this.prisma.storeSettings.update({
      where: { teamId },
      data: { logoStorageKey: stored.storageKey, logoMimeType: file.mimetype },
    });
    return this.withStoreUrl(updated);
  }

  list(teamId: string, query?: string, stock?: 'in' | 'out' | 'all', categoryId?: string) {
    const q = query?.trim();
    return this.prisma.product.findMany({
      where: {
        teamId,
        ...(categoryId ? { categoryId } : {}),
        ...(q
          ? {
              OR: [
                { name: { contains: q, mode: 'insensitive' } },
                { description: { contains: q, mode: 'insensitive' } },
                { sku: { contains: q, mode: 'insensitive' } },
                { category: { contains: q, mode: 'insensitive' } },
              ],
            }
          : {}),
        ...(stock === 'in' ? { outOfStockManual: false, quantity: { gt: 0 } } : {}),
        ...(stock === 'out' ? { OR: [{ outOfStockManual: true }, { quantity: { lte: 0 } }] } : {}),
      },
      include: { images: { orderBy: { position: 'asc' } }, storeCategory: true },
      orderBy: [{ position: 'asc' }, { createdAt: 'desc' }],
    });
  }

  async get(teamId: string, id: string, bumpViews = false) {
    const product = await this.prisma.product.findFirst({
      where: { id, teamId },
      include: { images: { orderBy: { position: 'asc' } }, storeCategory: true },
    });
    if (!product) throw new NotFoundException('Product not found');
    if (bumpViews) {
    await this.prisma.product.update({ where: { id }, data: { viewCount: { increment: 1 } } });
    }
    return product;
  }

  private normalizeColorHex(raw: unknown): string {
    let hex = String(raw || '#000000').trim();
    if (!/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(hex)) hex = '#000000';
    if (hex.length === 4) {
      hex = `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`;
    }
    return hex.toLowerCase();
  }

  private stableColorId(name: string, hex: string, fallbackIndex: number) {
    const slug = name
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40);
    return `c_${slug || fallbackIndex}_${hex.replace('#', '')}`.slice(0, 64);
  }

  private sanitizeProductColors(raw: unknown): Array<{
    id: string;
    name: string;
    hex: string;
    imageId: string | null;
  }> {
    if (!Array.isArray(raw)) return [];
    const out: Array<{ id: string; name: string; hex: string; imageId: string | null }> = [];
    for (const item of raw.slice(0, 24)) {
      if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
      const row = item as Record<string, unknown>;
      const name = String(row.name || '').trim().slice(0, 60);
      if (!name) continue;
      const hex = this.normalizeColorHex(row.hex);
      const imageId = String(row.imageId || '').trim() || null;
      const id = String(row.id || '').trim() || this.stableColorId(name, hex, out.length + 1);
      out.push({ id: id.slice(0, 64), name, hex, imageId });
    }
    return out;
  }

  private sanitizePaletteColors(raw: unknown): Array<{ id: string; name: string; hex: string }> {
    return this.sanitizeProductColors(raw).map(({ id, name, hex }) => ({ id, name, hex }));
  }

  async getColorPalette(teamId: string) {
    const settings = await this.ensureSettings(teamId);
    return {
      colors: this.sanitizePaletteColors(settings.productColorPalette),
    };
  }

  async saveColorPalette(teamId: string, colors: unknown) {
    await this.entitlements.assertOnlineStoreEnabled(teamId);
    await this.ensureSettings(teamId);
    const palette = this.sanitizePaletteColors(colors);
    const updated = await this.prisma.storeSettings.update({
      where: { teamId },
      data: { productColorPalette: palette as Prisma.InputJsonValue },
    });
    return {
      colors: this.sanitizePaletteColors(updated.productColorPalette),
    };
  }

  async applyColorsToProducts(
    teamId: string,
    input: {
      colors?: unknown;
      productIds?: string[];
      all?: boolean;
      linkImagesByPosition?: boolean;
      saveAsStorePalette?: boolean;
    },
  ) {
    await this.entitlements.assertOnlineStoreEnabled(teamId);
    await this.ensureSettings(teamId);

    let palette = this.sanitizePaletteColors(input.colors);
    if (!palette.length) {
      const saved = await this.getColorPalette(teamId);
      palette = saved.colors;
    }
    if (!palette.length) {
      throw new BadRequestException('أضف لوناً واحداً على الأقل قبل التطبيق');
    }

    if (input.saveAsStorePalette !== false) {
      await this.prisma.storeSettings.update({
        where: { teamId },
        data: { productColorPalette: palette as Prisma.InputJsonValue },
      });
    }

    const linkByPosition = input.linkImagesByPosition !== false;
    const where = input.all
      ? { teamId }
      : {
          teamId,
          id: { in: [...new Set((input.productIds || []).map((id) => String(id).trim()).filter(Boolean))] },
        };
    if (!input.all && !(where as { id?: { in: string[] } }).id?.in.length) {
      throw new BadRequestException('اختر منتجات للتطبيق عليها، أو طبّق على الكل');
    }

    const products = await this.prisma.product.findMany({
      where,
      include: { images: { orderBy: { position: 'asc' } } },
    });
    if (!products.length) {
      throw new BadRequestException('لا توجد منتجات مطابقة');
    }

    let updatedCount = 0;
    for (const product of products) {
      const imageOnly = product.images.filter((m) => m.kind === 'IMAGE');
      const colors = palette.map((swatch, index) => ({
        id: swatch.id,
        name: swatch.name,
        hex: swatch.hex,
        imageId: linkByPosition && imageOnly[index] ? imageOnly[index]!.id : null,
      }));
      const prevMeta =
        product.metadata && typeof product.metadata === 'object' && !Array.isArray(product.metadata)
          ? { ...(product.metadata as Record<string, unknown>) }
          : {};
      await this.prisma.product.update({
        where: { id: product.id },
        data: {
          metadata: {
            ...prevMeta,
            colors,
          } as Prisma.InputJsonValue,
        },
      });
      updatedCount += 1;
    }

    return {
      updatedCount,
      colors: palette,
      linkImagesByPosition: linkByPosition,
    };
  }

  private sanitizeProductMetadata(raw?: object): Prisma.InputJsonValue | undefined {
    if (raw === undefined) return undefined;
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return raw as Prisma.InputJsonValue;
    const rec = { ...(raw as Record<string, unknown>) };
    if ('metaPixelId' in rec) rec.metaPixelId = sanitizeMetaPixelId(rec.metaPixelId);
    if ('landingCopy' in rec) rec.landingCopy = sanitizeLandingCopy(rec.landingCopy) ?? null;
    if ('salePrice' in rec) rec.salePrice = parseIqdAmount(rec.salePrice);
    if ('imageObjectFit' in rec) {
      rec.imageObjectFit = rec.imageObjectFit === 'contain' ? 'contain' : 'cover';
    }
    if ('imageObjectPosition' in rec) {
      const pos = String(rec.imageObjectPosition ?? 'center').trim().slice(0, 40);
      rec.imageObjectPosition = pos || 'center';
    }
    if ('imageZoom' in rec) {
      const z = Number(rec.imageZoom);
      // 50–200%: تصغير/تكبير داخل إطار البطاقة دون تغيير حجم الأيقونة الخارجية
      rec.imageZoom = Number.isFinite(z) ? Math.min(200, Math.max(50, Math.round(z))) : 100;
    }
    if ('hideQuantity' in rec) {
      rec.hideQuantity = Boolean(rec.hideQuantity);
    }
    if ('minOrderQuantity' in rec) {
      const min = Math.floor(Number(rec.minOrderQuantity) || 1);
      rec.minOrderQuantity = Number.isFinite(min) ? Math.min(9999, Math.max(1, min)) : 1;
    }
    if ('colors' in rec) {
      rec.colors = this.sanitizeProductColors(rec.colors);
    }
    return rec as Prisma.InputJsonValue;
  }

  async create(teamId: string, data: ProductDto) {
    await this.entitlements.assertOnlineStoreEnabled(teamId);
    const unitPrice = this.resolveUnitPrice(data);
    const last = await this.prisma.product.findFirst({ where: { teamId }, orderBy: { position: 'desc' } });
    return this.prisma.product.create({
      data: {
        teamId,
        name: data.name.trim(),
        sku: data.sku?.trim() || null,
        description: data.description?.trim() || null,
        unitPrice,
        priceCents: Math.round(unitPrice),
        currency: data.currency?.trim() || 'IQD',
        category: data.category?.trim() || null,
        categoryId: data.categoryId?.trim() || null,
        quantity: Math.max(0, Math.floor(Number(data.quantity) || 0)),
        outOfStockManual: Boolean(data.outOfStockManual),
        isActive: data.isActive !== false,
        position: (last?.position ?? -1) + 1,
        metadata: this.sanitizeProductMetadata(data.metadata),
      },
      include: { images: true },
    });
  }

  async duplicate(teamId: string, id: string) {
    const source = await this.get(teamId, id);
    const last = await this.prisma.product.findFirst({ where: { teamId }, orderBy: { position: 'desc' } });
    const copyName = source.name.includes('نسخة') ? `${source.name} 2` : `${source.name} نسخة`;
    const created = await this.prisma.product.create({
      data: {
        teamId,
        name: copyName,
        sku: source.sku ? `${source.sku}-copy` : null,
        description: source.description,
        unitPrice: source.unitPrice,
        priceCents: source.priceCents,
        currency: source.currency,
        category: source.category,
        categoryId: source.categoryId,
        quantity: source.quantity,
        outOfStockManual: source.outOfStockManual,
        isActive: source.isActive,
        position: (last?.position ?? source.position) + 1,
        metadata: source.metadata as Prisma.InputJsonValue | undefined,
      },
      include: { images: { orderBy: { position: 'asc' } }, storeCategory: true },
    });
    for (const image of source.images) {
      try {
        const copied = await this.cloneMediaFile(
          teamId,
          image.storageKey,
          image.mimeType || 'application/octet-stream',
          image.fileName || undefined,
        );
        await this.prisma.productImage.create({
          data: {
            productId: created.id,
            storageKey: copied.storageKey,
            url: image.url,
            altText: image.altText,
            kind: image.kind,
            mimeType: image.mimeType,
            fileName: image.fileName,
            position: image.position,
          },
        });
      } catch {
        /* skip broken media; product copy still succeeds */
      }
    }
    return this.get(teamId, created.id);
  }

  private async cloneMediaFile(teamId: string, storageKey: string, mimeType: string, fileName?: string) {
    const buffer = await this.storage.readBuffer(storageKey);
    return this.storage.putBuffer(teamId, buffer, mimeType, fileName || storageKey.split('/').pop() || 'media.bin');
  }

  async reorderProducts(teamId: string, ids: string[]) {
    const unique = [...new Set(ids.map((id) => id.trim()).filter(Boolean))];
    if (!unique.length) throw new BadRequestException('No product ids');
    const rows = await this.prisma.product.findMany({ where: { teamId, id: { in: unique } }, select: { id: true } });
    if (rows.length !== unique.length) throw new BadRequestException('Invalid product ids');
    await this.prisma.$transaction(
      unique.map((id, index) => this.prisma.product.update({ where: { id }, data: { position: index } })),
    );
    return this.list(teamId);
  }

  async reorderCategories(teamId: string, ids: string[]) {
    const unique = [...new Set(ids.map((id) => id.trim()).filter(Boolean))];
    if (!unique.length) throw new BadRequestException('No category ids');
    const rows = await this.prisma.storeCategory.findMany({ where: { teamId, id: { in: unique } }, select: { id: true } });
    if (rows.length !== unique.length) throw new BadRequestException('Invalid category ids');
    await this.prisma.$transaction(
      unique.map((id, index) => this.prisma.storeCategory.update({ where: { id }, data: { position: index } })),
    );
    return this.listCategories(teamId);
  }

  async duplicateCategory(teamId: string, id: string) {
    const row = await this.prisma.storeCategory.findFirst({ where: { id, teamId } });
    if (!row) throw new NotFoundException('Category not found');
    const last = await this.prisma.storeCategory.findFirst({ where: { teamId }, orderBy: { position: 'desc' } });
    const name = row.name.includes('نسخة') ? `${row.name} 2` : `${row.name} نسخة`;
    const created = await this.prisma.storeCategory.create({
      data: {
        teamId,
        name,
        position: (last?.position ?? row.position) + 1,
        imageStorageKey: null,
        imageMimeType: null,
      },
      include: { _count: { select: { products: true } } },
    });
    if (row.imageStorageKey) {
      try {
        const copied = await this.cloneMediaFile(
          teamId,
          row.imageStorageKey,
          row.imageMimeType || 'image/jpeg',
          'category.jpg',
        );
        return this.prisma.storeCategory.update({
          where: { id: created.id },
          data: { imageStorageKey: copied.storageKey, imageMimeType: row.imageMimeType },
          include: { _count: { select: { products: true } } },
        });
      } catch {
        /* keep without image */
      }
    }
    return created;
  }

  async update(teamId: string, id: string, data: UpdateProductDto) {
    const existing = await this.get(teamId, id);
    const nextQty =
      data.quantity === undefined ? existing.quantity : Math.max(0, Math.floor(Number(data.quantity) || 0));
    const existingMeta =
      existing.metadata && typeof existing.metadata === 'object' && !Array.isArray(existing.metadata)
        ? { ...(existing.metadata as Record<string, unknown>) }
        : {};
    let nextMeta: Record<string, unknown> | undefined;
    if (data.metadata !== undefined) {
      const incoming = this.sanitizeProductMetadata(data.metadata);
      const rec =
        incoming && typeof incoming === 'object' && !Array.isArray(incoming)
          ? (incoming as Record<string, unknown>)
          : {};
      nextMeta = { ...existingMeta, ...rec };
    }
    const fromBody = data.unitPrice !== undefined || data.priceCents !== undefined ? this.resolveUnitPrice(data) : 0;
    const fromMeta = parseIqdAmount(nextMeta?.salePrice);
    const sale = fromBody > 0 ? fromBody : fromMeta;
    if (sale) nextMeta = { ...(nextMeta ?? existingMeta), salePrice: sale };
    const updated = await this.prisma.product.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name.trim() } : {}),
        ...(data.sku !== undefined ? { sku: data.sku.trim() || null } : {}),
        ...(data.description !== undefined ? { description: data.description.trim() || null } : {}),
        ...(sale ? { unitPrice: sale, priceCents: Math.round(sale) } : {}),
        ...(data.currency?.trim() ? { currency: data.currency.trim() } : {}),
        ...(data.category !== undefined ? { category: data.category.trim() || null } : {}),
        ...(data.categoryId !== undefined ? { categoryId: data.categoryId?.trim() || null } : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
        ...(data.outOfStockManual !== undefined ? { outOfStockManual: data.outOfStockManual } : {}),
        ...(data.quantity !== undefined ? { quantity: nextQty } : {}),
        ...(nextMeta ? { metadata: nextMeta as Prisma.InputJsonValue } : {}),
      },
      include: { images: { orderBy: { position: 'asc' } }, storeCategory: true },
    });

    if (data.quantity !== undefined && nextQty !== existing.quantity) {
      await this.prisma.productStockMovement.create({
        data: {
          teamId,
          productId: id,
          delta: nextQty - existing.quantity,
          quantityAfter: nextQty,
          reason: 'ADJUSTMENT',
          note: 'Merchant quantity edit',
        },
      });
    }
    return updated;
  }

  async delete(teamId: string, id: string) {
    const product = await this.get(teamId, id);
    for (const image of product.images) {
      await this.storage.remove(image.storageKey);
    }
    return this.prisma.product.delete({ where: { id } });
  }

  async addMedia(teamId: string, productId: string, file: UploadedMediaFile) {
    await this.get(teamId, productId);
    if (!file?.buffer?.length) throw new BadRequestException('Media file is required');
    const kind = file.mimetype.startsWith('video/') ? ProductMediaKind.VIDEO : ProductMediaKind.IMAGE;
    if (kind === ProductMediaKind.IMAGE && !file.mimetype.startsWith('image/')) {
      throw new BadRequestException('Only images and videos are allowed');
    }
    const stored = await this.storage.putMedia(teamId, file);
    const last = await this.prisma.productImage.findFirst({
      where: { productId },
      orderBy: { position: 'desc' },
    });
    return this.prisma.productImage.create({
      data: {
        productId,
        storageKey: stored.storageKey,
        kind,
        mimeType: file.mimetype,
        fileName: file.originalname,
        position: (last?.position ?? -1) + 1,
      },
    });
  }

  async removeMedia(teamId: string, productId: string, mediaId: string) {
    await this.get(teamId, productId);
    const media = await this.prisma.productImage.findFirst({ where: { id: mediaId, productId } });
    if (!media) throw new NotFoundException('Media not found');
    await this.storage.remove(media.storageKey);
    await this.prisma.productImage.delete({ where: { id: mediaId } });
    return { ok: true };
  }

  async openMedia(teamId: string, mediaId: string) {
    const media = await this.prisma.productImage.findFirst({
      where: { id: mediaId, product: { teamId } },
    });
    if (!media) throw new NotFoundException('Media not found');
    return this.openStorage(media.storageKey, media.mimeType || 'application/octet-stream', media.fileName);
  }

  async stockMovements(teamId: string, productId?: string) {
    return this.prisma.productStockMovement.findMany({
      where: { teamId, ...(productId ? { productId } : {}) },
      include: { product: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  listCategories(teamId: string) {
    return this.prisma.storeCategory.findMany({
      where: { teamId },
      include: { _count: { select: { products: true } } },
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async createCategory(teamId: string, dto: StoreCategoryDto) {
    const name = dto.name?.trim();
    if (!name) throw new BadRequestException('Category name is required');
    const last = await this.prisma.storeCategory.findFirst({ where: { teamId }, orderBy: { position: 'desc' } });
    return this.prisma.storeCategory.create({
      data: {
        teamId,
        name,
        position: dto.position ?? (last?.position ?? -1) + 1,
        isActive: dto.isActive !== false,
      },
      include: { _count: { select: { products: true } } },
    });
  }

  async updateCategory(teamId: string, id: string, dto: StoreCategoryDto) {
    const row = await this.prisma.storeCategory.findFirst({ where: { id, teamId } });
    if (!row) throw new NotFoundException('Category not found');
    const name = dto.name?.trim();
    return this.prisma.storeCategory.update({
      where: { id },
      data: {
        ...(name ? { name } : {}),
        ...(dto.position !== undefined ? { position: dto.position } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
      include: { _count: { select: { products: true } } },
    });
  }

  async uploadCategoryImage(teamId: string, id: string, file: UploadedMediaFile) {
    const row = await this.prisma.storeCategory.findFirst({ where: { id, teamId } });
    if (!row) throw new NotFoundException('Category not found');
    if (!file?.buffer?.length || !file.mimetype.startsWith('image/')) {
      throw new BadRequestException('Category image is required');
    }
    if (row.imageStorageKey) await this.storage.remove(row.imageStorageKey);
    const stored = await this.storage.putMedia(teamId, file);
    return this.prisma.storeCategory.update({
      where: { id },
      data: { imageStorageKey: stored.storageKey, imageMimeType: file.mimetype },
      include: { _count: { select: { products: true } } },
    });
  }

  async deleteCategory(teamId: string, id: string) {
    const row = await this.prisma.storeCategory.findFirst({ where: { id, teamId } });
    if (!row) throw new NotFoundException('Category not found');
    await this.prisma.product.updateMany({ where: { teamId, categoryId: id }, data: { categoryId: null } });
    if (row.imageStorageKey) await this.storage.remove(row.imageStorageKey);
    await this.prisma.storeCategory.delete({ where: { id } });
    return { ok: true };
  }

  async openCategoryImage(teamId: string, id: string) {
    const row = await this.prisma.storeCategory.findFirst({ where: { id, teamId } });
    if (!row?.imageStorageKey) throw new NotFoundException('Category image not found');
    return this.openStorage(row.imageStorageKey, row.imageMimeType || 'image/png', 'category');
  }

  listThemes(teamId: string) {
    return this.prisma.storeTheme.findMany({ where: { teamId }, orderBy: { createdAt: 'desc' } });
  }

  createTheme(teamId: string, dto: StoreThemeDto) {
    const colors = parseThemeColors(dto.colors);
    if (!colors) throw new BadRequestException('Invalid theme colors');
    return this.prisma.storeTheme.create({ data: { teamId, name: dto.name.trim(), colors: colors as Prisma.InputJsonValue } });
  }

  async deleteTheme(teamId: string, id: string) {
    const row = await this.prisma.storeTheme.findFirst({ where: { id, teamId } });
    if (!row) throw new NotFoundException('Theme not found');
    await this.prisma.storeTheme.delete({ where: { id } });
    return { ok: true };
  }

  async applyTheme(
    teamId: string,
    input: { themeKey?: string; customThemeId?: string; colors?: Record<string, string> },
  ) {
    await this.ensureSettings(teamId);
    let themeKey = input.themeKey?.trim() || 'emerald';
    let colors = resolveStoreTheme(themeKey);
    if (input.customThemeId) {
      const custom = await this.prisma.storeTheme.findFirst({ where: { id: input.customThemeId, teamId } });
      if (!custom) throw new NotFoundException('Theme not found');
      themeKey = `custom:${custom.id}`;
      colors = parseThemeColors(custom.colors) ?? colors;
    } else if (input.colors) {
      colors = parseThemeColors(input.colors) ?? colors;
      themeKey = input.themeKey?.trim() || 'custom';
    }
    const updated = await this.prisma.storeSettings.update({
      where: { teamId },
      data: { themeKey, themeColors: colors as Prisma.InputJsonValue },
    });
    return this.withStoreUrl(updated);
  }

  private sanitizeBannerImageMeta(input?: {
    imageObjectFit?: string;
    imageObjectPosition?: string;
    imageZoom?: number | string;
    metadata?: unknown;
  }): Prisma.InputJsonValue | undefined {
    const base =
      input?.metadata && typeof input.metadata === 'object' && !Array.isArray(input.metadata)
        ? { ...(input.metadata as Record<string, unknown>) }
        : {};
    if (input?.imageObjectFit !== undefined) {
      base.imageObjectFit = input.imageObjectFit === 'contain' ? 'contain' : 'cover';
    }
    if (input?.imageObjectPosition !== undefined) {
      const pos = String(input.imageObjectPosition ?? 'center').trim().slice(0, 40);
      base.imageObjectPosition = pos || 'center';
    }
    if (input?.imageZoom !== undefined) {
      const z = Number(input.imageZoom);
      base.imageZoom = Number.isFinite(z) ? Math.min(200, Math.max(50, Math.round(z))) : 100;
    }
    return Object.keys(base).length ? (base as Prisma.InputJsonValue) : undefined;
  }

  private readBannerImageMeta(metadata: unknown) {
    const raw =
      metadata && typeof metadata === 'object' && !Array.isArray(metadata)
        ? (metadata as Record<string, unknown>)
        : {};
    const zoomRaw = Number(raw.imageZoom);
    return {
      imageObjectFit: (raw.imageObjectFit === 'contain' ? 'contain' : 'cover') as 'cover' | 'contain',
      imageObjectPosition:
        typeof raw.imageObjectPosition === 'string' && raw.imageObjectPosition.trim()
          ? raw.imageObjectPosition.trim().slice(0, 40)
          : 'center',
      imageZoom: Number.isFinite(zoomRaw) ? Math.min(200, Math.max(50, Math.round(zoomRaw))) : 100,
    };
  }

  listBanners(teamId: string) {
    return this.prisma.storeBanner.findMany({ where: { teamId }, orderBy: [{ position: 'asc' }, { createdAt: 'asc' }] });
  }

  async createBanner(
    teamId: string,
    file: UploadedMediaFile,
    meta?: {
      title?: string;
      subtitle?: string;
      linkUrl?: string;
      imageObjectFit?: string;
      imageObjectPosition?: string;
      imageZoom?: number | string;
    },
  ) {
    if (!file?.buffer?.length || !file.mimetype.startsWith('image/')) {
      throw new BadRequestException('Banner image is required');
    }
    await this.ensureSettings(teamId);
    const count = await this.prisma.storeBanner.count({ where: { teamId } });
    const stored = await this.storage.putMedia(teamId, file);
    const metadata = this.sanitizeBannerImageMeta(meta) ?? {
      imageObjectFit: 'cover',
      imageObjectPosition: 'center',
      imageZoom: 100,
    };
    return this.prisma.storeBanner.create({
      data: {
        teamId,
        storageKey: stored.storageKey,
        mimeType: file.mimetype,
        title: meta?.title?.trim() || null,
        subtitle: meta?.subtitle?.trim() || null,
        linkUrl: meta?.linkUrl?.trim() || null,
        metadata,
        position: count,
        enabled: true,
      },
    });
  }

  async updateBanner(
    teamId: string,
    id: string,
    dto: {
      title?: string;
      subtitle?: string;
      linkUrl?: string;
      enabled?: boolean;
      position?: number;
      imageObjectFit?: string;
      imageObjectPosition?: string;
      imageZoom?: number | string;
    },
  ) {
    const row = await this.prisma.storeBanner.findFirst({ where: { id, teamId } });
    if (!row) throw new NotFoundException('Banner not found');
    const nextMeta = this.sanitizeBannerImageMeta({
      metadata: row.metadata,
      imageObjectFit: dto.imageObjectFit,
      imageObjectPosition: dto.imageObjectPosition,
      imageZoom: dto.imageZoom,
    });
    const touchImageMeta =
      dto.imageObjectFit !== undefined ||
      dto.imageObjectPosition !== undefined ||
      dto.imageZoom !== undefined;
    return this.prisma.storeBanner.update({
      where: { id },
      data: {
        ...(dto.title !== undefined ? { title: dto.title.trim() || null } : {}),
        ...(dto.subtitle !== undefined ? { subtitle: dto.subtitle.trim() || null } : {}),
        ...(dto.linkUrl !== undefined ? { linkUrl: dto.linkUrl.trim() || null } : {}),
        ...(dto.enabled !== undefined ? { enabled: dto.enabled } : {}),
        ...(dto.position !== undefined ? { position: dto.position } : {}),
        ...(touchImageMeta && nextMeta ? { metadata: nextMeta } : {}),
      },
    });
  }

  async deleteBanner(teamId: string, id: string) {
    const row = await this.prisma.storeBanner.findFirst({ where: { id, teamId } });
    if (!row) throw new NotFoundException('Banner not found');
    await this.storage.remove(row.storageKey);
    await this.prisma.storeBanner.delete({ where: { id } });
    return { ok: true };
  }

  async openBanner(teamId: string, id: string) {
    const row = await this.prisma.storeBanner.findFirst({ where: { id, teamId } });
    if (!row) throw new NotFoundException('Banner not found');
    return this.openStorage(row.storageKey, row.mimeType || 'image/jpeg', 'banner');
  }

  async openPublicBanner(slug: string, id: string) {
    const settings = await this.prisma.storeSettings.findUnique({ where: { slug } });
    if (!settings) throw new NotFoundException('Store not found');
    return this.openBanner(settings.teamId, id);
  }

  async catalogForAi(teamId: string, query?: string) {
    const rows = await this.list(teamId, query, 'all');
    return rows
      .filter((p) => p.isActive)
      .slice(0, 40)
      .map((p) => {
        const inStock = isProductInStock(p);
        return {
          id: p.id,
          name: p.name,
          sku: p.sku,
          description: p.description,
          price: displayPrice(p),
          currency: p.currency,
          quantity: p.quantity,
          inStock,
          stockLabel: inStock ? `متوفر (${p.quantity})` : 'نفدت الكمية',
          imageCount: p.images.filter((m) => m.kind === 'IMAGE').length,
        };
      });
  }

  async applySale(teamId: string, lines: StoreSaleLine[], bookingId?: string) {
    if (!lines.length) return;
    await this.prisma.$transaction(async (tx) => {
      for (const line of lines) {
        const qty = Math.max(1, Math.floor(Number(line.quantity) || 1));
        const product = await tx.product.findFirst({ where: { id: line.productId, teamId } });
        if (!product) throw new BadRequestException(`Product not found: ${line.name || line.productId}`);
        if (product.outOfStockManual || product.quantity < qty) {
          throw new BadRequestException(`Out of stock: ${product.name}`);
        }
        const next = product.quantity - qty;
        await tx.product.update({
          where: { id: product.id },
          data: { quantity: next, outOfStockManual: next <= 0 ? product.outOfStockManual : product.outOfStockManual },
        });
        await tx.productStockMovement.create({
          data: {
            teamId,
            productId: product.id,
            bookingId: bookingId || null,
            delta: -qty,
            quantityAfter: next,
            reason: 'SALE',
            note: line.name || product.name,
          },
        });
      }
    });
  }

  async resolveSaleLines(
    teamId: string,
    input: { productIds?: string[]; productLines?: Array<{ productId?: string; name?: string; quantity?: number }> },
  ): Promise<StoreSaleLine[]> {
    const catalog = await this.prisma.product.findMany({ where: { teamId, isActive: true } });
    const lines: StoreSaleLine[] = [];
    for (const raw of input.productLines ?? []) {
      const byId = raw.productId ? catalog.find((p) => p.id === raw.productId) : undefined;
      const byName = raw.name
        ? catalog.find((p) => p.name.toLowerCase() === raw.name!.trim().toLowerCase())
        : undefined;
      const product = byId || byName;
      if (!product) continue;
      lines.push({ productId: product.id, quantity: Math.max(1, Math.floor(Number(raw.quantity) || 1)), name: product.name });
    }
    if (!lines.length) {
      for (const id of input.productIds ?? []) {
        const short = /^P(\d+)$/i.exec(id.trim());
        const product = catalog.find((p) => p.id === id) || (short ? catalog[Number(short[1]) - 1] : undefined);
        if (product) lines.push({ productId: product.id, quantity: 1, name: product.name });
      }
    }
    return lines;
  }

  async getPublicStore(slug: string) {
    const settings = await this.prisma.storeSettings.findUnique({ where: { slug } });
    if (!settings || !settings.isPublished) throw new NotFoundException('Store not found');
    const [products, categories, banners, tiktokPixelCode] = await Promise.all([
      this.prisma.product.findMany({
        where: { teamId: settings.teamId, isActive: true },
        include: { images: { orderBy: { position: 'asc' } }, storeCategory: true },
        orderBy: [{ position: 'asc' }, { createdAt: 'desc' }],
      }),
      this.prisma.storeCategory.findMany({
        where: { teamId: settings.teamId, isActive: true },
        orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
      }),
      this.prisma.storeBanner.findMany({
        where: { teamId: settings.teamId, enabled: true },
        orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
      }),
      this.resolveTikTokPixelCode(settings),
    ]);
    return {
      settings: { ...this.publicSettings(settings), tiktokPixelCode },
      governorates: IQ_GOVERNORATES,
      categories: categories.map((c) => this.publicCategory(settings.slug, c)),
      products: products.map((p) => this.publicProduct(settings.slug, p)),
      banners: banners.map((b) => this.publicBanner(settings.slug, b)),
    };
  }

  private async resolveTikTokPixelCode(settings: { teamId: string; slug: string; pixelIntegrationId?: string | null }) {
    const resolved = await this.resolveTeamPixel(settings);
    return resolved?.pixelCode ?? null;
  }

  private async resolveTeamPixel(settings: { teamId: string; slug: string; pixelIntegrationId?: string | null }) {
    if (settings.pixelIntegrationId) {
      const linked = await this.prisma.tikTokIntegration.findUnique({
        where: { id: settings.pixelIntegrationId },
        select: { id: true, pixelCode: true, pixelId: true },
      });
      if (linked?.pixelCode) {
        return { integrationId: linked.id, pixelCode: linked.pixelCode, pixelId: linked.pixelId };
      }
    }
    const fallback = await this.prisma.tikTokIntegration.findFirst({
      where: {
        teamId: settings.teamId,
        pixelCode: { not: null },
        OR: [
          { redirectDestinationType: 'STORE' },
          { redirectDestinationType: 'INSTANT_FORM' },
          { externalRedirectUrl: { contains: `/s/${settings.slug}` } },
          { externalRedirectUrl: { contains: '/f/' } },
        ],
      },
      orderBy: { updatedAt: 'desc' },
      select: { id: true, pixelCode: true, pixelId: true },
    });
    if (fallback?.pixelCode) {
      return { integrationId: fallback.id, pixelCode: fallback.pixelCode, pixelId: fallback.pixelId };
    }
    const anyPixel = await this.prisma.tikTokIntegration.findFirst({
      where: { teamId: settings.teamId, pixelCode: { not: null } },
      orderBy: { updatedAt: 'desc' },
      select: { id: true, pixelCode: true, pixelId: true },
    });
    if (!anyPixel?.pixelCode) return null;
    return { integrationId: anyPixel.id, pixelCode: anyPixel.pixelCode, pixelId: anyPixel.pixelId };
  }

  async checkoutPublic(slug: string, dto: StoreCheckoutDto) {
    const settings = await this.prisma.storeSettings.findUnique({ where: { slug } });
    if (!settings || !settings.isPublished) throw new NotFoundException('Store not found');
    if (!dto.items?.length) throw new BadRequestException('Cart is empty');
    const phone = dto.phone.replace(/[^\d+]/g, '').trim();
    if (phone.length < 8) throw new BadRequestException('Invalid phone number');
    const governorate = dto.governorate.trim();
    const city = dto.city.trim();
    if (!governorate || !city) throw new BadRequestException('Governorate and city are required');

    const ids = [...new Set(dto.items.map((i) => i.productId))];
    const products = await this.prisma.product.findMany({
      where: { teamId: settings.teamId, id: { in: ids }, isActive: true },
      include: { images: { orderBy: { position: 'asc' }, take: 1 } },
    });
    const byId = new Map(products.map((p) => [p.id, p]));
    const lines: StoreSaleLine[] = [];
    const snapshotLines: Array<{
      productId: string;
      name: string;
      quantity: number;
      unitPrice: number;
      mediaId: string | null;
      colorId?: string | null;
      colorName?: string | null;
    }> = [];
    let subtotal = 0;
    const summary: string[] = [];
    for (const item of dto.items) {
      const product = byId.get(item.productId);
      if (!product) throw new BadRequestException('Product not found');
      const meta =
        product.metadata && typeof product.metadata === 'object' && !Array.isArray(product.metadata)
          ? (product.metadata as Record<string, unknown>)
          : {};
      const minOrder = Math.min(
        9999,
        Math.max(1, Math.floor(Number(meta.minOrderQuantity) || 1) || 1),
      );
      const qty = Math.max(minOrder, Math.floor(Number(item.quantity) || minOrder));
      if (!isProductInStock(product) || product.quantity < qty) {
        throw new BadRequestException(`Out of stock: ${product.name}`);
      }
      if (product.quantity < minOrder) {
        throw new BadRequestException(`Minimum order quantity for ${product.name} is ${minOrder}`);
      }
      const price = displayPrice(product);
      const colorName = String(item.colorName || '').trim().slice(0, 60) || null;
      const colorId = String(item.colorId || '').trim().slice(0, 64) || null;
      const colorRow = colorId
        ? this.sanitizeProductColors(meta.colors).find((c) => c.id === colorId)
        : null;
      const resolvedColorName = colorRow?.name || colorName;
      const mediaId = colorRow?.imageId || product.images[0]?.id || null;
      const lineLabel = resolvedColorName ? `${product.name} (${resolvedColorName})` : product.name;
      subtotal += price * qty;
      lines.push({ productId: product.id, quantity: qty, name: lineLabel });
      snapshotLines.push({
        productId: product.id,
        name: lineLabel,
        quantity: qty,
        unitPrice: price,
        mediaId,
        colorId,
        colorName: resolvedColorName,
      });
      summary.push(`${lineLabel} × ${qty} = ${price * qty} ${settings.currency}`);
    }
    const delivery = resolveDeliveryFee(settings, governorate);
    const total = subtotal + delivery;
    const address = [governorate, city, dto.landmark?.trim()].filter(Boolean).join(' — ');
    const orderType = summary.join(' | ');
    const booking = await this.bookings.createFromStore(settings.teamId, {
      phoneNumber: phone,
      address,
      orderType,
      totalAmount: total,
      currency: settings.currency,
      notes: `متجر عام | توصيل ${delivery} ${settings.currency} | معلم: ${dto.landmark?.trim() || '—'}`,
      items: {
        lines: snapshotLines,
        subtotal,
        delivery,
        total,
        currency: settings.currency,
        governorate,
        city,
        landmark: dto.landmark?.trim() || null,
      },
    });
    try {
      await this.applySale(settings.teamId, lines, booking.id);
    } catch (error) {
      await this.prisma.booking.delete({ where: { id: booking.id } }).catch(() => undefined);
      throw error;
    }

    // أول طلب منتج من المتجر → Events API لتيك توك
    const pixelIntegrationId = settings.pixelIntegrationId
      || (
        await this.prisma.tikTokIntegration.findFirst({
          where: {
            teamId: settings.teamId,
            OR: [
              { redirectDestinationType: 'STORE' },
              { externalRedirectUrl: { contains: `/s/${settings.slug}` } },
            ],
          },
          orderBy: { updatedAt: 'desc' },
          select: { id: true },
        })
      )?.id;
    if (pixelIntegrationId && this.tiktokTracking) {
      const web = (this.config.get<string>('WEB_PUBLIC_URL') || '').replace(/\/$/, '');
      void this.tiktokTracking.trackEcommerceOrderConversion({
        integrationId: pixelIntegrationId,
        orderId: booking.id,
        orderNumber: booking.orderNumber,
        ttclid: dto.ttclid,
        phone,
        value: total,
        currency: settings.currency,
        pageUrl: `${web}/s/${encodeURIComponent(settings.slug)}/checkout`,
        ip: dto.ip,
        userAgent: dto.userAgent,
        kind: 'STORE',
      }).catch(() => undefined);
    }

    return {
      ok: true,
      orderNumber: booking.orderNumber,
      subtotal,
      delivery,
      total,
      currency: settings.currency,
    };
  }

  async getPublicLanding(key: string) {
    const landingKey = String(key || '').trim() || FLASH_LANDING_KEY;
    if (!isSupportedLandingKey(landingKey)) throw new NotFoundException('Landing not found');
    const product = await this.findLandingProduct(landingKey);
    const settings = await this.prisma.storeSettings.findUnique({ where: { teamId: product.teamId } });
    if (!settings || !settings.isPublished) throw new NotFoundException('Store not found');
    const meta = parseLandingMeta(product.metadata);
    const promoEndsAt = rollPromoEndsAt(new Date(), meta.promoEndsAt);
    const defaultSale =
      landingKey === IBRAQ_MUSK_LANDING_KEY ? IBRAQ_PACK_PRICE_1 : (meta.salePrice ?? landingSalePrice(product));
    if (!meta.promoEndsAt || new Date(meta.promoEndsAt).getTime() !== promoEndsAt.getTime()) {
      await this.prisma.product.update({
        where: { id: product.id },
        data: {
          metadata: {
            ...(typeof product.metadata === 'object' && product.metadata && !Array.isArray(product.metadata)
              ? (product.metadata as object)
              : {}),
            landingKey,
            promoEndsAt: promoEndsAt.toISOString(),
            compareAtPrice:
              meta.compareAtPrice
              ?? (landingKey === IBRAQ_MUSK_LANDING_KEY ? IBRAQ_PACK_PRICE_1 * 2 : null),
            storageGb: meta.storageGb || (landingKey === IBRAQ_MUSK_LANDING_KEY ? '12×20ml' : '32 GB'),
            freeDelivery: landingKey === IBRAQ_MUSK_LANDING_KEY ? false : true,
            salePrice: defaultSale,
            testimonials: meta.testimonials || [],
            metaPixelId: meta.metaPixelId || null,
          } as Prisma.InputJsonValue,
        },
      });
    }
    await this.prisma.product.update({ where: { id: product.id }, data: { viewCount: { increment: 1 } } }).catch(() => undefined);
    const price =
      landingKey === IBRAQ_MUSK_LANDING_KEY ? IBRAQ_PACK_PRICE_1 : landingSalePrice(product);
    const originalPrice =
      landingKey === IBRAQ_MUSK_LANDING_KEY
        ? IBRAQ_PACK_PRICE_1 * 2
        : meta.compareAtPrice && meta.compareAtPrice > price
          ? meta.compareAtPrice
          : null;
    const publishedTestimonials = (meta.testimonials || []).filter((t) => t.published);
    const pixel = await this.resolveTeamPixel(settings);
    const deliveryFeeOne = resolveDeliveryFee(settings, null);
    return {
      key: landingKey,
      storeSlug: settings.slug,
      brandName: settings.brandName,
      currency: product.currency || settings.currency || 'IQD',
      product: {
        id: product.id,
        name: product.name,
        description: product.description,
        price,
        originalPrice,
        discount: originalPrice ? originalPrice - price : 0,
        storageGb: meta.storageGb || (landingKey === IBRAQ_MUSK_LANDING_KEY ? '12×20ml' : '32 GB'),
        deliveryFee: landingKey === IBRAQ_MUSK_LANDING_KEY ? deliveryFeeOne : 0,
        inStock: isProductInStock(product),
        media: product.images.map((m) => ({
          id: m.id,
          kind: m.kind,
          url: `${this.apiBase()}/api/v1/store/public/${encodeURIComponent(settings.slug)}/media/${m.id}`,
        })),
      },
      packs:
        landingKey === IBRAQ_MUSK_LANDING_KEY
          ? {
              one: resolveIbraqPackPricing(1, deliveryFeeOne),
              two: resolveIbraqPackPricing(2, deliveryFeeOne),
            }
          : null,
      governorates: [...IQ_GOVERNORATES],
      promoEndsAt: promoEndsAt.toISOString(),
      testimonials: publishedTestimonials,
      metaPixelId: meta.metaPixelId,
      tiktokPixelCode: pixel?.pixelCode ?? null,
      tiktokPixelConfigured: Boolean(pixel?.pixelCode),
      theme: resolveStoreTheme(settings.themeKey, settings.themeColors),
      whatsappPhone: settings.giftWhatsappPhone || '9647864314333',
      copy: meta.landingCopy || null,
    };
  }

  async checkoutLanding(key: string, dto: LandingCheckoutDto) {
    const landingKey = String(key || '').trim() || FLASH_LANDING_KEY;
    if (!isSupportedLandingKey(landingKey)) throw new NotFoundException('Landing not found');
    const product = await this.findLandingProduct(landingKey);
    const settings = await this.prisma.storeSettings.findUnique({ where: { teamId: product.teamId } });
    if (!settings || !settings.isPublished) throw new NotFoundException('Store not found');
    const phone = normalizeIraqiMobile(dto.phone);
    if (!phone) throw new BadRequestException('أدخل رقم هاتف عراقي صالح، مثل 07701234567');
    const address = validateOrderAddress(dto.address);
    if (!address) throw new BadRequestException('أدخل عنواناً واضحاً للتوصيل (8 أحرف على الأقل).');
    const customerName = sanitizeCustomerName(dto.name);
    const province = String(dto.province || '').trim().slice(0, 80);
    if (landingKey === IBRAQ_MUSK_LANDING_KEY && !province) {
      throw new BadRequestException('اختر المحافظة');
    }
    const packQty = landingKey === IBRAQ_MUSK_LANDING_KEY
      ? (Number(dto.packQty) === 2 ? 2 : 1)
      : 1;
    if (!isProductInStock(product) || product.quantity < packQty) {
      throw new BadRequestException('نفدت كمية هذا المنتج حالياً.');
    }

    let subtotal: number;
    let delivery: number;
    let discount: number;
    let total: number;
    let unitPrice: number;
    let originalPrice: number;
    let freeShipping = false;

    if (landingKey === IBRAQ_MUSK_LANDING_KEY) {
      const deliveryOne = resolveDeliveryFee(settings, province);
      const pricing = resolveIbraqPackPricing(packQty, deliveryOne);
      unitPrice = pricing.unitPrice;
      subtotal = pricing.subtotal;
      delivery = pricing.shippingCost;
      total = pricing.total;
      discount = pricing.savings;
      freeShipping = pricing.freeShipping;
      originalPrice = packQty === 2 ? IBRAQ_PACK_PRICE_1 * 2 : IBRAQ_PACK_PRICE_1;
    } else {
      const meta = parseLandingMeta(product.metadata);
      const price = landingSalePrice(product);
      if (price <= 0) throw new BadRequestException('تعذر إتمام الطلب. حدّث الصفحة وحاول مرة أخرى.');
      unitPrice = price;
      subtotal = price;
      delivery = 0;
      originalPrice = meta.compareAtPrice && meta.compareAtPrice > price ? meta.compareAtPrice : price;
      discount = Math.max(0, originalPrice - price);
      total = price;
      freeShipping = true;
    }

    const idempotency = String(dto.idempotencyKey || '').trim().slice(0, 80);
    if (idempotency) {
      const existing = await this.prisma.booking.findFirst({
        where: {
          teamId: product.teamId,
          phoneNumber: phone,
          createdAt: { gte: new Date(Date.now() - 120_000) },
          notes: { contains: `idem=${idempotency}` },
        },
        orderBy: { createdAt: 'desc' },
      });
      if (existing && Number(existing.totalAmount) === total) {
        return {
          ok: true,
          orderNumber: existing.orderNumber,
          orderId: existing.id,
          productName: product.name,
          packQty,
          price: unitPrice,
          subtotal,
          originalPrice,
          delivery,
          shippingCost: delivery,
          discount,
          total,
          currency: existing.currency,
          freeShipping,
          duplicate: true,
        };
      }
    }

    const ttclid = String(dto.ttclid || '').trim().slice(0, 200) || null;
    const booking = await this.bookings.createFromStore(product.teamId, {
      phoneNumber: phone,
      address: province ? `${province} - ${address}` : address,
      orderType: product.name,
      totalAmount: total,
      currency: product.currency || settings.currency || 'IQD',
      notes: [
        `landing=${landingKey}`,
        'source=landing_page',
        `packQty=${packQty}`,
        customerName ? `اسم:${customerName}` : null,
        province ? `محافظة:${province}` : null,
        ttclid ? `ttclid=${ttclid}` : null,
        dto.utmSource ? `utm_source=${String(dto.utmSource).slice(0, 80)}` : null,
        dto.utmMedium ? `utm_medium=${String(dto.utmMedium).slice(0, 80)}` : null,
        dto.utmCampaign ? `utm_campaign=${String(dto.utmCampaign).slice(0, 80)}` : null,
        idempotency ? `idem=${idempotency}` : null,
        'status=pending',
      ]
        .filter(Boolean)
        .join(' | '),
      items: {
        source: 'landing_page',
        landingKey,
        customerName,
        province: province || null,
        packQty,
        ttclid,
        utmSource: dto.utmSource || null,
        utmMedium: dto.utmMedium || null,
        utmCampaign: dto.utmCampaign || null,
        utmContent: dto.utmContent || null,
        utmTerm: dto.utmTerm || null,
        lines: [
          {
            productId: product.id,
            name: product.name,
            quantity: packQty,
            unitPrice,
            originalPrice,
            mediaId: product.images[0]?.id ?? null,
          },
        ],
        subtotal,
        delivery,
        shippingCost: delivery,
        discount,
        total,
        freeShipping,
        currency: product.currency || 'IQD',
      },
    });
    try {
      await this.applySale(
        product.teamId,
        [{ productId: product.id, quantity: packQty, name: product.name }],
        booking.id,
      );
    } catch (error) {
      await this.prisma.booking.delete({ where: { id: booking.id } }).catch(() => undefined);
      throw error;
    }

    const pixel = await this.resolveTeamPixel(settings);
    if (pixel?.integrationId && this.tiktokTracking) {
      const pageUrl = `${this.webBase()}/store/${landingKey}`;
      void this.tiktokTracking
        .trackEcommerceOrderConversion({
          integrationId: pixel.integrationId,
          orderId: booking.id,
          orderNumber: booking.orderNumber,
          ttclid,
          phone,
          value: total,
          currency: product.currency || settings.currency || 'IQD',
          pageUrl,
          ip: dto.ip,
          userAgent: dto.userAgent,
          kind: 'LANDING_LEAD',
          eventId: dto.eventId || undefined,
        })
        .catch(() => undefined);
    }

    return {
      ok: true,
      orderNumber: booking.orderNumber,
      orderId: booking.id,
      productName: product.name,
      packQty,
      price: unitPrice,
      subtotal,
      originalPrice,
      delivery,
      shippingCost: delivery,
      discount,
      total,
      freeShipping,
      currency: product.currency || settings.currency || 'IQD',
    };
  }

  private webBase() {
    return (this.config.get<string>('WEB_PUBLIC_URL') || 'http://localhost:3000').replace(/\/$/, '');
  }

  private async findLandingProduct(key: string) {
    const landingKey = String(key || '').trim() || FLASH_LANDING_KEY;
    if (!isSupportedLandingKey(landingKey)) throw new NotFoundException('Landing not found');
    const sku = landingSkuForKey(landingKey);
    const product = await this.prisma.product.findFirst({
      where: {
        isActive: true,
        OR: [{ sku }, { metadata: { path: ['landingKey'], equals: landingKey } }],
      },
      include: { images: { orderBy: { position: 'asc' } } },
      orderBy: { createdAt: 'asc' },
    });
    if (!product) throw new NotFoundException('Product not found');
    return product;
  }


  async openPublicMedia(slug: string, mediaId: string) {
    const settings = await this.prisma.storeSettings.findUnique({ where: { slug } });
    if (!settings) throw new NotFoundException('Store not found');
    const media = await this.prisma.productImage.findFirst({
      where: { id: mediaId, product: { teamId: settings.teamId } },
    });
    if (!media) throw new NotFoundException('Media not found');
    return this.openStorage(media.storageKey, media.mimeType || 'application/octet-stream', media.fileName);
  }

  async openPublicLogo(slug: string) {
    const settings = await this.prisma.storeSettings.findUnique({ where: { slug } });
    if (!settings?.logoStorageKey) throw new NotFoundException('Logo not found');
    return this.openStorage(settings.logoStorageKey, settings.logoMimeType || 'image/png', 'logo');
  }

  async openPublicCategoryImage(slug: string, categoryId: string) {
    const settings = await this.prisma.storeSettings.findUnique({ where: { slug } });
    if (!settings) throw new NotFoundException('Store not found');
    return this.openCategoryImage(settings.teamId, categoryId);
  }

  private publicProduct(
    slug: string,
    product: Prisma.ProductGetPayload<{ include: { images: true; storeCategory: true } }>,
  ) {
    const inStock = isProductInStock(product);
    const price = displayPrice(product);
    const meta = parseLandingMeta(product.metadata);
    const compareAt = meta.compareAtPrice && meta.compareAtPrice > price ? meta.compareAtPrice : null;
    const rawMeta =
      product.metadata && typeof product.metadata === 'object' && !Array.isArray(product.metadata)
        ? (product.metadata as Record<string, unknown>)
        : {};
    const objectFit = rawMeta.imageObjectFit === 'contain' ? 'contain' : 'cover';
    const objectPosition =
      typeof rawMeta.imageObjectPosition === 'string' && rawMeta.imageObjectPosition.trim()
        ? rawMeta.imageObjectPosition.trim().slice(0, 40)
        : 'center';
    const zoomRaw = Number(rawMeta.imageZoom);
    const imageZoom = Number.isFinite(zoomRaw) ? Math.min(200, Math.max(50, Math.round(zoomRaw))) : 100;
    const media = product.images.map((m) => ({
      id: m.id,
      kind: m.kind,
      url: `${this.apiBase()}/api/v1/store/public/${encodeURIComponent(slug)}/media/${m.id}`,
    }));
    const colors = this.sanitizeProductColors(rawMeta.colors).map((c) => ({
      ...c,
      imageUrl: c.imageId ? media.find((m) => m.id === c.imageId)?.url ?? null : null,
    }));
    return {
      id: product.id,
      name: product.name,
      description: product.description,
      price,
      compareAtPrice: compareAt,
      currency: product.currency,
      quantity: inStock ? product.quantity : 0,
      hideQuantity: Boolean(rawMeta.hideQuantity),
      minOrderQuantity: Math.min(
        9999,
        Math.max(1, Math.floor(Number(rawMeta.minOrderQuantity) || 1) || 1),
      ),
      inStock,
      categoryId: product.categoryId,
      categoryName: product.storeCategory?.name ?? null,
      imageObjectFit: objectFit,
      imageObjectPosition: objectPosition,
      imageZoom,
      colors,
      media,
    };
  }

  private publicBanner(
    slug: string,
    banner: {
      id: string;
      title: string | null;
      subtitle: string | null;
      linkUrl: string | null;
      metadata?: unknown;
    },
  ) {
    const fit = this.readBannerImageMeta(banner.metadata);
    return {
      id: banner.id,
      title: banner.title,
      subtitle: banner.subtitle,
      linkUrl: banner.linkUrl,
      imageUrl: `${this.apiBase()}/api/v1/store/public/${encodeURIComponent(slug)}/banner/${banner.id}`,
      ...fit,
    };
  }

  private publicCategory(slug: string, category: { id: string; name: string; imageStorageKey: string | null }) {
    return {
      id: category.id,
      name: category.name,
      imageUrl: category.imageStorageKey
        ? `${this.apiBase()}/api/v1/store/public/${encodeURIComponent(slug)}/category/${category.id}/image`
        : null,
    };
  }

  private publicSettings(settings: Prisma.StoreSettingsGetPayload<object>) {
    const theme = resolveStoreTheme(settings.themeKey, settings.themeColors);
    return {
      slug: settings.slug,
      brandName: settings.brandName,
      currency: settings.currency,
      defaultLocale: settings.defaultLocale === 'en' ? 'en' : 'ar',
      deliveryMode: settings.deliveryMode,
      deliveryFee: settings.deliveryFee,
      deliveryRates: parseDeliveryRates(settings.deliveryRates),
      giftWhatsappPhone: settings.giftWhatsappPhone,
      storeUrl: this.storeUrl(settings.slug),
      logoUrl: settings.logoStorageKey
        ? `${this.apiBase()}/api/v1/store/public/${encodeURIComponent(settings.slug)}/logo`
        : null,
      governorates: IQ_GOVERNORATES,
      promoEnabled: settings.promoEnabled,
      promoEndsAt: settings.promoEndsAt?.toISOString() ?? null,
      promoText: settings.promoText,
      themeKey: settings.themeKey,
      theme: theme,
      presets: STORE_THEME_PRESETS,
    };
  }

  private withStoreUrl(settings: Prisma.StoreSettingsGetPayload<object>) {
    return { ...settings, ...this.publicSettings(settings), deliveryRates: parseDeliveryRates(settings.deliveryRates) };
  }

  private storeUrl(slug: string) {
    const web = this.config.get<string>('WEB_PUBLIC_URL', 'http://localhost:3000').replace(/\/$/, '');
    return `${web}/s/${encodeURIComponent(slug)}`;
  }

  private apiBase() {
    return this.config.get<string>('API_PUBLIC_URL', 'http://localhost:4000').replace(/\/$/, '');
  }

  private resolveUnitPrice(data: { unitPrice?: number; priceCents?: number }) {
    if (data.unitPrice !== undefined && Number.isFinite(Number(data.unitPrice))) return Math.max(0, Number(data.unitPrice));
    if (data.priceCents !== undefined && Number.isFinite(Number(data.priceCents))) return Math.max(0, Number(data.priceCents));
    return 0;
  }

  private async openStorage(storageKey: string, mimeType: string, fileName?: string | null) {
    const path = this.storage.resolvePath(storageKey);
    try {
      const info = await stat(path);
      return {
        stream: createReadStream(path),
        mimeType,
        fileName: fileName || 'file',
        sizeBytes: info.size,
      };
    } catch {
      throw new NotFoundException('File is no longer available');
    }
  }
}
