import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminRole } from '@watsapp/database';
import { CurrentAdmin } from '../admin/decorators/current-admin.decorator';
import { RequireAdminRoles } from '../admin/decorators/require-admin-roles.decorator';
import { AdminJwtGuard } from '../admin/guards/admin-jwt.guard';
import { AdminRolesGuard } from '../admin/guards/admin-roles.guard';
import { AdminPrincipal } from '../admin/types/admin-principal';
import { WebmailService } from './webmail.service';

@ApiTags('Chatloora Admin Webmail')
@ApiBearerAuth()
@UseGuards(AdminJwtGuard, AdminRolesGuard)
@Controller('admin/mailboxes')
export class AdminWebmailController {
  constructor(private readonly webmail: WebmailService) {}

  @Get()
  @RequireAdminRoles(AdminRole.SUPER_ADMIN, AdminRole.SUPPORT_AGENT, AdminRole.MAILBOX_CREATOR)
  @ApiOperation({ summary: 'قائمة صناديق بريد ChatLoora (الموظف يرى ما أنشأه فقط)' })
  list(@CurrentAdmin() admin: AdminPrincipal, @Query('q') q?: string) {
    return this.webmail.listMailboxes(q, {
      adminUserId: admin.adminUserId,
      roles: admin.roles,
      role: admin.role,
    });
  }

  @Get('domain')
  @RequireAdminRoles(AdminRole.SUPER_ADMIN, AdminRole.SUPPORT_AGENT, AdminRole.MAILBOX_CREATOR)
  domain() {
    return { domain: this.webmail.domain(), webmailPath: '/mail' };
  }

  @Post()
  @RequireAdminRoles(AdminRole.SUPER_ADMIN, AdminRole.MAILBOX_CREATOR)
  @ApiOperation({ summary: 'إنشاء صندوق بريد يدوياً أو تلقائياً' })
  create(
    @CurrentAdmin() admin: AdminPrincipal,
    @Body()
    body: {
      localPart?: string;
      password?: string;
      displayName?: string;
      notes?: string;
      autoGenerate?: boolean;
    },
  ) {
    return this.webmail.createMailbox({
      ...body,
      autoGenerate: body.autoGenerate === true || (!body.localPart && !body.password),
      adminId: admin.adminUserId,
    });
  }

  @Post('auto')
  @RequireAdminRoles(AdminRole.SUPER_ADMIN, AdminRole.MAILBOX_CREATOR)
  @ApiOperation({
    summary:
      'إنشاء customerN@chatloora.com بالتسلسل + مشترك جات لورا + تجربة 3 أيام بكل المميزات (بدون OTP)',
  })
  createAuto(
    @CurrentAdmin() admin: AdminPrincipal,
    @Body() body: { displayName?: string; notes?: string },
  ) {
    return this.webmail.createCustomerMailboxProvisioned({
      displayName: body.displayName ?? '',
      notes: body.notes,
      adminId: admin.adminUserId,
    });
  }

  @Post(':id/session')
  @RequireAdminRoles(AdminRole.SUPER_ADMIN, AdminRole.MAILBOX_CREATOR)
  @ApiOperation({ summary: 'فتح جلسة ويب ميل للصندوق (للمعاينة السريعة)' })
  async openSession(@CurrentAdmin() admin: AdminPrincipal, @Param('id') id: string) {
    await this.webmail.assertMailboxAccess(id, admin);
    return this.webmail.openSession(id);
  }

  @Patch(':id')
  @RequireAdminRoles(AdminRole.SUPER_ADMIN, AdminRole.MAILBOX_CREATOR)
  async update(
    @CurrentAdmin() admin: AdminPrincipal,
    @Param('id') id: string,
    @Body()
    body: {
      displayName?: string | null;
      notes?: string | null;
      isActive?: boolean;
      password?: string;
      rotatePassword?: boolean;
    },
  ) {
    await this.webmail.assertMailboxAccess(id, admin);
    return this.webmail.updateMailbox(id, body);
  }

  @Get(':id/password')
  @RequireAdminRoles(AdminRole.SUPER_ADMIN, AdminRole.MAILBOX_CREATOR)
  async reveal(@CurrentAdmin() admin: AdminPrincipal, @Param('id') id: string) {
    await this.webmail.assertMailboxAccess(id, admin);
    return this.webmail.revealPassword(id);
  }

  @Delete(':id')
  @RequireAdminRoles(AdminRole.SUPER_ADMIN, AdminRole.MAILBOX_CREATOR)
  async remove(@CurrentAdmin() admin: AdminPrincipal, @Param('id') id: string) {
    await this.webmail.assertMailboxAccess(id, admin);
    return this.webmail.deleteMailbox(id);
  }
}
