import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { Permission } from '@watsapp/database';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { CurrentPrincipal } from '../common/current-principal.decorator';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { AuthenticatedPrincipal } from '../common/principal';
import { UploadedMediaFile } from '../common/uploaded-media-file';
import { ProductDto, ReorderIdsDto, UpdateProductDto } from './dto/store.dto';
import { ProductsService } from './products.service';

@ApiTags('Products')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('products')
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  @Get()
  @RequirePermissions(Permission.AI_ACCESS)
  list(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Query('q') q?: string,
    @Query('stock') stock?: 'in' | 'out' | 'all',
    @Query('categoryId') categoryId?: string,
  ) {
    return this.products.list(principal.teamId, q, stock, categoryId);
  }

  @Get(':id/media/:mediaId')
  @RequirePermissions(Permission.AI_ACCESS)
  async media(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('id') id: string,
    @Param('mediaId') mediaId: string,
  ) {
    await this.products.get(principal.teamId, id);
    const file = await this.products.openMedia(principal.teamId, mediaId);
    return new StreamableFile(file.stream, { type: file.mimeType, disposition: `inline; filename="${file.fileName}"` });
  }

  @Get(':id')
  @RequirePermissions(Permission.AI_ACCESS)
  get(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Param('id') id: string) {
    return this.products.get(principal.teamId, id);
  }

  @Post()
  @RequirePermissions(Permission.AI_MANAGE_KNOWLEDGE)
  create(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Body() dto: ProductDto) {
    return this.products.create(principal.teamId, dto);
  }

  @Post('reorder')
  @RequirePermissions(Permission.AI_MANAGE_KNOWLEDGE)
  reorder(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Body() dto: ReorderIdsDto) {
    return this.products.reorderProducts(principal.teamId, dto.ids ?? []);
  }

  @Post(':id/duplicate')
  @RequirePermissions(Permission.AI_MANAGE_KNOWLEDGE)
  duplicate(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Param('id') id: string) {
    return this.products.duplicate(principal.teamId, id);
  }

  @Patch(':id')
  @RequirePermissions(Permission.AI_MANAGE_KNOWLEDGE)
  update(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Param('id') id: string, @Body() dto: UpdateProductDto) {
    return this.products.update(principal.teamId, id, dto);
  }

  @Post(':id/media')
  @ApiConsumes('multipart/form-data')
  @RequirePermissions(Permission.AI_MANAGE_KNOWLEDGE)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 40 * 1024 * 1024 } }))
  addMedia(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('id') id: string,
    @UploadedFile() file: UploadedMediaFile,
  ) {
    return this.products.addMedia(principal.teamId, id, file);
  }

  @Delete(':id/media/:mediaId')
  @RequirePermissions(Permission.AI_MANAGE_KNOWLEDGE)
  removeMedia(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('id') id: string,
    @Param('mediaId') mediaId: string,
  ) {
    return this.products.removeMedia(principal.teamId, id, mediaId);
  }

  @Delete(':id')
  @RequirePermissions(Permission.AI_MANAGE_KNOWLEDGE)
  delete(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Param('id') id: string) {
    return this.products.delete(principal.teamId, id);
  }
}
