import { Injectable } from '@nestjs/common';
import { Prisma } from '@watsapp/database';
import { PrismaService } from '../prisma/prisma.service';
import { UpsertSettingDto } from './dto/setting.dto';

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  list(teamId: string) { return this.prisma.setting.findMany({ where: { teamId }, orderBy: { key: 'asc' } }); }

  upsert(teamId: string, dto: UpsertSettingDto) {
    const value = dto.value as Prisma.InputJsonValue;
    return this.prisma.setting.upsert({ where: { teamId_key: { teamId, key: dto.key } }, update: { value }, create: { teamId, key: dto.key, value } });
  }
}
