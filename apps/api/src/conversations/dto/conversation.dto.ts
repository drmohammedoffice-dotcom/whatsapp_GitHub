import { Transform, Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { ChannelProvider, ConversationStatus, ConversationKind } from '@watsapp/database';
import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

/**
 * Query strings and multipart form fields arrive as strings ("true"/"false").
 * The global ValidationPipe does not enable implicit conversion, so coerce
 * boolean-ish values here before @IsBoolean validation runs.
 */
const toBoolean = ({ value }: { value: unknown }) =>
  value === true || value === 'true' || value === '1' ? true : value === false || value === 'false' || value === '0' ? false : value;

export class ConversationQueryDto {
  @IsOptional()
  @IsEnum(ConversationStatus)
  status?: ConversationStatus;

  @IsOptional()
  @IsEnum(ChannelProvider)
  provider?: ChannelProvider;

  @IsOptional()
  @IsEnum(ConversationKind)
  kind?: ConversationKind;

  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  social?: boolean;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  assigneeUserId?: string;

  @IsOptional()
  @IsString()
  labelId?: string;

  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  archived?: boolean;

  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  unread?: boolean;

  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  read?: boolean;

  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  pinned?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  limit?: number;
}

export class ReplyDto {
  @ApiProperty()
  @IsString()
  text!: string;
}

export class ReplyMediaDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  caption?: string;

  @ApiProperty({ required: false, description: 'Send audio as WhatsApp voice note (ptt)' })
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  voiceNote?: boolean;

  @ApiProperty({ required: false, description: 'Send image/webp as sticker' })
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  asSticker?: boolean;
}

export class AssignConversationDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  assigneeUserId?: string;
}

export class UpdateConversationStatusDto {
  @ApiProperty({ enum: ConversationStatus })
  @IsEnum(ConversationStatus)
  status!: ConversationStatus;
}

export class ToggleDto {
  @ApiProperty()
  @IsBoolean()
  value!: boolean;
}

export class TextBodyDto {
  @ApiProperty()
  @IsString()
  body!: string;
}

export class TagConversationDto {
  @ApiProperty()
  @IsString()
  labelId!: string;
}
