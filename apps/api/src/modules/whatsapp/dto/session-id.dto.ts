import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class SessionIdDto {
  @ApiProperty({ description: 'WhatsApp session ID' })
  @IsString()
  sessionId!: string;
}

export class SessionIdQueryDto {
  @ApiProperty({ description: 'WhatsApp session ID' })
  @IsString()
  sessionId!: string;
}
