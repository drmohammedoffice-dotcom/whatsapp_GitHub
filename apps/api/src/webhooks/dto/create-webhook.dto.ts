import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsEnum, IsOptional, IsString, IsUrl } from 'class-validator';

enum WebhookEventDto {
  INCOMING_MESSAGE = 'INCOMING_MESSAGE',
  DELIVERY_STATUS = 'DELIVERY_STATUS',
  READ_STATUS = 'READ_STATUS',
  TYPING = 'TYPING',
  PRESENCE = 'PRESENCE',
  CONVERSATION_CREATED = 'CONVERSATION_CREATED',
  CONVERSATION_UPDATED = 'CONVERSATION_UPDATED',
  CONVERSATION_ASSIGNED = 'CONVERSATION_ASSIGNED',
  CONVERSATION_MESSAGE_CREATED = 'CONVERSATION_MESSAGE_CREATED',
  CONTACT_UPDATED = 'CONTACT_UPDATED',
}

export class CreateWebhookDto {
  @ApiProperty()
  @IsUrl({ require_tld: false })
  url!: string;

  @ApiProperty({ enum: WebhookEventDto, isArray: true })
  @IsArray()
  @IsEnum(WebhookEventDto, { each: true })
  events!: WebhookEventDto[];

  @ApiProperty({ required: false })
  @IsBoolean()
  @IsOptional()
  enabled?: boolean;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  secret?: string;
}
