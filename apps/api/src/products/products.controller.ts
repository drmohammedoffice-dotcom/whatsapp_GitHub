import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Permission } from '@watsapp/database';
import { IsBoolean, IsNumber, IsObject, IsOptional, IsString } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { CurrentPrincipal } from '../common/current-principal.decorator';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { AuthenticatedPrincipal } from '../common/principal';
import { ProductsService } from './products.service';

class ProductDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  sku?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsNumber()
  priceCents?: number;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsObject()
  metadata?: object;
}

@ApiTags('Products')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('products')
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  @Get()
  @RequirePermissions(Permission.AI_ACCESS)
  list(@CurrentPrincipal() principal: AuthenticatedPrincipal) { return this.products.list(principal.teamId); }

  @Get(':id')
  @RequirePermissions(Permission.AI_ACCESS)
  get(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Param('id') id: string) { return this.products.get(principal.teamId, id); }

  @Post()
  @RequirePermissions(Permission.AI_MANAGE_KNOWLEDGE)
  create(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Body() dto: ProductDto) { return this.products.create(principal.teamId, dto); }

  @Patch(':id')
  @RequirePermissions(Permission.AI_MANAGE_KNOWLEDGE)
  update(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Param('id') id: string, @Body() dto: ProductDto) { return this.products.update(principal.teamId, id, dto); }

  @Delete(':id')
  @RequirePermissions(Permission.AI_MANAGE_KNOWLEDGE)
  delete(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Param('id') id: string) { return this.products.delete(principal.teamId, id); }
}
