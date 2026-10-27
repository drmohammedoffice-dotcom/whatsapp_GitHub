import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { BookingStatus, Prisma } from '@watsapp/database';
import { existsSync } from 'fs';
import * as XLSX from 'xlsx';
import PDFDocument from 'pdfkit';
import { PrismaService } from '../prisma/prisma.service';
import { phoneFromJid } from '../modules/whatsapp/utils/disconnect.util';
import { UpdateBookingDto } from './dto/booking.dto';

export type CreateBookingInput = {
  phoneNumber?: string | null;
  useWhatsAppPhone?: boolean;
  address?: string;
  orderType?: string;
  totalAmount?: number;
  currency?: string;
  notes?: string | null;
  productLines?: Array<{ productId?: string; name?: string; quantity?: number }>;
};

export type BookingExportRange = {
  fromSeq?: number;
  toSeq?: number;
};

type ConversationContext = {
  id: string;
  contactId: string;
  contact: {
    phone?: string | null;
    displayName: string;
    identities: Array<{ channelId: string; externalId: string }>;
  };
  channelId: string;
};

const LAST_EXPORT_KEY = 'bookings.lastExportSeq';

@Injectable()
export class BookingsService {
  constructor(private readonly prisma: PrismaService) {}

  list(teamId: string, query?: { status?: BookingStatus; search?: string } & BookingExportRange) {
    const hasRange = Boolean(query?.fromSeq || query?.toSeq);
    return this.prisma.booking.findMany({
      where: this.buildWhere(teamId, query),
      include: {
        contact: { select: { id: true, displayName: true } },
        conversation: { select: { id: true, subject: true } },
      },
      orderBy: hasRange ? { orderNumber: 'asc' } : { createdAt: 'desc' },
      take: 2000,
    });
  }

  async getExportMeta(teamId: string) {
    const [lastExportSeq, maxAgg, count] = await Promise.all([
      this.getLastExportSeq(teamId),
      this.prisma.booking.aggregate({
        where: { teamId },
        _count: true,
      }),
      this.prisma.booking.count({ where: { teamId } }),
    ]);

    const bookings = await this.prisma.booking.findMany({
      where: { teamId },
      select: { orderNumber: true },
      orderBy: { orderNumber: 'asc' },
    });
    const seqs = bookings.map((b) => this.orderNumberToSeq(b.orderNumber)).filter((n) => n > 0);
    const maxSeq = seqs.length ? Math.max(...seqs) : 0;
    const nextFrom = lastExportSeq >= maxSeq ? 1 : Math.max(1, lastExportSeq + 1);
    const nextTo = maxSeq;

    return {
      lastExportSeq,
      maxSeq,
      count: maxAgg._count,
      totalCount: count,
      suggestedFrom: nextFrom,
      suggestedTo: nextTo > 0 && nextFrom <= nextTo ? nextTo : maxSeq,
      hasNewOrders: lastExportSeq < maxSeq && maxSeq > 0,
    };
  }

