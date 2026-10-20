import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentWebmail } from './current-webmail.decorator';
import { WebmailAuthGuard } from './webmail-auth.guard';
import { WebmailService, type WebmailJwtPayload } from './webmail.service';

@ApiTags('Webmail')
@Controller('webmail')
export class WebmailController {
  constructor(private readonly webmail: WebmailService) {}

  @Post('login')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiOperation({ summary: 'تسجيل دخول صندوق بريد ChatLoora' })
  login(@Body() body: { email: string; password: string }) {
    return this.webmail.login(body.email ?? '', body.password ?? '');
  }

  @Get('me')
  @ApiBearerAuth()
  @UseGuards(WebmailAuthGuard)
  me(@CurrentWebmail() session: WebmailJwtPayload) {
    return this.webmail.me(session);
  }

  @Get('folders')
  @ApiBearerAuth()
  @UseGuards(WebmailAuthGuard)
  folders(@CurrentWebmail() session: WebmailJwtPayload) {
    return this.webmail.folders(session);
  }

  @Get('messages')
  @ApiBearerAuth()
  @UseGuards(WebmailAuthGuard)
  messages(
    @CurrentWebmail() session: WebmailJwtPayload,
    @Query('folder') folder?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.webmail.messages(
      session,
      folder,
      page ? Number(page) : 1,
      pageSize ? Number(pageSize) : 40,
    );
  }

  @Get('messages/:id')
  @ApiBearerAuth()
  @UseGuards(WebmailAuthGuard)
  message(
    @CurrentWebmail() session: WebmailJwtPayload,
    @Param('id') id: string,
    @Query('folder') folder?: string,
  ) {
    return this.webmail.message(session, folder || 'INBOX', id);
  }

  @Delete('messages/:id')
  @ApiBearerAuth()
  @UseGuards(WebmailAuthGuard)
  deleteMessage(
    @CurrentWebmail() session: WebmailJwtPayload,
    @Param('id') id: string,
    @Query('folder') folder?: string,
  ) {
    return this.webmail.deleteMessage(session, folder || 'INBOX', id);
  }

  @Post('send')
  @ApiBearerAuth()
  @UseGuards(WebmailAuthGuard)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  send(
    @CurrentWebmail() session: WebmailJwtPayload,
    @Body()
    body: { to: string; cc?: string; bcc?: string; subject: string; text?: string; html?: string },
  ) {
    return this.webmail.send(session, body);
  }
}
