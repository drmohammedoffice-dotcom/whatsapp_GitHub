import { Injectable } from '@nestjs/common';
import { NotificationType } from '@watsapp/database';
import { SOCKET_EVENTS } from '@watsapp/shared';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService, private readonly realtime: RealtimeGateway) {}

  list(teamId: string, userId: string) {
    return this.prisma.notification.findMany({ where: { teamId, userId }, orderBy: { createdAt: 'desc' }, take: 50 });
  }

  async create(input: { teamId: string; userId: string; type: NotificationType; title: string; body: string; data?: object }) {
    const notification = await this.prisma.notification.create({ data: input });
    this.realtime.emitUser(input.userId, SOCKET_EVENTS.NOTIFICATION_CREATED, notification);
    return notification;
  }

  async markRead(teamId: string, userId: string, id: string) {
    return this.prisma.notification.updateMany({ where: { id, teamId, userId }, data: { readAt: new Date() } });
  }
}
