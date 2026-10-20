import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentPrincipal } from '../common/current-principal.decorator';
import { AuthenticatedPrincipal } from '../common/principal';
import { UploadedMediaFile } from '../common/uploaded-media-file';
import { AssistantChatService } from './assistant-chat.service';
import { AssistantRealtimeService } from './assistant-realtime.service';

class ChatDto {
  @IsOptional()
  @IsString()
  conversationId?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  content!: string;
}

class SpeechDto {
  @IsString()
  @MinLength(1)
  @MaxLength(800)
  text!: string;
}

class FeedbackDto {
  @IsBoolean()
  helpful!: boolean;
}

class VoiceSessionDto {
  @IsOptional()
  @IsString()
  conversationId?: string;

  @IsOptional()
  @IsString()
  voice?: string;

  @IsOptional()
  @IsString()
  language?: string;
}

class VoiceSdpDto {
  @IsString()
  @MinLength(10)
  sdp!: string;
}

class VoiceToolDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  arguments?: string;

  @IsOptional()
  @IsString()
  callId?: string;
}

class VoiceEndDto {
  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  summary?: string;
}

@ApiTags('Chatloora Assistant')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('assistant')
export class AssistantController {
  constructor(
    private readonly chat: AssistantChatService,
    private readonly realtime: AssistantRealtimeService,
  ) {}

  @Get('config')
  async config() {
    const [base, voice] = await Promise.all([this.chat.publicConfig(), this.realtime.publicVoiceConfig()]);
    return { ...base, voice };
  }

  @Get('conversations')
  list(@CurrentPrincipal() principal: AuthenticatedPrincipal) {
    return this.chat.listConversations(principal.teamId, principal.userId!);
  }

  @Get('conversations/:id')
  get(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Param('id') id: string) {
    return this.chat.getConversation(principal.teamId, principal.userId!, id);
  }

  @Delete('conversations/:id')
  remove(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Param('id') id: string) {
    return this.chat.deleteConversation(principal.teamId, principal.userId!, id);
  }

  @Get('messages/:id/media')
  async media(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Param('id') id: string) {
    const file = await this.chat.openMedia(principal.teamId, principal.userId!, id);
    return new StreamableFile(file.stream, { type: file.mime });
  }

  @Post('chat')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  send(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Body() body: ChatDto) {
    return this.chat.chat(principal.teamId, principal.userId!, body);
  }

  @Post('chat/media')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  @Throttle({ default: { limit: 12, ttl: 60_000 } })
  sendMedia(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @UploadedFile() file: UploadedMediaFile | undefined,
    @Body() body: { conversationId?: string; content?: string },
  ) {
    if (!file) throw new BadRequestException('File is required');
    return this.chat.chat(principal.teamId, principal.userId!, {
      conversationId: body.conversationId,
      content: body.content,
      file,
    });
  }

  @Post('speech')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async speech(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Body() body: SpeechDto) {
    const buffer = await this.chat.speech(principal.teamId, body.text);
    return new StreamableFile(buffer, { type: 'audio/mpeg' });
  }

  @Post('messages/:id/feedback')
  feedback(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('id') id: string,
    @Body() body: FeedbackDto,
  ) {
    return this.chat.feedback(principal.teamId, principal.userId!, id, body.helpful);
  }

  @Post('voice/session')
  @Throttle({ default: { limit: 8, ttl: 60_000 } })
  createVoiceSession(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Body() body: VoiceSessionDto) {
    return this.realtime.createSession(principal.teamId, principal.userId!, body);
  }

  @Post('voice/session/:id/sdp')
  @Throttle({ default: { limit: 12, ttl: 60_000 } })
  connectVoice(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('id') id: string,
    @Body() body: VoiceSdpDto,
  ) {
    return this.realtime.connectSdp(principal.teamId, principal.userId!, id, body.sdp);
  }

  @Post('voice/session/:id/tools')
  @Throttle({ default: { limit: 40, ttl: 60_000 } })
  voiceTool(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('id') id: string,
    @Body() body: VoiceToolDto,
  ) {
    return this.realtime.runTool(principal.teamId, principal.userId!, id, body);
  }

  @Post('voice/session/:id/events')
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  voiceEvents(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('id') id: string,
    @Body() body: { event?: Record<string, unknown>; usage?: unknown },
  ) {
    return this.realtime.ingest(principal.teamId, principal.userId!, id, body);
  }

  @Post('voice/session/:id/end')
  endVoice(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('id') id: string,
    @Body() body: VoiceEndDto,
  ) {
    return this.realtime.endSession(principal.teamId, principal.userId!, id, body);
  }
}
