import { Injectable, NotFoundException } from '@nestjs/common';
import { SOCKET_EVENTS } from '@watsapp/shared';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { CreateLabelDto, UpdateContactDto } from './dto/contact.dto';

@Injectable()
export class ContactsService {
  constructor(private readonly prisma: PrismaService, private readonly realtime: RealtimeGateway) {}

  list(teamId: string, search?: string) {
    return this.prisma.contact.findMany({
      where: { teamId, ...(search ? { OR: [{ displayName: { contains: search, mode: 'insensitive' } }, { email: { contains: search, mode: 'insensitive' } }, { phone: { contains: search, mode: 'insensitive' } }] } : {}) },
      include: { identities: { include: { channel: true } }, labels: { include: { label: true } } },
      orderBy: { updatedAt: 'desc' },
      take: 100,
    });
  }

  async get(teamId: string, id: string) {
    const contact = await this.prisma.contact.findFirst({
      where: { id, teamId },
      include: {
        identities: { include: { channel: true } },
        labels: { include: { label: true } },
        customValues: { include: { field: true } },
        conversations: { include: { messages: { orderBy: { createdAt: 'desc' }, take: 5 } }, orderBy: { updatedAt: 'desc' } },
      },
    });
    if (!contact) throw new NotFoundException('Contact not found');
    return contact;
  }

  async update(teamId: string, id: string, dto: UpdateContactDto) {
    await this.get(teamId, id);
    const contact = await this.prisma.contact.update({ where: { id }, data: dto });
    this.realtime.emitTeam(teamId, SOCKET_EVENTS.CONTACT_UPDATED, contact);
    return contact;
  }

  labels(teamId: string) {
    return this.prisma.label.findMany({ where: { teamId }, orderBy: { name: 'asc' } });
  }

  async createLabel(teamId: string, dto: CreateLabelDto) {
    const label = await this.prisma.label.upsert({ where: { teamId_name: { teamId, name: dto.name } }, update: { color: dto.color }, create: { teamId, name: dto.name, color: dto.color } });
    this.realtime.emitTeam(teamId, SOCKET_EVENTS.TAG_UPDATED, label);
    return label;
  }

  customFields(teamId: string) {
    return this.prisma.contactCustomField.findMany({ where: { teamId }, orderBy: { label: 'asc' } });
  }
}
