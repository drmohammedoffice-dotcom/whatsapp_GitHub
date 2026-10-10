import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Permission } from '@watsapp/database';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { CurrentPrincipal } from '../../common/current-principal.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { AuthenticatedPrincipal } from '../../common/principal';
import { TelegramConnectDto, TelegramDisconnectDto, TelegramValidateDto } from './dto/telegram.dto';
import { TelegramService } from './telegram.service';

@ApiTags('Telegram')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('telegram')
export class TelegramController {
  constructor(private readonly telegram: TelegramService) {}

  @Post('validate')
  @RequirePermissions(Permission.SETTINGS_MANAGE)
  @ApiOperation({ summary: 'Validate a Telegram bot token before connecting' })
  validate(@Body() dto: TelegramValidateDto) {
    return this.telegram.validateBotToken(dto.botToken);
  }

  @Post('connect')
  @RequirePermissions(Permission.SETTINGS_MANAGE)
  @ApiOperation({ summary: 'Connect Telegram bot and auto-configure webhook' })
  connect(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Body() dto: TelegramConnectDto) {
    return this.telegram.connect(principal.teamId, dto);
  }

  @Get(':channelId/webhook-status')
  @RequirePermissions(Permission.SETTINGS_MANAGE)
  @ApiOperation({ summary: 'Verify Telegram webhook is active' })
  webhookStatus(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('channelId') channelId: string,
  ) {
    return this.telegram.verifyWebhook(principal.teamId, channelId);
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
