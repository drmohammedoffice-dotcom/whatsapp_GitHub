import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Permission } from '@watsapp/database';
import { IsOptional, IsString, MinLength } from 'class-validator';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { CurrentPrincipal } from '../../common/current-principal.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { AuthenticatedPrincipal } from '../../common/principal';
import { BusinessService } from './business.service';

class CreateBusinessDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsString()
  @MinLength(2)
  slug!: string;

  @IsOptional()
  @IsString()
  industry?: string;

  @IsOptional()
  @IsString()
  timezone?: string;
}

@ApiTags('Businesses')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('businesses')
export class BusinessController {
  constructor(private readonly business: BusinessService) {}

  @Get()
  @RequirePermissions(Permission.BUSINESS_MANAGE)
  list(@CurrentPrincipal() p: AuthenticatedPrincipal) {
    return this.business.list(p.teamId);
  }

  @Post()
  @RequirePermissions(Permission.BUSINESS_MANAGE)
  create(@CurrentPrincipal() p: AuthenticatedPrincipal, @Body() dto: CreateBusinessDto) {
    return this.business.create(p.teamId, dto);
  }

  @Patch(':id')
  @RequirePermissions(Permission.BUSINESS_MANAGE)
  update(@CurrentPrincipal() p: AuthenticatedPrincipal, @Param('id') id: string, @Body() dto: Partial<CreateBusinessDto>) {
    return this.business.update(p.teamId, id, dto);
  }
}
