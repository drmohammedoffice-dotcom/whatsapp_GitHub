import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
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
import {
  ApplyStoreThemeDto,
  ReorderIdsDto,
  StoreBannerDto,
  StoreCategoryDto,
  StoreThemeDto,
  UpdateStoreSettingsDto,
} from './dto/store.dto';
import { ProductsService } from './products.service';

@ApiTags('Store')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('store')
export class StoreController {
  constructor(private readonly products: ProductsService) {}

  @Get('settings')
  @RequirePermissions(Permission.AI_ACCESS)
  settings(@CurrentPrincipal() principal: AuthenticatedPrincipal) {
    return this.products.ensureSettings(principal.teamId);
  }

  @Post('settings')
  @RequirePermissions(Permission.AI_MANAGE_KNOWLEDGE)
  updateSettings(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Body() dto: UpdateStoreSettingsDto) {
    return this.products.updateSettings(principal.teamId, dto);
  }

  @Post('logo')
  @ApiConsumes('multipart/form-data')
  @RequirePermissions(Permission.AI_MANAGE_KNOWLEDGE)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 8 * 1024 * 1024 } }))
  logo(@CurrentPrincipal() principal: AuthenticatedPrincipal, @UploadedFile() file: UploadedMediaFile) {
    return this.products.uploadLogo(principal.teamId, file);
  }

  @Get('stock')
  @RequirePermissions(Permission.AI_ACCESS)
  stock(@CurrentPrincipal() principal: AuthenticatedPrincipal) {
    return this.products.stockMovements(principal.teamId);
  }

  @Get('categories')
  @RequirePermissions(Permission.AI_ACCESS)
  categories(@CurrentPrincipal() principal: AuthenticatedPrincipal) {
    return this.products.listCategories(principal.teamId);
  }

  @Post('categories')
  @RequirePermissions(Permission.AI_MANAGE_KNOWLEDGE)
  createCategory(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Body() dto: StoreCategoryDto) {
    return this.products.createCategory(principal.teamId, dto);
  }

  @Post('categories/reorder')
  @RequirePermissions(Permission.AI_MANAGE_KNOWLEDGE)
  reorderCategories(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Body() dto: ReorderIdsDto) {
    return this.products.reorderCategories(principal.teamId, dto.ids ?? []);
  }

  @Post('categories/:id/duplicate')
  @RequirePermissions(Permission.AI_MANAGE_KNOWLEDGE)
  duplicateCategory(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Param('id') id: string) {
    return this.products.duplicateCategory(principal.teamId, id);
  }

  @Patch('categories/:id')
  @RequirePermissions(Permission.AI_MANAGE_KNOWLEDGE)
  updateCategory(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('id') id: string,
    @Body() dto: StoreCategoryDto,
  ) {
    return this.products.updateCategory(principal.teamId, id, dto);
  }

  @Post('categories/:id/image')
  @ApiConsumes('multipart/form-data')
  @RequirePermissions(Permission.AI_MANAGE_KNOWLEDGE)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 8 * 1024 * 1024 } }))
  categoryImage(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('id') id: string,
    @UploadedFile() file: UploadedMediaFile,
  ) {
    return this.products.uploadCategoryImage(principal.teamId, id, file);
  }

  @Get('categories/:id/image')
  @RequirePermissions(Permission.AI_ACCESS)
  async categoryImageFile(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Param('id') id: string) {
    const file = await this.products.openCategoryImage(principal.teamId, id);
    return new StreamableFile(file.stream, { type: file.mimeType });
  }

  @Delete('categories/:id')
  @RequirePermissions(Permission.AI_MANAGE_KNOWLEDGE)
  deleteCategory(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Param('id') id: string) {
    return this.products.deleteCategory(principal.teamId, id);
  }

  @Get('themes')
  @RequirePermissions(Permission.AI_ACCESS)
  themes(@CurrentPrincipal() principal: AuthenticatedPrincipal) {
    return this.products.listThemes(principal.teamId);
  }

  @Post('themes')
  @RequirePermissions(Permission.AI_MANAGE_KNOWLEDGE)
  createTheme(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Body() dto: StoreThemeDto) {
    return this.products.createTheme(principal.teamId, dto);
  }

  @Post('themes/apply')
  @RequirePermissions(Permission.AI_MANAGE_KNOWLEDGE)
  applyTheme(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Body() dto: ApplyStoreThemeDto) {
    return this.products.applyTheme(principal.teamId, dto);
  }

  @Delete('themes/:id')
  @RequirePermissions(Permission.AI_MANAGE_KNOWLEDGE)
  deleteTheme(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Param('id') id: string) {
    return this.products.deleteTheme(principal.teamId, id);
  }

  @Get('banners')
  @RequirePermissions(Permission.AI_ACCESS)
  banners(@CurrentPrincipal() principal: AuthenticatedPrincipal) {
    return this.products.listBanners(principal.teamId);
  }

  @Post('banners')
  @ApiConsumes('multipart/form-data')
  @RequirePermissions(Permission.AI_MANAGE_KNOWLEDGE)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 8 * 1024 * 1024 } }))
  createBanner(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @UploadedFile() file: UploadedMediaFile,
    @Body() dto: StoreBannerDto,
  ) {
    return this.products.createBanner(principal.teamId, file, dto);
  }

  @Patch('banners/:id')
  @RequirePermissions(Permission.AI_MANAGE_KNOWLEDGE)
  updateBanner(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('id') id: string,
    @Body() dto: StoreBannerDto,
  ) {
    return this.products.updateBanner(principal.teamId, id, dto);
  }

  @Delete('banners/:id')
  @RequirePermissions(Permission.AI_MANAGE_KNOWLEDGE)
  deleteBanner(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Param('id') id: string) {
    return this.products.deleteBanner(principal.teamId, id);
  }

  @Get('banners/:id/image')
  @RequirePermissions(Permission.AI_ACCESS)
  async bannerImage(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Param('id') id: string) {
    const file = await this.products.openBanner(principal.teamId, id);
    return new StreamableFile(file.stream, { type: file.mimeType });
  }

  @Get('media/:mediaId')
  @RequirePermissions(Permission.AI_ACCESS)
  async media(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Param('mediaId') mediaId: string) {
    const file = await this.products.openMedia(principal.teamId, mediaId);
    return new StreamableFile(file.stream, { type: file.mimeType, disposition: `inline; filename="${file.fileName}"` });
  }
}
