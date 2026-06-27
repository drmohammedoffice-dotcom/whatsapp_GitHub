import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class CreateSessionDto {
  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  displayName?: string;
}
