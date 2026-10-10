import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Permission } from '@watsapp/database';
import { IsOptional, IsString, MinLength } from 'class-validator';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { CurrentPrincipal } from '../../common/current-principal.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { AuthenticatedPrincipal } from '../../common/principal';
import { WhatsAppCloudService } from './whatsapp-cloud.service';

class CreateWhatsAppCloudDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsString()
  phoneNumber!: string;

  @IsString()
  phoneNumberId!: string;

  @IsString()
  wabaId!: string;

  @IsString()
  @MinLength(20)
  accessToken!: string;

  @IsOptional()
  @IsString()
  verifyToken?: string;

  @IsOptional()
  @IsString()
  businessId?: string;

  @IsOptional()
  @IsString()
  aiAgentId?: string;

  @IsOptional()
  @IsString()
  defaultInboxLabel?: string;
}

class SendCloudMessageDto {
  @IsString()
  @MinLength(8)
  to!: string;

  @IsString()
  @MinLength(1)
  body!: string;
}

class EmbeddedSignupDto {
  @IsString()
  @MinLength(10)
  code!: string;

  @IsOptional()
  @IsString()
  wabaId?: string;

  @IsOptional()
  @IsString()
  phoneNumberId?: string;

  @IsOptional()
  @IsString()
  businessId?: string;

  @IsOptional()
  @IsString()
  name?: string;
}

class ConnectSharedWabaDto {
  @IsOptional()
  @IsString()
  wabaId?: string;

  @IsOptional()
  @IsString()
  phoneNumberId?: string;

  @IsOptional()
  @IsString()
  businessId?: string;

  @IsOptional()
  @IsString()
  name?: string;

  /** Customer Cloud API token only — never the Chatloora official sender token. */
  @IsOptional()
  @IsString()
  @MinLength(20)
  accessToken?: string;
}

@ApiTags('WhatsApp Cloud')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('whatsapp-cloud')
export class WhatsAppCloudController {
  constructor(private readonly cloud: WhatsAppCloudService) {}

  @Get('accounts')
  @RequirePermissions(Permission.SETTINGS_MANAGE)
  list(@CurrentPrincipal() p: AuthenticatedPrincipal) {
    return this.cloud.list(p.teamId);
  }

  @Post('accounts')
  @RequirePermissions(Permission.SETTINGS_MANAGE)
  create(@CurrentPrincipal() p: AuthenticatedPrincipal, @Body() dto: CreateWhatsAppCloudDto) {
    return this.cloud.create(p.teamId, dto);
  }

  @Post('accounts/:id/disconnect')
  @RequirePermissions(Permission.SETTINGS_MANAGE)
  disconnect(@CurrentPrincipal() p: AuthenticatedPrincipal, @Param('id') id: string) {
    return this.cloud.disconnect(p.teamId, id);
  }

  @Post('accounts/:id/ai-agent')
  @RequirePermissions(Permission.WHATSAPP_CLOUD_MANAGE)
  assignAi(
    @CurrentPrincipal() p: AuthenticatedPrincipal,
    @Param('id') id: string,
    @Body('aiAgentId') aiAgentId: string | null,
  ) {
    return this.cloud.assignAiAgent(p.teamId, id, aiAgentId);
  }

  @Post('accounts/:id/test')
  @RequirePermissions(Permission.SETTINGS_MANAGE)
  @ApiOperation({ summary: 'Validate customer WhatsApp Cloud API credentials without sending a message' })
  test(@CurrentPrincipal() p: AuthenticatedPrincipal, @Param('id') id: string) {
    return this.cloud.testAccountConnection(p.teamId, id);
  }

  @Post('accounts/:id/send')
  @RequirePermissions(Permission.WHATSAPP_CLOUD_MANAGE)
  @ApiOperation({ summary: 'Send a WhatsApp Cloud API text message from a connected account' })
  send(
    @CurrentPrincipal() p: AuthenticatedPrincipal,
    @Param('id') id: string,
    @Body() dto: SendCloudMessageDto,
  ) {
    return this.cloud.sendAccountTestMessage(p.teamId, id, dto.to, dto.body);
  }

  @Get('connected-accounts')
  @RequirePermissions(Permission.SETTINGS_MANAGE)
  @ApiOperation({ summary: 'List connected WhatsApp Cloud API numbers for this workspace' })
  async listConnected(@CurrentPrincipal() p: AuthenticatedPrincipal) {
    const accounts = await this.cloud.list(p.teamId);
    return accounts
      .filter((a) => a.status === 'CONNECTED')
      .map((a) => ({
        id: a.id,
        name: a.name,
        phoneNumber: a.phoneNumber,
        phoneNumberId: a.phoneNumberId,
        wabaId: a.wabaId,
        status: a.status,
        connectedAt: a.connectedAt,
        webhookStatus: a.webhookStatus,
        hasAccessToken: a.hasAccessToken,
      }));
  }

  @Get('embedded-signup/config')
  @RequirePermissions(Permission.SETTINGS_MANAGE)
  @ApiOperation({ summary: 'Meta WhatsApp Embedded Signup popup configuration' })
  embeddedConfig() {
    return this.cloud.getEmbeddedSignupConfig();
  }

  @Post('embedded-signup')
  @RequirePermissions(Permission.SETTINGS_MANAGE)
  @ApiOperation({ summary: 'Complete Meta Embedded Signup — exchange code and connect Cloud API number' })
  embeddedSignup(@CurrentPrincipal() p: AuthenticatedPrincipal, @Body() dto: EmbeddedSignupDto) {
    return this.cloud.connectEmbeddedSignup(p.teamId, dto);
  }

  @Post('connect-shared')
  @RequirePermissions(Permission.SETTINGS_MANAGE)
  @ApiOperation({
    summary: 'Connect after Meta shared a WABA — requires the customer access token, never Chatloora official credentials',
  })
  connectShared(@CurrentPrincipal() p: AuthenticatedPrincipal, @Body() dto: ConnectSharedWabaDto) {
    return this.cloud.connectSharedWaba(p.teamId, dto);
  }
}
