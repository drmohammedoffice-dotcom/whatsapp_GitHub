import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CampaignSourceType } from '@watsapp/database';
import { IsBoolean, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateCampaignDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  name!: string;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  slug!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  businessId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  trafficSourceId?: string;

  @ApiPropertyOptional({ enum: CampaignSourceType })
  @IsOptional()
  @IsEnum(CampaignSourceType)
  trafficSourceType?: CampaignSourceType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  trafficSourceName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  whatsAppCloudAccountId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  routingRuleId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  aiAgentId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  redirectMessage?: string;
}

export class UpdateCampaignDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  whatsAppCloudAccountId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  routingRuleId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  aiAgentId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  redirectMessage?: string | null;
}
