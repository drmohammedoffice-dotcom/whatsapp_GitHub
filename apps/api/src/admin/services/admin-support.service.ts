import { Injectable, NotFoundException } from '@nestjs/common';
import { SupportTicketStatus } from '@watsapp/database';
import { PrismaService } from '../../prisma/prisma.service';
import { AdminAuditService } from './admin-audit.service';

@Injectable()
export class AdminSupportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AdminAuditService,
  ) {}

  list(params: { status?: SupportTicketStatus; skip?: number; take?: number }) {
    return this.prisma.supportTicket.findMany({
      where: params.status ? { status: params.status } : undefined,
      skip: params.skip ?? 0,
      take: Math.min(params.take ?? 50, 100),
      orderBy: { updatedAt: 'desc' },
      include: {
        reporter: { select: { id: true, email: true, name: true } },
        assignee: { include: { user: { select: { email: true, name: true } } } },
        team: { select: { id: true, name: true } },
        _count: { select: { messages: true } },
      },
    });
  }

  async getById(id: string) {
    const ticket = await this.prisma.supportTicket.findUnique({
      where: { id },
      include: {
        reporter: true,
        assignee: { include: { user: true } },
        team: true,
        messages: {
          orderBy: { createdAt: 'asc' },
          include: { author: { include: { user: { select: { name: true, email: true } } } } },
        },
      },
    });
    if (!ticket) throw new NotFoundException('Ticket not found');
    return ticket;
  }

  create(adminUserId: string, input: {
    subject: string;
    body: string;
    userId?: string;
    teamId?: string;
    priority?: string;
  }) {
    return this.prisma.supportTicket
      .create({
        data: {
          subject: input.subject,
          userId: input.userId,
          teamId: input.teamId,
          priority: (input.priority as never) ?? undefined,
          messages: { create: { authorId: adminUserId, body: input.body } },
        },
        include: { messages: true },
      })
      .then(async (ticket) => {
        await this.audit.log({ adminUserId, action: 'ticket.create', resource: 'support_ticket', resourceId: ticket.id });
        return ticket;
      });
  }

  assign(adminUserId: string, ticketId: string, assigneeId: string) {
    return this.prisma.supportTicket
      .update({ where: { id: ticketId }, data: { assigneeId } })
      .then(async (ticket) => {
        await this.audit.log({
          adminUserId,
          action: 'ticket.assign',
          resource: 'support_ticket',
          resourceId: ticketId,
          metadata: { assigneeId },
        });
        return ticket;
      });
  }

  reply(adminUserId: string, ticketId: string, body: string, isInternal = false) {
    return this.prisma.ticketMessage
      .create({ data: { ticketId, authorId: adminUserId, body, isInternal } })
      .then(async (message) => {
        await this.prisma.supportTicket.update({ where: { id: ticketId }, data: { updatedAt: new Date() } });
        return message;
      });
  }

  updateStatus(adminUserId: string, ticketId: string, status: SupportTicketStatus) {
    return this.prisma.supportTicket
      .update({
        where: { id: ticketId },
        data: {
          status,
          closedAt: status === SupportTicketStatus.CLOSED ? new Date() : null,
        },
      })
      .then(async (ticket) => {
        await this.audit.log({
          adminUserId,
          action: 'ticket.status',
          resource: 'support_ticket',
          resourceId: ticketId,
          metadata: { status },
        });
        return ticket;
      });
  }
}
