import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length, Matches } from 'class-validator';

export class VerifyOtpDto {
  @ApiProperty()
  @IsString()
  verificationId!: string;

  @ApiProperty({ minLength: 6, maxLength: 6 })
  @IsString()
  @Length(6, 6)
  @Matches(/^\d{6}$/)
  code!: string;
}

export class ResendOtpDto {
  @ApiProperty()
  @IsString()
  verificationId!: string;
}
