import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';

export class ConnectWhatsAppDto {
  @ApiPropertyOptional({ description: 'Optional display name for the session' })
  @IsString()
  @IsOptional()
  displayName?: string;

  @ApiPropertyOptional({ description: 'Existing session ID to reconnect' })
  @IsString()
  @IsOptional()
  sessionId?: string;

  @ApiPropertyOptional({ description: 'Channel purpose: inbox (default) or tracking-only for TikTok pixels' })
  @IsIn(['inbox', 'tracking'])
  @IsOptional()
  purpose?: 'inbox' | 'tracking';

  @ApiPropertyOptional({ description: 'TikTok integration ID when purpose is tracking' })
  @IsString()
  @IsOptional()
  integrationId?: string;
}
