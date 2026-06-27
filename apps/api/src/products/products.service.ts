import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  list(teamId: string) {
    return this.prisma.product.findMany({ where: { teamId }, include: { images: { orderBy: { position: 'asc' } } }, orderBy: { createdAt: 'desc' } });
  }

  async get(teamId: string, id: string) {
    const product = await this.prisma.product.findFirst({ where: { id, teamId }, include: { images: { orderBy: { position: 'asc' } } } });
    if (!product) throw new NotFoundException('Product not found');
    await this.prisma.product.update({ where: { id }, data: { viewCount: { increment: 1 } } });
    return product;
  }

  create(teamId: string, data: { name: string; sku?: string; description?: string; priceCents?: number; currency?: string; category?: string; metadata?: object }) {
    return this.prisma.product.create({ data: { teamId, ...data } });
  }

  async update(teamId: string, id: string, data: Partial<{ name: string; sku: string; description: string; priceCents: number; currency: string; category: string; isActive: boolean; metadata: object }>) {
    await this.get(teamId, id);
    return this.prisma.product.update({ where: { id }, data });
  }

  async delete(teamId: string, id: string) {
    await this.get(teamId, id);
    return this.prisma.product.delete({ where: { id } });
  }

  addImage(productId: string, data: { storageKey: string; url?: string; altText?: string; position?: number }) {
    return this.prisma.productImage.create({ data: { productId, ...data } });
  }
}
