import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AdminRole } from '@watsapp/database';
import { RequireAdminRoles } from '../decorators/require-admin-roles.decorator';
import { AdminJwtGuard } from '../guards/admin-jwt.guard';
import { AdminRolesGuard } from '../guards/admin-roles.guard';
import { AdminCreativeService } from '../services/admin-creative.service';

@ApiTags('Chatloora Admin Creative Studio')
@ApiBearerAuth()
@UseGuards(AdminJwtGuard, AdminRolesGuard)
@Controller('admin/creative')
export class AdminCreativeController {
  constructor(private readonly creative: AdminCreativeService) {}

  @Get('health')
  @RequireAdminRoles(AdminRole.SUPER_ADMIN, AdminRole.DEVELOPER)
  health() {
    return this.creative.health();
  }

  @Get('settings')
  @RequireAdminRoles(AdminRole.SUPER_ADMIN, AdminRole.DEVELOPER)
  settings() {
    return this.creative.settings();
  }

  @Patch('settings')
  @RequireAdminRoles(AdminRole.SUPER_ADMIN)
  updateSettings(
    @Body()
    body: {
      defaultImageModel?: string;
      defaultVideoModel?: string;
      featureFlags?: Record<string, boolean>;
    },
  ) {
    return this.creative.updateSettings(body);
  }

  @Get('models')
  @RequireAdminRoles(AdminRole.SUPER_ADMIN, AdminRole.DEVELOPER)
  listModels() {
    return this.creative.listModels();
  }

  @Post('models')
  @RequireAdminRoles(AdminRole.SUPER_ADMIN)
  createModel(
    @Body()
    body: {
      provider: string;
      modelId: string;
      mediaType: string;
      enabled?: boolean;
      priority?: number;
      isDefault?: boolean;
      isFallback?: boolean;
      maxResolution?: string;
      maxDurationSec?: number;
      qualityScore?: number;
      estimatedCostUsd?: number;
      capabilities?: Record<string, unknown>;
      notes?: string;
    },
  ) {
    return this.creative.createModel(body);
  }

  @Patch('models/:id')
  @RequireAdminRoles(AdminRole.SUPER_ADMIN)
  updateModel(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.creative.updateModel(id, body);
  }
}
