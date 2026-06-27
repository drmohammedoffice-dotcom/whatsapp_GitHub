import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { ChannelProvider, ConversationStatus } from '@watsapp/database';
import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class ConversationQueryDto {
  @IsOptional()
  @IsEnum(ConversationStatus)
  status?: ConversationStatus;

  @IsOptional()
  @IsEnum(ChannelProvider)
  provider?: ChannelProvider;

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
  @IsBoolean()
  archived?: boolean;

  @IsOptional()
  @IsBoolean()
  unread?: boolean;

  @IsOptional()
  @IsBoolean()
  read?: boolean;

  @IsOptional()
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
  @IsBoolean()
  voiceNote?: boolean;

  @ApiProperty({ required: false, description: 'Send image/webp as sticker' })
  @IsOptional()
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
