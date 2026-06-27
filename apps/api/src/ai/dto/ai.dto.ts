import { ApiProperty } from '@nestjs/swagger';
import { AiMemoryScope, AiProviderType, AiToolKind, AiTransferReason, AutomationActionType, AutomationTriggerType } from '@watsapp/database';
import { IsArray, IsBoolean, IsEnum, IsNumber, IsObject, IsOptional, IsString, IsUrl, Max, Min } from 'class-validator';

export class AiChatDto {
  @ApiProperty()
  @IsString()
  message!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  conversationId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  useKnowledge?: boolean;
}

export class AiTextTaskDto {
  @ApiProperty()
  @IsString()
  text!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  targetLanguage?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  tone?: string;
}

export class KnowledgeTextDto {
  @ApiProperty()
  @IsString()
  title!: string;

  @ApiProperty()
  @IsString()
  content!: string;
}

export class CrawlWebsiteDto {
  @ApiProperty()
  @IsUrl({ require_tld: false })
  url!: string;
}

export class FaqDto {
  @ApiProperty()
  @IsString()
  question!: string;

  @ApiProperty()
  @IsString()
  answer!: string;
}

export class SearchDto {
  @ApiProperty()
  @IsString()
  query!: string;
}

export class MemoryDto {
  @ApiProperty({ enum: AiMemoryScope })
  @IsEnum(AiMemoryScope)
  scope!: AiMemoryScope;

  @ApiProperty()
  @IsString()
  key!: string;

  @ApiProperty()
  @IsString()
  value!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  contactId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  conversationId?: string;
}

export class ToolDto {
  @ApiProperty()
  @IsString()
  name!: string;

  @ApiProperty()
  @IsString()
  description!: string;

  @ApiProperty({ enum: AiToolKind })
  @IsEnum(AiToolKind)
  kind!: AiToolKind;

  @ApiProperty()
  @IsObject()
  schema!: Record<string, unknown>;

  @ApiProperty()
  @IsObject()
  config!: Record<string, unknown>;
}

export class ExecuteToolDto {
  @ApiProperty()
  @IsObject()
  arguments!: Record<string, unknown>;
}

export class AiSettingsDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  autoReplyEnabled?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  confidenceThreshold?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  greetingMessage?: string | null;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  outOfOfficeMessage?: string | null;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsObject()
  businessHours?: Record<string, unknown> | null;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsArray()
  holidayReplies?: Array<{ date: string; message: string }> | null;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  transferOnLowConfidence?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  transferOnComplaint?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  transferOnRefund?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  transferOnSensitive?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  transferOnHumanRequest?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsObject()
  customTransferRules?: unknown;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  pauseAiOnHumanReply?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  pauseAiOnAssignment?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  monthlyBudgetCents?: number | null;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  systemPromptOverride?: string | null;
}

export class TransferConversationDto {
  @ApiProperty({ enum: AiTransferReason })
  @IsEnum(AiTransferReason)
  reason!: AiTransferReason;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  assigneeUserId?: string;
}

export class AutomationRuleDto {
  @ApiProperty()
  @IsString()
  name!: string;

  @ApiProperty({ enum: AutomationTriggerType })
  @IsEnum(AutomationTriggerType)
  trigger!: AutomationTriggerType;

  @ApiProperty({ enum: AutomationActionType })
  @IsEnum(AutomationActionType)
  action!: AutomationActionType;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsObject()
  conditions?: Record<string, unknown>;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  priority?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

export class AiProviderConfigDto {
  @ApiProperty({ enum: AiProviderType, required: false })
  @IsOptional()
  @IsEnum(AiProviderType)
  provider?: AiProviderType;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  apiKey?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  baseUrl?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  model?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(2)
  temperature?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(128000)
  maxTokens?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  topP?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  enableStreaming?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  enableMemory?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  enableHumanHandover?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  enableVision?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  enableProductSearch?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  enableImageSending?: boolean;
}

export class TestAiProviderDto {
  @ApiProperty({ enum: AiProviderType, required: false })
  @IsOptional()
  @IsEnum(AiProviderType)
  provider?: AiProviderType;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  apiKey?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  baseUrl?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  model?: string;
}

export class SatisfactionDto {
  @ApiProperty()
  @IsNumber()
  @Min(1)
  @Max(5)
  rating!: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  comment?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  conversationId?: string;
}
