import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Permission } from '@watsapp/database';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { CurrentPrincipal } from '../../common/current-principal.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { AuthenticatedPrincipal } from '../../common/principal';
import { TelegramConnectDto, TelegramDisconnectDto } from './dto/telegram.dto';
import { TelegramService } from './telegram.service';

@ApiTags('Telegram')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('telegram')
export class TelegramController {
  constructor(private readonly telegram: TelegramService) {}

  @Post('connect')
  @RequirePermissions(Permission.SETTINGS_MANAGE)
  connect(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Body() dto: TelegramConnectDto) {
    return this.telegram.connect(principal.teamId, dto);
  }

  @Post('disconnect')
  @RequirePermissions(Permission.SETTINGS_MANAGE)
  disconnect(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Body() dto: TelegramDisconnectDto) {
    return this.telegram.disconnect(principal.teamId, dto.channelId);
  }
}

@ApiTags('Telegram Webhooks')
@Controller('telegram/webhook')
export class TelegramWebhookController {
  constructor(private readonly telegram: TelegramService) {}

  @Post(':channelId')
  receive(@Param('channelId') channelId: string, @Body() body: Record<string, unknown>) {
    return this.telegram.handleWebhook(channelId, body);
  }
}
