import { ApiProperty } from '@nestjs/swagger';

import { ChannelProvider } from '@watsapp/database';

import { IsArray, IsEnum, IsIn, IsOptional, IsString, MinLength } from 'class-validator';



/** @deprecated Use OAuth flow instead of manual connect */

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



export class MetaOAuthStartDto {

  @ApiProperty({ enum: ['messenger', 'instagram'], required: false })

  @IsOptional()

  @IsIn(['messenger', 'instagram'])

  target?: 'messenger' | 'instagram';

}



export class MetaOAuthCompleteDto {

  @ApiProperty()

  @IsString()

  sessionId!: string;



  @ApiProperty({ type: [String] })

  @IsArray()

  @IsString({ each: true })

  pageIds!: string[];



  @ApiProperty({ type: [String], required: false })

  @IsOptional()

  @IsArray()

  @IsString({ each: true })

  instagramIds?: string[];



  @ApiProperty({ enum: ['messenger', 'instagram', 'both'], required: false })

  @IsOptional()

  @IsIn(['messenger', 'instagram', 'both'])

  mode?: 'messenger' | 'instagram' | 'both';

}

/** Instagram API with Instagram Login — connect via user access token from Meta console. */
export class InstagramLoginConnectDto {
  @ApiProperty({ description: 'Instagram user access token (IGAA…)' })
  @IsString()
  @MinLength(40)
  accessToken!: string;
}
