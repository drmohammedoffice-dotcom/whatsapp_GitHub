import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDepartmentDto } from './dto/departments.dto';

@Injectable()
export class DepartmentsService {
  constructor(private readonly prisma: PrismaService) {}

  list(teamId: string) {
    return this.prisma.department.findMany({ where: { teamId }, include: { members: { include: { teamMember: { include: { user: { select: { id: true, name: true, email: true } } } } } } }, orderBy: { name: 'asc' } });
  }

  create(teamId: string, dto: CreateDepartmentDto) {
    return this.prisma.department.upsert({ where: { teamId_name: { teamId, name: dto.name } }, update: { description: dto.description }, create: { teamId, name: dto.name, description: dto.description } });
  }

  async addMember(teamId: string, departmentId: string, teamMemberId: string) {
    const department = await this.prisma.department.findFirst({ where: { id: departmentId, teamId } });
    if (!department) throw new NotFoundException('Department not found');
    const member = await this.prisma.teamMember.findFirst({ where: { id: teamMemberId, teamId } });
    if (!member) throw new NotFoundException('Team member not found');
    return this.prisma.departmentMember.upsert({ where: { departmentId_teamMemberId: { departmentId, teamMemberId } }, update: {}, create: { departmentId, teamMemberId } });
  }

  async removeMember(teamId: string, departmentId: string, teamMemberId: string) {
    const department = await this.prisma.department.findFirst({ where: { id: departmentId, teamId } });
    if (!department) throw new NotFoundException('Department not found');
    return this.prisma.departmentMember.deleteMany({ where: { departmentId, teamMemberId } });
  }
}
