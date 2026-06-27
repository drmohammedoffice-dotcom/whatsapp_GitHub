import { Injectable, NotFoundException } from '@nestjs/common';
import { SOCKET_EVENTS } from '@watsapp/shared';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { UpdateAgentStatusDto, UpdateMemberDto } from './dto/agents.dto';

@Injectable()
export class AgentsService {
  constructor(private readonly prisma: PrismaService, private readonly realtime: RealtimeGateway, private readonly audit: AuditService) {}

  list(teamId: string) {
    return this.prisma.teamMember.findMany({
      where: { teamId },
      include: { user: { select: { id: true, name: true, email: true } }, departmentMemberships: { include: { department: true } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  async updateMember(teamId: string, actorUserId: string | undefined, userId: string, dto: UpdateMemberDto) {
    const member = await this.prisma.teamMember.findUnique({ where: { teamId_userId: { teamId, userId } } });
    if (!member) throw new NotFoundException('Team member not found');
    const updated = await this.prisma.teamMember.update({ where: { id: member.id }, data: { role: dto.role ?? member.role, permissions: dto.permissions ?? member.permissions } });
    await this.audit.log({ teamId, actorUserId, action: 'agent.update', resource: 'teamMember', resourceId: member.id, metadata: dto });
    return updated;
  }

  async updateStatus(teamId: string, userId: string, dto: UpdateAgentStatusDto) {
    const status = await this.prisma.agentStatus.upsert({
      where: { teamId_userId: { teamId, userId } },
      update: { presence: dto.presence, capacity: dto.capacity },
      create: { teamId, userId, presence: dto.presence, capacity: dto.capacity ?? 10 },
    });
    this.realtime.emitTeam(teamId, SOCKET_EVENTS.AGENT_STATUS_UPDATED, status);
    return status;
  }
}
