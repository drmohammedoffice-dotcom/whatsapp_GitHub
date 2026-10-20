import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { IsString, MinLength } from 'class-validator';
import { WhatsAppCloudService } from './whatsapp-cloud.service';

class PublicSendDto {
  @IsString()
  @MinLength(8)
  to!: string;

  @IsString()
  @MinLength(1)
  body!: string;
}

/**
 * Public endpoints for Meta App Review of whatsapp_business_messaging.
 * Shows API Setup cURL on the website and sends a Cloud API test message from ChatLoora.
 */
@ApiTags('WhatsApp Cloud Public')
@Controller('public/whatsapp-cloud')
export class WhatsAppCloudPublicController {
  constructor(private readonly cloud: WhatsAppCloudService) {}

  @Get('setup')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @ApiOperation({ summary: 'Meta API Setup cURL + Cloud API config for App Review' })
  setup() {
    return this.cloud.getPublicApiSetup();
  }

  @Post('send')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Send WhatsApp Cloud API test message (Meta App Review demo)' })
  send(@Body() dto: PublicSendDto) {
    return this.cloud.sendPublicTestMessage(dto.to, dto.body);
  }
}
