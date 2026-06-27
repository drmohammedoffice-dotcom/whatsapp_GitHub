import { Controller, Get, Post, Body, Query, UseGuards, UseInterceptors, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiSecurity, ApiTags } from '@nestjs/swagger';
import { ApiKeyGuard } from '../api-keys/api-key.guard';
import { CurrentPrincipal } from '../common/current-principal.decorator';
import { AuthenticatedPrincipal } from '../common/principal';
import { UploadedMediaFile } from '../common/uploaded-media-file';
import { SendContactDto, SendLocationDto, SendMediaDto, SendMessageDto } from './dto/send-message.dto';
import { MessagingService } from './messaging.service';

@ApiTags('Messaging API')
@ApiSecurity('api-key')
@UseGuards(ApiKeyGuard)
@Controller()
export class MessagingController {
  constructor(private readonly messaging: MessagingService) {}

  @Post('send-message')
  sendMessage(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Body() dto: SendMessageDto) {
    return this.messaging.sendText(principal.teamId, dto);
  }

  @Post('send-image')
  @UseInterceptors(FileInterceptor('file'))
  sendImage(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Body() dto: SendMediaDto, @UploadedFile() file: UploadedMediaFile) {
    return this.messaging.sendMedia(principal.teamId, 'IMAGE', dto, file);
  }

  @Post('send-document')
  @UseInterceptors(FileInterceptor('file'))
  sendDocument(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Body() dto: SendMediaDto, @UploadedFile() file: UploadedMediaFile) {
    return this.messaging.sendMedia(principal.teamId, 'DOCUMENT', dto, file);
  }

  @Post('send-audio')
  @UseInterceptors(FileInterceptor('file'))
  sendAudio(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Body() dto: SendMediaDto, @UploadedFile() file: UploadedMediaFile) {
    return this.messaging.sendMedia(principal.teamId, 'AUDIO', dto, file);
  }

  @Post('send-video')
  @UseInterceptors(FileInterceptor('file'))
  sendVideo(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Body() dto: SendMediaDto, @UploadedFile() file: UploadedMediaFile) {
    return this.messaging.sendMedia(principal.teamId, 'VIDEO', dto, file);
  }

  @Post('send-location')
  sendLocation(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Body() dto: SendLocationDto) {
    return this.messaging.sendLocation(principal.teamId, dto);
  }

  @Post('send-contact')
  sendContact(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Body() dto: SendContactDto) {
    return this.messaging.sendContact(principal.teamId, dto);
  }

  @Get('messages')
  messages(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Query('chatId') chatId?: string) {
    return this.messaging.messages(principal.teamId, chatId);
  }

  @Get('chats')
  chats(@CurrentPrincipal() principal: AuthenticatedPrincipal) {
    return this.messaging.chats(principal.teamId);
  }
}
