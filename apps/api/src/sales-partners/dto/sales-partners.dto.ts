import { Type } from 'class-transformer';
import { IsEmail, IsIn, IsNumber, IsOptional, IsString, MinLength } from 'class-validator';

export class ApplyPartnerDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(6)
  phone!: string;

  @IsString()
  @MinLength(2)
  country!: string;

  @IsString()
  @MinLength(10)
  reason!: string;
}

export class PartnerLoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;
}

export class UpdateCommissionRuleDto {
  @IsString()
  planId!: string;

  @IsIn(['PERCENT', 'FIXED'])
  mode!: 'PERCENT' | 'FIXED';

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  percent?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  fixedCents?: number;
}

export class RejectPartnerDto {
  @IsOptional()
  @IsString()
  notes?: string;
}

export class PartnerChangePasswordDto {
  @IsString()
  currentPassword!: string;

  @IsString()
  @MinLength(8)
  newPassword!: string;
}

export class AdminSetPasswordDto {
  @IsString()
  @MinLength(8)
  password!: string;
}

export class ConfirmPayoutDto {
  @IsString()
  @MinLength(6)
  code!: string;
}
