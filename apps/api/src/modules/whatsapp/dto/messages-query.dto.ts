import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { SessionIdQueryDto } from './session-id.dto';

export class MessagesQueryDto extends SessionIdQueryDto {
  @ApiPropertyOptional({ description: 'Filter by chat ID' })
  @IsString()
  @IsOptional()
  chatId?: string;
}
