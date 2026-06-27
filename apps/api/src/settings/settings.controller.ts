import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Permission } from '@watsapp/database';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { CurrentPrincipal } from '../common/current-principal.decorator';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { AuthenticatedPrincipal } from '../common/principal';
import { UpsertSettingDto } from './dto/setting.dto';
import { SettingsService } from './settings.service';

@ApiTags('Settings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('settings')
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Get()
  @RequirePermissions(Permission.SETTINGS_MANAGE)
  list(@CurrentPrincipal() principal: AuthenticatedPrincipal) { return this.settings.list(principal.teamId); }

  @Post()
  @RequirePermissions(Permission.SETTINGS_MANAGE)
  upsert(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Body() dto: UpsertSettingDto) { return this.settings.upsert(principal.teamId, dto); }
}
