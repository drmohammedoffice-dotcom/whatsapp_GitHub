import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Permission } from '@watsapp/database';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { CurrentPrincipal } from '../../common/current-principal.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { AuthenticatedPrincipal } from '../../common/principal';
import { ConnectWhatsAppDto } from './dto/connect-whatsapp.dto';
import { CreateSessionDto } from './dto/create-session.dto';
import { MessagesQueryDto } from './dto/messages-query.dto';
import { SessionIdDto, SessionIdQueryDto } from './dto/session-id.dto';
import { WhatsAppService } from './whatsapp.service';

@ApiTags('WhatsApp Connection')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermissions(Permission.SETTINGS_MANAGE)
@Controller('whatsapp')
export class WhatsAppController {
  constructor(private readonly whatsapp: WhatsAppService) {}

  @Post('connect')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Create or start a WhatsApp connection and generate QR' })
  @ApiResponse({ status: 201, description: 'Connection started' })
  connect(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Body() dto: ConnectWhatsAppDto) {
    return this.whatsapp.connect(principal.teamId, principal.userId, dto.displayName, dto.sessionId);
  }

  @Get('qr')
  @ApiOperation({ summary: 'Get current QR code for a session' })
  @ApiQuery({ name: 'sessionId', required: true })
  getQr(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Query() query: SessionIdQueryDto) {
    return this.whatsapp.getQr(principal.teamId, query.sessionId);
  }

  @Get('status')
  @ApiOperation({ summary: 'Get WhatsApp session connection status' })
  @ApiQuery({ name: 'sessionId', required: true })
  getStatus(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Query() query: SessionIdQueryDto) {
    return this.whatsapp.getStatus(principal.teamId, query.sessionId);
  }

  @Post('disconnect')
  @ApiOperation({ summary: 'Disconnect an active WhatsApp session' })
  disconnect(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Body() dto: SessionIdDto) {
    return this.whatsapp.disconnect(principal.teamId, dto.sessionId, principal.userId);
  }

  @Post('reconnect')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Reconnect a WhatsApp session' })
  reconnect(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Body() dto: SessionIdDto) {
    return this.whatsapp.reconnect(principal.teamId, dto.sessionId, principal.userId);
  }

  @Delete('session')
  @ApiOperation({ summary: 'Delete a WhatsApp session and purge credentials' })
  deleteSession(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Body() dto: SessionIdDto) {
    return this.whatsapp.deleteSession(principal.teamId, dto.sessionId, principal.userId);
  }

  @Get('profile')
  @ApiOperation({ summary: 'Get connected WhatsApp profile' })
  @ApiQuery({ name: 'sessionId', required: true })
  getProfile(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Query() query: SessionIdQueryDto) {
    return this.whatsapp.getProfile(principal.teamId, query.sessionId);
  }

  @Get('chats')
  @ApiOperation({ summary: 'List chats for a WhatsApp session' })
  @ApiQuery({ name: 'sessionId', required: true })
  getChats(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Query() query: SessionIdQueryDto) {
    return this.whatsapp.getChats(principal.teamId, query.sessionId);
  }

  @Get('messages')
  @ApiOperation({ summary: 'List messages for a WhatsApp session' })
  getMessages(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Query() query: MessagesQueryDto) {
    return this.whatsapp.getMessages(principal.teamId, query.sessionId, query.chatId);
  }

  @Get('connection-logs')
  @ApiOperation({ summary: 'Audit connection logs for a session' })
  @ApiQuery({ name: 'sessionId', required: true })
  getConnectionLogs(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Query() query: SessionIdQueryDto) {
    return this.whatsapp.getConnectionLogs(principal.teamId, query.sessionId);
  }
}

@ApiTags('WhatsApp Sessions (Legacy)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermissions(Permission.SETTINGS_MANAGE)
@Controller('whatsapp/sessions')
export class WhatsAppSessionsController {
  constructor(private readonly whatsapp: WhatsAppService) {}

  @Get()
  @ApiOperation({ summary: 'List WhatsApp sessions (legacy)' })
  list(@CurrentPrincipal() principal: AuthenticatedPrincipal) {
    return this.whatsapp.list(principal.teamId, principal.userId);
  }

  @Post()
  @ApiOperation({ summary: 'Create WhatsApp session (legacy)' })
  create(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Body() dto: CreateSessionDto) {
    return this.whatsapp.create(principal.teamId, dto.displayName, principal.userId);
  }

  @Post(':id/connect')
  connect(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Param('id') id: string) {
    return this.whatsapp.connect(principal.teamId, principal.userId, undefined, id);
  }

  @Post(':id/reconnect')
  reconnect(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Param('id') id: string) {
    return this.whatsapp.reconnect(principal.teamId, id, principal.userId);
  }

  @Delete(':id')
  disconnect(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Param('id') id: string) {
    return this.whatsapp.disconnect(principal.teamId, id, principal.userId);
  }
}
