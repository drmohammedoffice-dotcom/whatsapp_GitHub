import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Permission } from '@watsapp/database';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { CurrentPrincipal } from '../../common/current-principal.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { AuthenticatedPrincipal } from '../../common/principal';
import {
  TelegramUserDisconnectDto,
  TelegramUserSendCodeDto,
  TelegramUserSyncDto,
  TelegramUserVerifyCodeDto,
  TelegramUserVerifyPasswordDto,
} from './dto/telegram-user.dto';
import { TelegramUserAuthService } from './telegram-user-auth.service';
import { TelegramUserService } from './telegram-user.service';

@ApiTags('Telegram User (MTProto)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('telegram-user')
export class TelegramUserController {
  constructor(
    private readonly telegram: TelegramUserService,
    private readonly auth: TelegramUserAuthService,
  ) {}

  @Get('status')
  @RequirePermissions(Permission.SETTINGS_MANAGE)
  status(@CurrentPrincipal() principal: AuthenticatedPrincipal) {
    return this.telegram.getStatus(principal.teamId);
  }

  @Post('auth/send-code')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @RequirePermissions(Permission.SETTINGS_MANAGE)
  @ApiOperation({ summary: 'Send Telegram verification code to phone (MTProto)' })
  sendCode(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Body() dto: TelegramUserSendCodeDto) {
    return this.auth.sendCode(principal.teamId, principal.userId!, dto.phoneNumber);
  }

  @Post('auth/verify-code')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @RequirePermissions(Permission.SETTINGS_MANAGE)
  verifyCode(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Body() dto: TelegramUserVerifyCodeDto) {
    return this.auth.verifyCode(principal.teamId, principal.userId!, dto.authId, dto.code);
  }

  @Post('auth/verify-password')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @RequirePermissions(Permission.SETTINGS_MANAGE)
  verifyPassword(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Body() dto: TelegramUserVerifyPasswordDto) {
    return this.auth.verifyPassword(principal.teamId, principal.userId!, dto.authId, dto.password);
  }

  @Post('disconnect')
  @RequirePermissions(Permission.SETTINGS_MANAGE)
  disconnect(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Body() dto: TelegramUserDisconnectDto) {
    return this.telegram.disconnect(principal.teamId, dto.connectionId);
  }

  @Post('reconnect')
  @RequirePermissions(Permission.SETTINGS_MANAGE)
  async reconnect(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Body() dto: TelegramUserDisconnectDto) {
    await this.telegram.restoreConnection(dto.connectionId);
    return { reconnected: true };
  }

  @Post('sync')
  @RequirePermissions(Permission.SETTINGS_MANAGE)
  sync(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Body() dto: TelegramUserSyncDto) {
    return this.telegram.syncChats(principal.teamId, dto.connectionId);
  }
}
