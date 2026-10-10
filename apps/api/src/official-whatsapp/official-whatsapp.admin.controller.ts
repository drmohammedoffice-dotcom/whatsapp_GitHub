import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AdminRole, OfficialNotificationType } from '@watsapp/database';
import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { RequireAdminRoles } from '../admin/decorators/require-admin-roles.decorator';
import { AdminJwtGuard } from '../admin/guards/admin-jwt.guard';
import { AdminRolesGuard } from '../admin/guards/admin-roles.guard';
import { OfficialWhatsAppNotificationService } from './official-whatsapp.notifications.service';
import { OfficialWhatsAppOtpService } from './official-whatsapp.otp.service';
import { OfficialWhatsAppSenderService } from './official-whatsapp.sender.service';

class SaveSenderDto {
  @IsOptional()
  @IsString()
  wabaId?: string;

  @IsOptional()
  @IsString()
  phoneNumberId?: string;

  @IsOptional()
  @IsString()
  displayPhoneNumber?: string;

  @IsOptional()
  @IsString()
  displayName?: string;

  @IsOptional()
  @IsString()
  accessToken?: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

class SaveOtpDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsBoolean()
  loginEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  passwordResetEnabled?: boolean;

  @IsOptional()
  @IsString()
  templateName?: string;

  @IsOptional()
  @IsString()
  language?: string;

  @IsOptional()
  @IsInt()
  @Min(30)
  expirySeconds?: number;

  @IsOptional()
  @IsInt()
  @Min(10)
  resendCooldownSeconds?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxAttempts?: number;
}

class SaveNotifyDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  reminder1Days?: number;

  @IsOptional()
  @IsBoolean()
  reminder1Enabled?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  reminder2Days?: number;

  @IsOptional()
  @IsBoolean()
  reminder2Enabled?: boolean;

  @IsOptional()
  @IsBoolean()
  expiredEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  paymentEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  activatedEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  renewalEnabled?: boolean;
}

class SaveTemplateDto {
  @IsEnum(OfficialNotificationType)
  type!: OfficialNotificationType;

  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  language?: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

class TestDto {
  @IsOptional()
  @IsString()
  to?: string;
}

@ApiTags('Admin Official WhatsApp')
@ApiBearerAuth()
@UseGuards(AdminJwtGuard, AdminRolesGuard)
@Controller('admin/whatsapp-system')
export class OfficialWhatsAppAdminController {
  constructor(
    private readonly sender: OfficialWhatsAppSenderService,
    private readonly otp: OfficialWhatsAppOtpService,
    private readonly notify: OfficialWhatsAppNotificationService,
  ) {}

  @Get()
  @RequireAdminRoles(AdminRole.SUPER_ADMIN, AdminRole.DEVELOPER)
  overview() {
    return this.sender.getPublicStatus();
  }

  @Patch('sender')
  @RequireAdminRoles(AdminRole.SUPER_ADMIN)
  saveSender(@Body() dto: SaveSenderDto) {
    return this.sender.save(dto);
  }

  @Post('sender/enable')
  @RequireAdminRoles(AdminRole.SUPER_ADMIN)
  enable(@Body('enabled') enabled: boolean) {
    return this.sender.setEnabled(Boolean(enabled));
  }

  @Post('sender/disconnect')
  @RequireAdminRoles(AdminRole.SUPER_ADMIN)
  disconnect() {
    return this.sender.disconnect();
  }

  @Post('sender/test')
  @RequireAdminRoles(AdminRole.SUPER_ADMIN, AdminRole.DEVELOPER)
  test(@Body() dto: TestDto) {
    return this.sender.testConnection(dto.to);
  }

  @Get('otp')
  @RequireAdminRoles(AdminRole.SUPER_ADMIN, AdminRole.DEVELOPER)
  otpConfig() {
    return this.otp.getConfig();
  }

  @Patch('otp')
  @RequireAdminRoles(AdminRole.SUPER_ADMIN)
  saveOtp(@Body() dto: SaveOtpDto) {
    return this.otp.saveConfig(dto);
  }

  @Get('subscription-notifications')
  @RequireAdminRoles(AdminRole.SUPER_ADMIN, AdminRole.BILLING_MANAGER, AdminRole.DEVELOPER)
  notifyConfig() {
    return this.notify.getConfig();
  }

  @Patch('subscription-notifications')
  @RequireAdminRoles(AdminRole.SUPER_ADMIN, AdminRole.BILLING_MANAGER)
  saveNotify(@Body() dto: SaveNotifyDto) {
    return this.notify.saveConfig(dto);
  }

  @Get('templates')
  @RequireAdminRoles(AdminRole.SUPER_ADMIN, AdminRole.DEVELOPER)
  templates() {
    return this.notify.listTemplates();
  }

  @Patch('templates')
  @RequireAdminRoles(AdminRole.SUPER_ADMIN)
  saveTemplate(@Body() dto: SaveTemplateDto) {
    return this.notify.upsertTemplate(dto);
  }

  @Get('logs')
  @RequireAdminRoles(AdminRole.SUPER_ADMIN, AdminRole.SUPPORT_AGENT, AdminRole.BILLING_MANAGER, AdminRole.DEVELOPER)
  logs(@Query('skip') skip?: string, @Query('take') take?: string) {
    return this.notify.listLogs(skip ? Number(skip) : 0, take ? Number(take) : 50);
  }

  @Post('cron/run')
  @RequireAdminRoles(AdminRole.SUPER_ADMIN)
  runCron() {
    return this.notify.processDueNotifications();
  }

  @Post('notify/:subscriptionId/:type')
  @RequireAdminRoles(AdminRole.SUPER_ADMIN, AdminRole.BILLING_MANAGER)
  notifyOne(@Param('subscriptionId') subscriptionId: string, @Param('type') type: OfficialNotificationType) {
    return this.notify.notifyPayment(subscriptionId, type);
  }
}
