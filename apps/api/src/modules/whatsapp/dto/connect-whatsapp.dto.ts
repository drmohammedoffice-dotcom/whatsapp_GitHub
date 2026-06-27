import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class ConnectWhatsAppDto {
  @ApiPropertyOptional({ description: 'Optional display name for the session' })
  @IsString()
  @IsOptional()
  displayName?: string;

  @ApiPropertyOptional({ description: 'Existing session ID to reconnect' })
  @IsString()
  @IsOptional()
  sessionId?: string;
}
