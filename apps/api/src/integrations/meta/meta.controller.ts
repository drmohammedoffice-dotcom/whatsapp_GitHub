import { Controller, Get, Post, Body, Query, Headers, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Permission } from '@watsapp/database';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { CurrentPrincipal } from '../../common/current-principal.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { AuthenticatedPrincipal } from '../../common/principal';
import { MetaConnectDto, MetaDisconnectDto } from './dto/meta.dto';
import { MetaService } from './meta.service';

@ApiTags('Meta Channels')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('meta')
export class MetaController {
  constructor(private readonly meta: MetaService) {}

  @Get('status')
  @RequirePermissions(Permission.SETTINGS_MANAGE)
  status() {
    return { configured: this.meta.isConfigured() };
  }

  @Post('connect')
  @RequirePermissions(Permission.SETTINGS_MANAGE)
  connect(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Body() dto: MetaConnectDto) {
    return this.meta.connect(principal.teamId, dto);
  }

  @Post('disconnect')
  @RequirePermissions(Permission.SETTINGS_MANAGE)
  disconnect(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Body() dto: MetaDisconnectDto) {
    return this.meta.disconnect(principal.teamId, dto.channelId);
  }
}

@ApiTags('Meta Webhooks')
@Controller('meta/webhook')
export class MetaWebhookController {
  constructor(private readonly meta: MetaService) {}

  @Get()
  verify(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') challenge: string,
  ) {
    return this.meta.verifyWebhook(mode, token, challenge);
  }

  @Post()
  receive(@Body() body: Record<string, unknown>, @Headers('x-hub-signature-256') signature?: string) {
    return this.meta.handleWebhook(body, signature);
  }
}
