import { IsBoolean, IsEnum, IsNumber, IsOptional, IsString, Min, MinLength } from 'class-validator';
import { BookingStatus } from '@watsapp/database';

export class UpdateBookingDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  phoneNumber?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  address?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  orderType?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  totalAmount?: number;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsString()
  notes?: string | null;

  @IsOptional()
  @IsBoolean()
  usedWhatsappPhone?: boolean;

  @IsOptional()
  @IsString()
  customerName?: string;

  @IsOptional()
  @IsEnum(BookingStatus)
  status?: BookingStatus;
}
