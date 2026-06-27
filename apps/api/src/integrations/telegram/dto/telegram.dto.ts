import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, MinLength } from 'class-validator';

export class TelegramConnectDto {
  @ApiProperty({ description: 'Bot token from @BotFather' })
  @IsString()
  @MinLength(20)
  botToken!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  name?: string;
}

export class TelegramDisconnectDto {
  @ApiProperty()
  @IsString()
  channelId!: string;
}
