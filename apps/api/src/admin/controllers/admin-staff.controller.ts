import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger';
import { AdminRole } from '@watsapp/database';
import { IsArray, IsBoolean, IsEmail, IsIn, IsOptional, IsString, MinLength } from 'class-validator';
import { Request } from 'express';
import { CurrentAdmin } from '../decorators/current-admin.decorator';
import { RequireAdminRoles } from '../decorators/require-admin-roles.decorator';
import { AdminJwtGuard } from '../guards/admin-jwt.guard';
import { AdminRolesGuard } from '../guards/admin-roles.guard';
import { AdminPrincipal } from '../types/admin-principal';
import { AdminStaffService } from '../services/admin-staff.service';

const STAFF_ROLES = [AdminRole.ACCOUNTANT, AdminRole.MAILBOX_CREATOR, AdminRole.STAFF] as const;

class CreateStaffDto {
  @ApiProperty()
  @IsEmail()
  email!: string;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  name!: string;

  @ApiProperty()
  @IsString()
  @MinLength(8)
  password!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  residence?: string;

  @ApiProperty({ required: false, enum: STAFF_ROLES })
  @IsOptional()
  @IsIn(STAFF_ROLES as unknown as string[])
  role?: string;

  @ApiProperty({ required: false, isArray: true, enum: STAFF_ROLES })
  @IsOptional()
  @IsArray()
  @IsIn(STAFF_ROLES as unknown as string[], { each: true })
  roles?: string[];
}

class UpdateStaffDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MinLength(8)
  password?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  residence?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiProperty({ required: false, enum: STAFF_ROLES })
  @IsOptional()
  @IsIn(STAFF_ROLES as unknown as string[])
  role?: string;

  @ApiProperty({ required: false, isArray: true, enum: STAFF_ROLES })
  @IsOptional()
  @IsArray()
  @IsIn(STAFF_ROLES as unknown as string[], { each: true })
  roles?: string[];
}

@ApiTags('Chatloora Admin Staff')
@ApiBearerAuth()
@UseGuards(AdminJwtGuard, AdminRolesGuard)
@RequireAdminRoles(AdminRole.SUPER_ADMIN)
@Controller('admin/staff')
export class AdminStaffController {
  constructor(private readonly staff: AdminStaffService) {}

  @Get()
  @ApiOperation({ summary: 'List employee accounts (super admin only)' })
  list() {
    return this.staff.list();
  }

  @Get('activity')
  @ApiOperation({ summary: 'Employee activity log (super admin only)' })
  activity(
    @Query('staffId') staffId?: string,
    @Query('skip') skip?: string,
    @Query('take') take?: string,
  ) {
    return this.staff.activity({
      staffId,
      skip: skip ? Number(skip) : 0,
      take: take ? Number(take) : 100,
    });
  }

  @Post()
  @ApiOperation({ summary: 'Create employee account' })
  create(@CurrentAdmin() admin: AdminPrincipal, @Body() body: CreateStaffDto, @Req() req: Request) {
    return this.staff.create(admin.adminUserId, body, req.ip, req.headers['user-agent']);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update employee account' })
  update(
    @CurrentAdmin() admin: AdminPrincipal,
    @Param('id') id: string,
    @Body() body: UpdateStaffDto,
    @Req() req: Request,
  ) {
    return this.staff.update(admin.adminUserId, id, body, req.ip, req.headers['user-agent']);
  }

  @Post(':id/deactivate')
  @ApiOperation({ summary: 'Deactivate employee account' })
  deactivate(@CurrentAdmin() admin: AdminPrincipal, @Param('id') id: string, @Req() req: Request) {
    return this.staff.deactivate(admin.adminUserId, id, req.ip, req.headers['user-agent']);
  }
}
