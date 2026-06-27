import { ApiProperty } from '@nestjs/swagger';
import { ChannelProvider } from '@watsapp/database';
import { IsEnum, IsOptional, IsString, MinLength } from 'class-validator';

export class MetaConnectDto {
  @ApiProperty({ enum: [ChannelProvider.META_MESSENGER, ChannelProvider.META_INSTAGRAM] })
  @IsEnum(ChannelProvider)
  provider!: ChannelProvider;

  @ApiProperty({ description: 'Facebook Page ID connected to Messenger or Instagram' })
  @IsString()
  @MinLength(3)
  pageId!: string;

  @ApiProperty({ description: 'Long-lived Page Access Token from Meta Business' })
  @IsString()
  @MinLength(20)
  pageAccessToken!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  name?: string;
}

export class MetaDisconnectDto {
  @ApiProperty()
  @IsString()
  channelId!: string;
}