  async update(teamId: string, id: string, dto: UpdateBookingDto) {
    const existing = await this.prisma.booking.findFirst({ where: { id, teamId } });
    if (!existing) throw new NotFoundException('Order not found');

    const phoneNumber = dto.phoneNumber?.trim();
    const address = dto.address?.trim();
    const orderType = dto.orderType?.trim();
    const totalAmount =
      dto.totalAmount === undefined ? undefined : Number(dto.totalAmount);
    if (totalAmount !== undefined && (!Number.isFinite(totalAmount) || totalAmount < 0)) {
      throw new BadRequestException('Invalid total amount');
    }

    const customerName = dto.customerName?.trim();
    if (customerName && existing.contactId) {
      await this.prisma.contact.update({
        where: { id: existing.contactId },
        data: { displayName: customerName },
      });
    }

    return this.prisma.booking.update({
      where: { id },
      data: {
        ...(phoneNumber ? { phoneNumber: this.normalizePhone(phoneNumber) } : {}),
        ...(address ? { address } : {}),
        ...(orderType ? { orderType } : {}),
        ...(totalAmount !== undefined ? { totalAmount } : {}),
        ...(dto.currency?.trim() ? { currency: dto.currency.trim() } : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes?.trim() || null } : {}),
        ...(dto.usedWhatsappPhone !== undefined ? { usedWhatsappPhone: dto.usedWhatsappPhone } : {}),
        ...(dto.status ? { status: dto.status } : {}),
      },
      include: {
        contact: { select: { id: true, displayName: true } },
        conversation: { select: { id: true, subject: true } },
      },
    });
  }

  async remove(teamId: string, id: string) {
    const existing = await this.prisma.booking.findFirst({ where: { id, teamId } });
    if (!existing) throw new NotFoundException('Order not found');
    await this.prisma.booking.delete({ where: { id } });
    return { deleted: true, id, orderNumber: existing.orderNumber };
  }

  async createFromStore(
    teamId: string,
    input: {
      phoneNumber: string;
      address: string;
      orderType: string;
      totalAmount: number;
      currency?: string;
      notes?: string | null;
      items?: Prisma.InputJsonValue;
    },
  ) {
    const phoneNumber = this.normalizePhone(input.phoneNumber);
    const address = input.address.trim();
    const orderType = input.orderType.trim();
    const totalAmount = Number(input.totalAmount);
    if (!phoneNumber || !address || !orderType || !Number.isFinite(totalAmount) || totalAmount < 0) {
      throw new BadRequestException('Invalid store order');
    }
    const orderNumber = await this.nextOrderNumber(teamId);
    return this.prisma.booking.create({
      data: {
        teamId,
        orderNumber,
        phoneNumber,
        address,
        orderType,
        totalAmount,
        currency: input.currency?.trim() || 'IQD',
        usedWhatsappPhone: false,
        notes: input.notes?.trim() || null,
        items: input.items,
        status: BookingStatus.CONFIRMED,
      },
    });
  }

  async createFromAi(
    teamId: string,
    conversation: ConversationContext,
    input: CreateBookingInput,
    options?: {
      whatsAppPhone?: string | null;
      forceWhatsAppPhone?: boolean;
      status?: BookingStatus;
    },
  ) {
    const address = input.address?.trim();
    const orderType = input.orderType?.trim();
    const totalAmount = Number(input.totalAmount);
    if (!address || !orderType || !Number.isFinite(totalAmount) || totalAmount <= 0) return null;

    const providedPhone = input.phoneNumber?.trim();
    const useWhatsApp =
      Boolean(options?.forceWhatsAppPhone) || Boolean(input.useWhatsAppPhone) || !providedPhone;
    const resolvedWhatsAppPhone = options?.whatsAppPhone?.trim()
      ? this.normalizePhone(options.whatsAppPhone.trim())
      : this.resolveWhatsAppPhone(conversation);
    const phoneNumber = useWhatsApp
      ? resolvedWhatsAppPhone || (providedPhone ? this.normalizePhone(providedPhone) : '')
      : this.normalizePhone(providedPhone!);

    if (!phoneNumber) return null;

    const orderNumber = await this.nextOrderNumber(teamId);
    const items = await this.snapshotLines(teamId, input.productLines, input.currency?.trim() || 'IQD', totalAmount);
    return this.prisma.booking.create({
      data: {
        teamId,
        conversationId: conversation.id,
        contactId: conversation.contactId,
        orderNumber,
        phoneNumber,
        address,
        orderType,
        totalAmount,
        currency: input.currency?.trim() || 'IQD',
        usedWhatsappPhone: useWhatsApp,
        notes: input.notes?.trim() || null,
        items,
        status: options?.status ?? BookingStatus.CONFIRMED,
      },
      include: {
        contact: { select: { id: true, displayName: true } },
      },
    });
  }

  /**
   * `markExported: false` lets the client confirm with markExportedRange() only after the
   * file was really saved (the mobile app saves through the native share sheet).
   */
  async exportExcel(teamId: string, range?: BookingExportRange, markExported = true) {
    const rows = await this.list(teamId, range);
    if (!rows.length) throw new BadRequestException('No orders in the selected range');

    const sheet = XLSX.utils.json_to_sheet(
      rows.map((row, index) => ({
        '#': index + 1,
        'Order #': row.orderNumber,
        Customer: row.contact?.displayName ?? '',
        Phone: row.phoneNumber,
        Address: row.address,
        Order: row.orderType,
        Price: row.totalAmount,
        Currency: row.currency,
        Date: this.formatDate(row.createdAt),
        Time: this.formatTime(row.createdAt),
        Notes: row.notes ?? '',
      })),
    );
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, 'Orders');
    if (markExported) await this.markExportRange(teamId, rows);
    return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  }

  async exportPdf(teamId: string, range?: BookingExportRange, markExported = true) {
    const rows = await this.list(teamId, range);
    if (!rows.length) throw new BadRequestException('No orders in the selected range');

    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));

    const done = new Promise<Buffer>((resolve) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)));
    });

    const fontPath = this.resolvePdfFont();
    if (fontPath) {
      doc.registerFont('AppSans', fontPath);
      doc.font('AppSans');
    }

    const fromLabel = rows[0]?.orderNumber ?? '';
    const toLabel = rows[rows.length - 1]?.orderNumber ?? '';

    doc.fontSize(18).text('Orders Report / تقرير الطلبات', { align: 'center' });
    doc.moveDown(0.3);
    doc.fontSize(10).fillColor('#555555').text(`Range: ${fromLabel} → ${toLabel}  |  Total: ${rows.length}`, {
      align: 'center',
    });
    doc.fillColor('#000000');
    doc.moveDown(0.8);

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]!;
      if (doc.y > 700) doc.addPage();

      const boxTop = doc.y;
      doc.roundedRect(40, boxTop, 515, 118, 6).strokeColor('#dddddd').stroke();
      doc.y = boxTop + 10;

      doc.fontSize(12).fillColor('#111111').text(`${i + 1}.  ${row.orderNumber}`, 50, doc.y, { continued: false });
      doc.moveDown(0.35);
      doc.fontSize(10);
      this.pdfField(doc, 'Customer / الزبون', row.contact?.displayName ?? '—');
      this.pdfField(doc, 'Phone / الهاتف', row.phoneNumber + (row.usedWhatsappPhone ? ' (WhatsApp)' : ''));
      this.pdfField(doc, 'Address / العنوان', row.address);
      this.pdfField(doc, 'Order / الطلبية', row.orderType);
      this.pdfField(doc, 'Price / السعر', `${row.totalAmount.toLocaleString()} ${row.currency}`);
      this.pdfField(
        doc,
        'Date & Time / التاريخ والوقت',
        `${this.formatDate(row.createdAt)}  ${this.formatTime(row.createdAt)}`,
      );
      if (row.notes) this.pdfField(doc, 'Notes / ملاحظات', row.notes);

      doc.y = Math.max(doc.y, boxTop + 118) + 10;
    }

    doc.end();
    if (markExported) await this.markExportRange(teamId, rows);
    return done;
  }

  private pdfField(doc: InstanceType<typeof PDFDocument>, label: string, value: string) {
    const y = doc.y;
    doc.fillColor('#666666').text(label, 50, y, { width: 160, continued: false });
    doc.fillColor('#111111').text(value || '—', 210, y, { width: 330 });
    doc.y = Math.max(doc.y, y + 14);
  }

  private resolvePdfFont() {
    const candidates = [
      '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
      '/usr/share/fonts/truetype/noto/NotoSansArabic-Regular.ttf',
      '/usr/share/fonts/truetype/freefont/FreeSans.ttf',
      'C:/Windows/Fonts/arial.ttf',
      'C:/Windows/Fonts/tahoma.ttf',
    ];
    return candidates.find((path) => existsSync(path));
  }

  private buildWhere(teamId: string, query?: { status?: BookingStatus; search?: string } & BookingExportRange) {
    const fromSeq = query?.fromSeq;
    const toSeq = query?.toSeq;
    const orderNumberFilter =
      fromSeq || toSeq
        ? {
            orderNumber: {
              ...(fromSeq ? { gte: this.seqToOrderNumber(fromSeq) } : {}),
              ...(toSeq ? { lte: this.seqToOrderNumber(toSeq) } : {}),
            },
          }
        : {};

    return {
      teamId,
      ...(query?.status ? { status: query.status } : {}),
      ...orderNumberFilter,
      ...(query?.search
        ? {
            OR: [
              { orderNumber: { contains: query.search, mode: 'insensitive' as const } },
              { phoneNumber: { contains: query.search, mode: 'insensitive' as const } },
              { address: { contains: query.search, mode: 'insensitive' as const } },
              { orderType: { contains: query.search, mode: 'insensitive' as const } },
              { notes: { contains: query.search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };
  }

  /** Confirms a successful export of the given range (see exportExcel `markExported`). */
  async markExportedRange(teamId: string, range?: BookingExportRange) {
    const rows = await this.list(teamId, range);
    await this.markExportRange(teamId, rows);
    return this.getExportMeta(teamId);
  }

  private async markExportRange(
    teamId: string,
    rows: Array<{ orderNumber: string }>,
  ) {
    const seqs = rows.map((r) => this.orderNumberToSeq(r.orderNumber)).filter((n) => n > 0);
    if (!seqs.length) return;
    const maxExported = Math.max(...seqs);
    const current = await this.getLastExportSeq(teamId);
    const next = Math.max(current, maxExported);
    await this.prisma.setting.upsert({
      where: { teamId_key: { teamId, key: LAST_EXPORT_KEY } },
      update: { value: next },
      create: { teamId, key: LAST_EXPORT_KEY, value: next },
    });
  }

  private async getLastExportSeq(teamId: string) {
    const setting = await this.prisma.setting.findUnique({
      where: { teamId_key: { teamId, key: LAST_EXPORT_KEY } },
    });
    const value = setting?.value;
    const num = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(num) && num > 0 ? Math.floor(num) : 0;
  }

  orderNumberToSeq(orderNumber: string) {
    const match = /ORD-0*(\d+)/i.exec(orderNumber.trim());
    return match ? Number(match[1]) : 0;
  }

  seqToOrderNumber(seq: number) {
    return `ORD-${String(Math.max(0, Math.floor(seq))).padStart(5, '0')}`;
  }

  private formatDate(date: Date) {
    return date.toLocaleDateString('en-GB', { year: 'numeric', month: '2-digit', day: '2-digit' });
  }

  private formatTime(date: Date) {
    return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  private resolveWhatsAppPhone(conversation: ConversationContext) {
    const identity =
      conversation.contact.identities.find((item) => item.channelId === conversation.channelId) ??
      conversation.contact.identities[0];
    if (identity?.externalId && !identity.externalId.includes('@lid')) {
      const fromIdentity = phoneFromJid(identity.externalId);
      if (fromIdentity) return this.normalizePhone(fromIdentity);
    }
    const fromContact = conversation.contact.phone?.trim();
    if (fromContact && !fromContact.includes('@')) return this.normalizePhone(fromContact);
    return '';
  }

  private normalizePhone(value: string) {
    return value.replace(/[^\d+]/g, '').trim();
  }

  private async snapshotLines(
    teamId: string,
    productLines: Array<{ productId?: string; name?: string; quantity?: number }> | undefined,
    currency: string,
    totalAmount: number,
  ): Promise<Prisma.InputJsonValue | undefined> {
    if (!productLines?.length) return undefined;
    const ids = [...new Set(productLines.map((l) => l.productId).filter(Boolean))] as string[];
    const products = ids.length
      ? await this.prisma.product.findMany({
          where: { teamId, id: { in: ids } },
          include: { images: { orderBy: { position: 'asc' }, take: 1 } },
        })
      : [];
    const byId = new Map(products.map((p) => [p.id, p]));
    const lines = productLines.map((raw) => {
      const product = raw.productId ? byId.get(raw.productId) : undefined;
      const qty = Math.max(1, Math.floor(Number(raw.quantity) || 1));
      const unitPrice = product ? Number(product.unitPrice) || 0 : 0;
      return {
        productId: product?.id ?? raw.productId ?? null,
        name: product?.name || raw.name || 'Item',
        quantity: qty,
        unitPrice,
        mediaId: product?.images[0]?.id ?? null,
      };
    });
    const subtotal = lines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);
    return { lines, subtotal, delivery: Math.max(0, totalAmount - subtotal), total: totalAmount, currency };
  }

  private async nextOrderNumber(teamId: string) {
    const latest = await this.prisma.booking.findFirst({
      where: { teamId },
      orderBy: { orderNumber: 'desc' },
      select: { orderNumber: true },
    });
    const next = (latest ? this.orderNumberToSeq(latest.orderNumber) : 0) + 1;
    return this.seqToOrderNumber(next);
  }
}
