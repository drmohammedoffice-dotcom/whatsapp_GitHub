import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class TelegramUserSendCodeDto {
  @ApiProperty({ example: '+9647XXXXXXXX' })
  @IsString()
  @MinLength(8)
  phoneNumber!: string;
}

export class TelegramUserVerifyCodeDto {
  @ApiProperty()
  @IsString()
  authId!: string;

  @ApiProperty()
  @IsString()
  @MinLength(4)
  code!: string;
}

export class TelegramUserVerifyPasswordDto {
  @ApiProperty()
  @IsString()
  authId!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  password!: string;
}

export class TelegramUserDisconnectDto {
  @ApiProperty()
  @IsString()
  connectionId!: string;
}

export class TelegramUserSyncDto {
  @ApiProperty()
  @IsString()
  connectionId!: string;
}
