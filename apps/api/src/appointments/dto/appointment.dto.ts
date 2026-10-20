import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { AppointmentStatus, AppointmentVertical } from '@watsapp/database';

export class BusinessHoursSlotDto {
  @IsInt() @Min(0) @Max(6) day!: number;
  @IsString() open!: string;
  @IsString() close!: string;
}

export class BusinessHoursDto {
  @IsOptional() @IsString() timezone?: string;
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => BusinessHoursSlotDto)
  schedule?: BusinessHoursSlotDto[];
}

export class UpdateAppointmentProfileDto {
  @IsOptional() @IsEnum(AppointmentVertical) vertical?: AppointmentVertical;
  @IsOptional() @IsString() orgName?: string | null;
  @IsOptional() @IsString() description?: string | null;
  @IsOptional() @IsString() phone?: string | null;
  @IsOptional() @IsEmail() email?: string | null;
  @IsOptional() @IsString() address?: string | null;
  @IsOptional() @IsString() timezone?: string;
  @IsOptional() @IsInt() @Min(5) @Max(480) defaultDurationMin?: number;
  @IsOptional() @IsInt() @Min(0) @Max(120) bufferMin?: number;
  @IsOptional() @IsInt() @Min(0) @Max(120) bufferBeforeMin?: number;
  @IsOptional() @IsInt() @Min(0) @Max(120) bufferAfterMin?: number;
  @IsOptional() @IsInt() @Min(0) @Max(240) breakMin?: number;
  @IsOptional() @IsInt() @Min(1) @Max(200) maxDailyAppointments?: number | null;
  @IsOptional() @IsInt() @Min(1) @Max(365) bookingWindowDays?: number;
  @IsOptional() @IsString() instructions?: string | null;
  @IsOptional() @IsArray() faqJson?: Array<Record<string, unknown>>;
  @IsOptional() @IsObject() clinicKnowledge?: Record<string, unknown> | null;
  @IsOptional() @ValidateNested() @Type(() => BusinessHoursDto) businessHours?: BusinessHoursDto | null;
  @IsOptional() @IsBoolean() aiCanReply?: boolean;
  @IsOptional() @IsBoolean() aiCanCreate?: boolean;
  @IsOptional() @IsBoolean() aiCanUpdate?: boolean;
  @IsOptional() @IsBoolean() aiCanCancel?: boolean;
  @IsOptional() @IsBoolean() aiCanReadCalendar?: boolean;
  @IsOptional() @IsBoolean() aiCanSendReminders?: boolean;
  @IsOptional() @IsBoolean() enabled?: boolean;
}

export class UpsertStaffDto {
  @IsString() name!: string;
  @IsOptional() @IsString() title?: string | null;
  @IsOptional() @IsString() specialty?: string | null;
  @IsOptional() @IsString() bio?: string | null;
  @IsOptional() @IsString() phone?: string | null;
  @IsOptional() @IsEmail() email?: string | null;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsInt() sortOrder?: number;
}

export class UpsertServiceDto {
  @IsString() name!: string;
  @IsOptional() @IsString() description?: string | null;
  @IsOptional() @IsInt() @Min(5) @Max(480) durationMin?: number;
  @IsOptional() @IsInt() @Min(0) priceCents?: number | null;
  @IsOptional() @IsString() currency?: string;
  @IsOptional() @IsString() staffId?: string | null;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsInt() sortOrder?: number;
}

export class CreateAppointmentDto {
  @IsString() customerPhone!: string;
  @IsOptional() @IsString() customerName?: string | null;
  @IsDateString() startsAt!: string;
  @IsOptional() @IsDateString() endsAt?: string;
  @IsOptional() @IsString() staffId?: string | null;
  @IsOptional() @IsString() serviceId?: string | null;
  @IsOptional() @IsString() conversationId?: string | null;
  @IsOptional() @IsString() contactId?: string | null;
  @IsOptional() @IsString() notes?: string | null;
  @IsOptional() @IsEnum(AppointmentStatus) status?: AppointmentStatus;
}

export class UpdateAppointmentDto {
  @IsOptional() @IsDateString() startsAt?: string;
  @IsOptional() @IsDateString() endsAt?: string;
  @IsOptional() @IsString() staffId?: string | null;
  @IsOptional() @IsString() serviceId?: string | null;
  @IsOptional() @IsString() customerName?: string | null;
  @IsOptional() @IsString() customerPhone?: string;
  @IsOptional() @IsString() notes?: string | null;
  @IsOptional() @IsEnum(AppointmentStatus) status?: AppointmentStatus;
  @IsOptional() @IsString() cancelReason?: string | null;
}

export class AvailableSlotsQueryDto {
  @IsOptional() @IsDateString() from?: string;
  @IsOptional() @IsDateString() to?: string;
  @IsOptional() @IsInt() @Type(() => Number) @Min(5) durationMin?: number;
  @IsOptional() @IsString() serviceId?: string;
}

export class UpdateCalendarIdDto {
  @IsString() calendarId!: string;
}
