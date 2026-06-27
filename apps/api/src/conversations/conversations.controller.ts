import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Res, UploadedFile, UseGuards, UseInterceptors, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { Permission } from '@watsapp/database';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { CurrentPrincipal } from '../common/current-principal.decorator';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { AuthenticatedPrincipal } from '../common/principal';
import { UploadedMediaFile } from '../common/uploaded-media-file';
import { AssignConversationDto, ConversationQueryDto, ReplyDto, ReplyMediaDto, TagConversationDto, TextBodyDto, ToggleDto, UpdateConversationStatusDto } from './dto/conversation.dto';
import { ConversationsService } from './conversations.service';

@ApiTags('Inbox')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('conversations')
export class ConversationsController {
  constructor(private readonly conversations: ConversationsService) {}

  @Get()
  @RequirePermissions(Permission.INBOX_READ)
  list(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Query() query: ConversationQueryDto) {
    return this.conversations.list(principal.teamId, query);
  }

  @Get(':id')
  @RequirePermissions(Permission.INBOX_READ)
  get(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Param('id') id: string) {
    return this.conversations.get(principal.teamId, id);
  }

  @Get(':id/messages/:messageId/media')
  @RequirePermissions(Permission.INBOX_READ)
  async media(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('id') id: string,
    @Param('messageId') messageId: string,
    @Query('download') download: string | undefined,
    @Res() res: Response,
  ) {
    const media = await this.conversations.getMessageMedia(principal.teamId, id, messageId);
    res.setHeader('Content-Type', media.mimeType);
    res.setHeader('Content-Length', media.sizeBytes);
    res.setHeader('Cache-Control', 'private, max-age=86400');
    const disposition = download !== undefined ? 'attachment' : 'inline';
    res.setHeader('Content-Disposition', `${disposition}; filename="${encodeURIComponent(media.fileName)}"`);
    media.stream.pipe(res);
  }

  @Post(':id/reply')
  @RequirePermissions(Permission.INBOX_WRITE)
  reply(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Param('id') id: string, @Body() dto: ReplyDto) {
    return this.conversations.reply(principal.teamId, id, dto);
  }

  @Post(':id/reply/media')
  @RequirePermissions(Permission.INBOX_WRITE)
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  replyMedia(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('id') id: string,
    @UploadedFile() file: UploadedMediaFile,
    @Body() dto: ReplyMediaDto,
  ) {
    if (!file) throw new BadRequestException('file is required');
    return this.conversations.replyMedia(principal.teamId, id, file, dto);
  }

  @Patch(':id/assign')
  @RequirePermissions(Permission.CONVERSATION_ASSIGN)
  assign(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Param('id') id: string, @Body() dto: AssignConversationDto) {
    return this.conversations.assign(principal.teamId, id, principal.userId, dto);
  }

  @Patch(':id/status')
  @RequirePermissions(Permission.CONVERSATION_CLOSE)
  status(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Param('id') id: string, @Body() dto: UpdateConversationStatusDto) {
    return this.conversations.status(principal.teamId, id, principal.userId, dto);
  }

  @Patch(':id/archive')
  @RequirePermissions(Permission.INBOX_WRITE)
  archive(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Param('id') id: string, @Body() dto: ToggleDto) {
    return this.conversations.archive(principal.teamId, id, principal.userId, dto.value);
  }

  @Patch(':id/pin')
  @RequirePermissions(Permission.INBOX_WRITE)
  pin(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Param('id') id: string, @Body() dto: ToggleDto) {
    return this.conversations.pin(principal.teamId, id, principal.userId, dto.value);
  }

  @Patch(':id/read')
  @RequirePermissions(Permission.INBOX_WRITE)
  read(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Param('id') id: string) {
    return this.conversations.markRead(principal.teamId, id);
  }

  @Post(':id/notes')
  @RequirePermissions(Permission.INBOX_WRITE)
  note(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Param('id') id: string, @Body() dto: TextBodyDto) {
    return this.conversations.note(principal.teamId, id, principal.userId!, dto);
  }

  @Post(':id/comments')
  @RequirePermissions(Permission.INBOX_WRITE)
  comment(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Param('id') id: string, @Body() dto: TextBodyDto) {
    return this.conversations.comment(principal.teamId, id, principal.userId!, dto);
  }

  @Post(':id/tags')
  @RequirePermissions(Permission.INBOX_WRITE)
  tag(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Param('id') id: string, @Body() dto: TagConversationDto) {
    return this.conversations.tag(principal.teamId, id, principal.userId, dto);
  }

  @Delete(':id/tags/:labelId')
  @RequirePermissions(Permission.INBOX_WRITE)
  untag(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Param('id') id: string, @Param('labelId') labelId: string) {
    return this.conversations.untag(principal.teamId, id, principal.userId, labelId);
  }
}
