import { ApiProperty } from '@nestjs/swagger';
import { IsLatitude, IsLongitude, IsOptional, IsString } from 'class-validator';

export class SendMessageDto {
  @ApiProperty()
  @IsString()
  to!: string;

  @ApiProperty()
  @IsString()
  text!: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  sessionId?: string;
}

export class SendMediaDto {
  @ApiProperty()
  @IsString()
  to!: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  caption?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  sessionId?: string;
}

export class SendLocationDto {
  @ApiProperty()
  @IsString()
  to!: string;

  @ApiProperty()
  @IsLatitude()
  latitude!: number;

  @ApiProperty()
  @IsLongitude()
  longitude!: number;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  sessionId?: string;
}

export class SendContactDto {
  @ApiProperty()
  @IsString()
  to!: string;

  @ApiProperty()
  @IsString()
  displayName!: string;

  @ApiProperty()
  @IsString()
  phoneNumber!: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  sessionId?: string;
}
