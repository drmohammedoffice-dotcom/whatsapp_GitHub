import {
  Body,
  Controller,
  Post,
  Get,
  Param,
  UseGuards,
  Req,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import { IsEmail, IsIn, IsOptional, IsString, MinLength } from 'class-validator';
import { AdminRole } from '@watsapp/database';
import { Request } from 'express';
import type { UploadedMediaFile } from '../../common/uploaded-media-file';
import { CurrentAdmin } from '../decorators/current-admin.decorator';
import { RequireAdminRoles } from '../decorators/require-admin-roles.decorator';
import { AdminJwtGuard } from '../guards/admin-jwt.guard';
import { AdminRolesGuard } from '../guards/admin-roles.guard';
import { AdminPrincipal } from '../types/admin-principal';
import { AdminAuthService } from '../services/admin-auth.service';

class AdminLoginDto {
  @ApiProperty()
  @IsEmail()
  email!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  password!: string;

  @ApiProperty({ required: false, enum: ['admin', 'staff'] })
  @IsOptional()
  @IsIn(['admin', 'staff'])
  portal?: 'admin' | 'staff';
}

@ApiTags('Chatloora Admin Auth')
@Controller('admin/auth')
export class AdminAuthController {
  constructor(private readonly auth: AdminAuthService) {}

  @Post('login')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiOperation({ summary: 'Admin or staff portal login' })
  login(@Body() body: AdminLoginDto, @Req() req: Request) {
    return this.auth.login(
      body.email,
      body.password,
      req.ip,
      req.headers['user-agent'],
      body.portal ?? 'admin',
    );
  }

  @Get('me')
  @SkipThrottle()
  @ApiBearerAuth()
  @UseGuards(AdminJwtGuard)
  @ApiOperation({ summary: 'Current admin profile' })
  me(@CurrentAdmin() admin: AdminPrincipal) {
    return this.auth.me(admin.adminUserId);
  }

  @Get('me/avatar')
  @SkipThrottle()
  @ApiBearerAuth()
  @UseGuards(AdminJwtGuard)
  @ApiOperation({ summary: 'Current staff/admin avatar image' })
  async myAvatar(@CurrentAdmin() admin: AdminPrincipal) {
    const file = await this.auth.openMyAvatar(admin.adminUserId);
    return new StreamableFile(file.stream, { type: file.type });
  }

  @Post('me/avatar')
  @SkipThrottle()
  @ApiBearerAuth()
  @UseGuards(AdminJwtGuard)
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 4 * 1024 * 1024 } }))
  @ApiOperation({ summary: 'Upload current staff/admin avatar' })
  saveMyAvatar(@CurrentAdmin() admin: AdminPrincipal, @UploadedFile() file: UploadedMediaFile) {
    return this.auth.saveMyAvatar(admin.adminUserId, file);
  }

  @Post('impersonate/:userId')
  @ApiBearerAuth()
  @UseGuards(AdminJwtGuard, AdminRolesGuard)
  @RequireAdminRoles(AdminRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Login as user (impersonation)' })
  impersonate(@CurrentAdmin() admin: AdminPrincipal, @Param('userId') userId: string, @Req() req: Request) {
    return this.auth.impersonate(admin.adminUserId, userId, req.ip, req.headers['user-agent']);
  }
}
