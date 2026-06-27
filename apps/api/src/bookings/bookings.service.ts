import { Injectable } from '@nestjs/common';
import { BookingStatus } from '@watsapp/database';
import * as XLSX from 'xlsx';
import PDFDocument from 'pdfkit';
import { PrismaService } from '../prisma/prisma.service';
import { phoneFromJid } from '../modules/whatsapp/utils/disconnect.util';

export type CreateBookingInput = {
  phoneNumber?: string | null;
  useWhatsAppPhone?: boolean;
  address?: string;
  orderType?: string;
  totalAmount?: number;
  currency?: string;
  notes?: string | null;
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

@Injectable()
export class BookingsService {
  constructor(private readonly prisma: PrismaService) {}

  list(teamId: string, query?: { status?: BookingStatus; search?: string }) {
    return this.prisma.booking.findMany({
      where: {
        teamId,
        ...(query?.status ? { status: query.status } : {}),
        ...(query?.search
          ? {
              OR: [
                { orderNumber: { contains: query.search, mode: 'insensitive' } },
                { phoneNumber: { contains: query.search, mode: 'insensitive' } },
                { address: { contains: query.search, mode: 'insensitive' } },
                { orderType: { contains: query.search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      include: {
        contact: { select: { id: true, displayName: true } },
        conversation: { select: { id: true, subject: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });
  }

  async createFromAi(
    teamId: string,
    conversation: ConversationContext,
    input: CreateBookingInput,
    options?: { whatsAppPhone?: string | null; forceWhatsAppPhone?: boolean },
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
        status: BookingStatus.CONFIRMED,
      },
      include: {
        contact: { select: { id: true, displayName: true } },
      },
    });
  }

  async exportExcel(teamId: string) {
    const rows = await this.list(teamId);
    const sheet = XLSX.utils.json_to_sheet(
      rows.map((row) => ({
        'Order #': row.orderNumber,
        Phone: row.phoneNumber,
        Address: row.address,
        'Order Type': row.orderType,
        Total: row.totalAmount,
        Currency: row.currency,
        Status: row.status,
        Customer: row.contact?.displayName ?? '',
        'WhatsApp Phone': row.usedWhatsappPhone ? 'Yes' : 'No',
        Date: row.createdAt.toISOString(),
        Notes: row.notes ?? '',
      })),
    );
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, 'Bookings');
    return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  }

  async exportPdf(teamId: string) {
    const rows = await this.list(teamId);
    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));

    const done = new Promise<Buffer>((resolve) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)));
    });

    doc.fontSize(16).text('Bookings / Orders Report', { align: 'center' });
    doc.moveDown();
    doc.fontSize(9);

    for (const row of rows) {
      doc.text(`Order: ${row.orderNumber}`);
      doc.text(`Phone: ${row.phoneNumber}${row.usedWhatsappPhone ? ' (WhatsApp)' : ''}`);
      doc.text(`Type: ${row.orderType}`);
      doc.text(`Total: ${row.totalAmount} ${row.currency}`);
      doc.text(`Address: ${row.address}`);
      doc.text(`Customer: ${row.contact?.displayName ?? '-'}`);
      doc.text(`Date: ${row.createdAt.toISOString().slice(0, 16).replace('T', ' ')}`);
      if (row.notes) doc.text(`Notes: ${row.notes}`);
      doc.moveDown(0.5);
      doc.moveTo(40, doc.y).lineTo(555, doc.y).strokeColor('#cccccc').stroke();
      doc.moveDown(0.5);
    }

    if (!rows.length) doc.text('No bookings found.');
    doc.end();
    return done;
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

  private async nextOrderNumber(teamId: string) {
    const count = await this.prisma.booking.count({ where: { teamId } });
    return `ORD-${String(count + 1).padStart(5, '0')}`;
  }
}
