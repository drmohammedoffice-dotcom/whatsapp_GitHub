import { Injectable } from '@nestjs/common';
import { Prisma } from '@watsapp/database';
import { PrismaService } from '../../prisma/prisma.service';
import { AdminAuditService } from './admin-audit.service';

@Injectable()
export class AdminSettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AdminAuditService,
  ) {}

  list(category?: string) {
    return this.prisma.systemSetting.findMany({
      where: category ? { category } : undefined,
      orderBy: { key: 'asc' },
    });
  }

  async upsert(adminUserId: string, key: string, value: Prisma.InputJsonValue, category = 'general') {
    const setting = await this.prisma.systemSetting.upsert({
      where: { key },
      create: { key, value, category },
      update: { value, category },
    });
    await this.audit.log({
      adminUserId,
      action: 'settings.update',
      resource: 'system_setting',
      resourceId: setting.id,
      metadata: { key },
    });
    return setting;
  }

  async getMaintenanceMode() {
    const row = await this.prisma.systemSetting.findUnique({ where: { key: 'maintenance_mode' } });
    return { enabled: row?.value === true || row?.value === 'true' };
  }
}
