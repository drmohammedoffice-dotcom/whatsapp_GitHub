import { Type } from 'class-transformer';
import { IsBoolean, IsIn, IsNumber, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateCreativeProjectDto {
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  contentKind?: string;

  @IsOptional()
  @IsString()
  @MaxLength(16)
  aspectRatio?: string;

  @IsOptional()
  @IsString()
  locale?: string;
}

export class UpdateCreativeProjectDto {
  @IsOptional()
  @IsString()
  @MaxLength(160)
  name?: string;

  @IsOptional()
  @IsString()
  contentKind?: string;

  @IsOptional()
  @IsString()
  aspectRatio?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  durationSec?: number;
}

export class UpsertProductProfileDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  price?: number;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsString()
  ingredients?: string;

  @IsOptional()
  @IsString()
  benefits?: string;

  @IsOptional()
  @IsString()
  usage?: string;

  @IsOptional()
  @IsString()
  targetAudience?: string;

  @IsOptional()
  @IsString()
  extra?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  brand?: string;

  @IsOptional()
  @IsString()
  userClaims?: string;
}

export class CreateCreativeJobDto {
  @IsString()
  projectId!: string;

  @IsIn(['PROBE', 'TEXT', 'IMAGE', 'VIDEO', 'TTS', 'LIPSYNC', 'UPSCALE', 'COMPOSE', 'EDIT'])
  type!: string;

  @IsOptional()
  @IsIn(['gemini', 'openai', 'openrouter', 'fal', 'runway', 'iraqi-tts', 'lipsync', 'upscale', 'ffmpeg'])
  provider?: string;

  @IsOptional()
  @IsString()
  model?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  idempotencyKey?: string;

  @IsOptional()
  @IsBoolean()
  force?: boolean;

  @IsOptional()
  @IsString()
  aspectRatio?: string;

  @IsOptional()
  @IsString()
  resolution?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  durationSec?: number;

  @IsOptional()
  @IsString()
  instruction?: string;

  @IsOptional()
  @IsString()
  userInstructions?: string;

  @IsOptional()
  @IsString()
  videoMode?: string;

  @IsOptional()
  @IsString()
  conceptId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  variationCount?: number;

  @IsOptional()
  @IsString()
  sceneId?: string;

  @IsOptional()
  @IsString()
  script?: string;

  @IsOptional()
  @IsString()
  voice?: string;

  @IsOptional()
  @IsString()
  dialect?: string;

  @IsOptional()
  @IsString()
  gender?: string;

  @IsOptional()
  @IsString()
  musicTrackId?: string;
}

export class CreativeHintsDto {
  @IsOptional()
  @IsString()
  platform?: string;

  @IsOptional()
  @IsString()
  aspectRatio?: string;

  @IsOptional()
  @IsString()
  objective?: string;
}

export class SelectConceptDto {
  @IsString()
  conceptId!: string;
}

export class ParseEditDto {
  @IsString()
  projectId!: string;

  @IsString()
  instruction!: string;
}

export class ModelProfileDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  gender?: string;

  @IsOptional()
  @IsString()
  ageRange?: string;

  @IsOptional()
  @IsString()
  skinTone?: string;

  @IsOptional()
  @IsString()
  hair?: string;

  @IsOptional()
  @IsString()
  clothing?: string;

  @IsOptional()
  @IsString()
  persona?: string;

  @IsOptional()
  @IsString()
  expression?: string;

  @IsOptional()
  @IsString()
  pose?: string;

  @IsOptional()
  @IsString()
  profession?: string;

  @IsOptional()
  @IsString()
  visualIdentity?: string;

  @IsOptional()
  @IsString()
  environment?: string;
}
