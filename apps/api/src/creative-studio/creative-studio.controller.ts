import {
  Body,
  Controller,
  Delete,
  Get,
  HttpException,
  Param,
  Patch,
  Post,
  Put,
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
import { CreateCreativeJobDto, CreateCreativeProjectDto, CreativeHintsDto, ModelProfileDto, ParseEditDto, SelectConceptDto, UpdateCreativeProjectDto, UpsertProductProfileDto } from './dto/creative.dto';
import { CreativeStudioService } from './creative-studio.service';
import { ProviderError } from './providers/provider-error';

function mapProviderError(error: unknown): never {
  if (error instanceof ProviderError) {
    throw new HttpException({ code: error.code, message: error.message }, error.httpStatus);
  }
  throw error;
}

@ApiTags('Creative Studio')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('creative')
export class CreativeStudioController {
  constructor(private readonly studio: CreativeStudioService) {}

  @Get('status')
  @RequirePermissions(Permission.AI_ACCESS)
  async status(@CurrentPrincipal() principal: AuthenticatedPrincipal) {
    await this.studio.assertAccess(principal.teamId);
    return this.studio.status();
  }

  @Get('providers')
  @RequirePermissions(Permission.AI_ACCESS)
  async providers(@CurrentPrincipal() principal: AuthenticatedPrincipal) {
    await this.studio.assertAccess(principal.teamId);
    return this.studio.providers();
  }

  @Post('probe')
  @RequirePermissions(Permission.AI_ACCESS)
  async probe(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Query('provider') provider: 'openai' | 'openrouter' | 'gemini' = 'gemini',
  ) {
    await this.studio.assertAccess(principal.teamId);
    try {
      return await this.studio.probe(provider);
    } catch (error) {
      mapProviderError(error);
    }
  }

  @Get('dashboard')
  @RequirePermissions(Permission.AI_ACCESS)
  async dashboard(@CurrentPrincipal() principal: AuthenticatedPrincipal) {
    await this.studio.assertAccess(principal.teamId);
    return this.studio.dashboard(principal.teamId);
  }

  @Get('health')
  @RequirePermissions(Permission.AI_ACCESS)
  async health(@CurrentPrincipal() principal: AuthenticatedPrincipal) {
    await this.studio.assertAccess(principal.teamId);
    return this.studio.providerHealth();
  }

  @Get('presets')
  @RequirePermissions(Permission.AI_ACCESS)
  async presets(@CurrentPrincipal() principal: AuthenticatedPrincipal) {
    await this.studio.assertAccess(principal.teamId);
    return this.studio.presets();
  }

  @Get('projects')
  @RequirePermissions(Permission.AI_ACCESS)
  async listProjects(@CurrentPrincipal() principal: AuthenticatedPrincipal) {
    await this.studio.assertAccess(principal.teamId);
    return this.studio.listProjects(principal.teamId);
  }

  @Post('projects')
  @RequirePermissions(Permission.AI_ACCESS)
  async createProject(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Body() dto: CreateCreativeProjectDto) {
    await this.studio.assertAccess(principal.teamId);
    return this.studio.createProject(principal.teamId, principal.userId, dto);
  }

  @Get('projects/:id')
  @RequirePermissions(Permission.AI_ACCESS)
  async getProject(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Param('id') id: string) {
    await this.studio.assertAccess(principal.teamId);
    return this.studio.getProject(principal.teamId, id);
  }

  @Patch('projects/:id')
  @RequirePermissions(Permission.AI_ACCESS)
  async updateProject(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('id') id: string,
    @Body() dto: UpdateCreativeProjectDto,
  ) {
    await this.studio.assertAccess(principal.teamId);
    return this.studio.updateProject(principal.teamId, id, dto);
  }

  @Delete('projects/:id')
  @RequirePermissions(Permission.AI_ACCESS)
  async deleteProject(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Param('id') id: string) {
    await this.studio.assertAccess(principal.teamId);
    return this.studio.deleteProject(principal.teamId, id);
  }

  @Put('projects/:id/product')
  @RequirePermissions(Permission.AI_ACCESS)
  async upsertProduct(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('id') id: string,
    @Body() dto: UpsertProductProfileDto,
  ) {
    await this.studio.assertAccess(principal.teamId);
    return this.studio.upsertProduct(principal.teamId, principal.userId, id, dto);
  }

  @Post('projects/:id/assets')
  @ApiConsumes('multipart/form-data')
  @RequirePermissions(Permission.AI_ACCESS)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 12 * 1024 * 1024 } }))
  async addAsset(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('id') id: string,
    @UploadedFile() file: UploadedMediaFile,
  ) {
    await this.studio.assertAccess(principal.teamId);
    return this.studio.addAsset(principal.teamId, principal.userId, id, file);
  }

  @Delete('assets/:id')
  @RequirePermissions(Permission.AI_ACCESS)
  async removeAsset(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Param('id') id: string) {
    await this.studio.assertAccess(principal.teamId);
    return this.studio.removeAsset(principal.teamId, id);
  }

  @Post('jobs')
  @RequirePermissions(Permission.AI_ACCESS)
  async createJob(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Body() dto: CreateCreativeJobDto) {
    await this.studio.assertAccess(principal.teamId);
    try {
      return await this.studio.createJob(principal.teamId, principal.userId, dto);
    } catch (error) {
      mapProviderError(error);
    }
  }

  @Get('jobs/:id')
  @RequirePermissions(Permission.AI_ACCESS)
  async getJob(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Param('id') id: string) {
    await this.studio.assertAccess(principal.teamId);
    return this.studio.getJob(principal.teamId, id);
  }

  @Post('jobs/:id/retry')
  @RequirePermissions(Permission.AI_ACCESS)
  async retryJob(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Param('id') id: string) {
    await this.studio.assertAccess(principal.teamId);
    try {
      return await this.studio.retryJob(principal.teamId, id);
    } catch (error) {
      mapProviderError(error);
    }
  }

  @Post('jobs/:id/cancel')
  @RequirePermissions(Permission.AI_ACCESS)
  async cancelJob(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Param('id') id: string) {
    await this.studio.assertAccess(principal.teamId);
    return this.studio.cancelJob(principal.teamId, id);
  }

  @Post('projects/:id/analyze')
  @RequirePermissions(Permission.AI_ACCESS)
  async analyze(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Param('id') id: string) {
    await this.studio.assertAccess(principal.teamId);
    try {
      return await this.studio.analyzeProduct(principal.teamId, principal.userId, id);
    } catch (error) {
      mapProviderError(error);
    }
  }

  @Post('projects/:id/brief')
  @RequirePermissions(Permission.AI_ACCESS)
  async brief(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('id') id: string,
    @Body() dto: CreativeHintsDto,
  ) {
    await this.studio.assertAccess(principal.teamId);
    try {
      return await this.studio.generateBrief(principal.teamId, principal.userId, id, {
        platform: dto.platform,
        aspectRatio: dto.aspectRatio,
        objective: dto.objective,
      });
    } catch (error) {
      mapProviderError(error);
    }
  }

  @Post('projects/:id/concepts')
  @RequirePermissions(Permission.AI_ACCESS)
  async concepts(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Param('id') id: string) {
    await this.studio.assertAccess(principal.teamId);
    try {
      return await this.studio.generateConcepts(principal.teamId, principal.userId, id);
    } catch (error) {
      mapProviderError(error);
    }
  }

  @Post('projects/:id/concepts/select')
  @RequirePermissions(Permission.AI_ACCESS)
  async selectConcept(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('id') id: string,
    @Body() dto: SelectConceptDto,
  ) {
    await this.studio.assertAccess(principal.teamId);
    return this.studio.selectConcept(principal.teamId, id, dto.conceptId);
  }

  @Post('models')
  @RequirePermissions(Permission.AI_ACCESS)
  async modelProfile(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Body() dto: ModelProfileDto) {
    await this.studio.assertAccess(principal.teamId);
    return this.studio.upsertModelProfile(principal.teamId, principal.userId, dto);
  }

  @Post('edits/parse')
  @RequirePermissions(Permission.AI_ACCESS)
  async parseEdit(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Body() dto: ParseEditDto) {
    await this.studio.assertAccess(principal.teamId);
    return this.studio.parseEdit(principal.teamId, principal.userId, dto.projectId, dto.instruction);
  }

  @Post('edits/apply')
  @RequirePermissions(Permission.AI_ACCESS)
  async applyEdit(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Body() dto: ParseEditDto) {
    await this.studio.assertAccess(principal.teamId);
    return this.studio.applyEditPlan(principal.teamId, principal.userId, dto.projectId, dto.instruction);
  }

  @Post('projects/:id/director')
  @RequirePermissions(Permission.AI_ACCESS)
  async director(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('id') id: string,
    @Body() body: { command: string },
  ) {
    await this.studio.assertAccess(principal.teamId);
    try {
      return await this.studio.director(principal.teamId, principal.userId, id, body.command);
    } catch (error) {
      mapProviderError(error);
    }
  }

  @Post('projects/:id/script')
  @RequirePermissions(Permission.AI_ACCESS)
  async script(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Param('id') id: string) {
    await this.studio.assertAccess(principal.teamId);
    try {
      return await this.studio.generateScript(principal.teamId, principal.userId, id);
    } catch (error) {
      mapProviderError(error);
    }
  }

  @Get('projects/:id/scenes')
  @RequirePermissions(Permission.AI_ACCESS)
  async scenes(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Param('id') id: string) {
    await this.studio.assertAccess(principal.teamId);
    return this.studio.listScenes(principal.teamId, id);
  }

  @Put('projects/:id/scenes')
  @RequirePermissions(Permission.AI_ACCESS)
  async saveScenes(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('id') id: string,
    @Body() body: { scenes: Array<{ id?: string; order: number; durationSec?: number; role?: string; script?: string; environment?: string; visualInstructions?: string; camera?: string; transition?: string; modelProfileId?: string }> },
  ) {
    await this.studio.assertAccess(principal.teamId);
    return this.studio.upsertScenes(principal.teamId, principal.userId, id, body.scenes || []);
  }

  @Patch('scenes/:id')
  @RequirePermissions(Permission.AI_ACCESS)
  async patchScene(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    await this.studio.assertAccess(principal.teamId);
    return this.studio.patchScene(principal.teamId, id, body);
  }

  @Delete('scenes/:id')
  @RequirePermissions(Permission.AI_ACCESS)
  async deleteScene(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Param('id') id: string) {
    await this.studio.assertAccess(principal.teamId);
    return this.studio.deleteScene(principal.teamId, id);
  }

  @Post('scenes/:id/duplicate')
  @RequirePermissions(Permission.AI_ACCESS)
  async duplicateScene(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Param('id') id: string) {
    await this.studio.assertAccess(principal.teamId);
    return this.studio.duplicateScene(principal.teamId, principal.userId, id);
  }

  @Post('projects/:id/captions')
  @RequirePermissions(Permission.AI_ACCESS)
  async captions(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Param('id') id: string) {
    await this.studio.assertAccess(principal.teamId);
    return this.studio.generateCaptions(principal.teamId, principal.userId, id);
  }

  @Get('projects/:id/versions')
  @RequirePermissions(Permission.AI_ACCESS)
  async versions(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Param('id') id: string) {
    await this.studio.assertAccess(principal.teamId);
    return this.studio.listVersions(principal.teamId, id);
  }

  @Post('versions/:id/current')
  @RequirePermissions(Permission.AI_ACCESS)
  async currentVersion(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Param('id') id: string) {
    await this.studio.assertAccess(principal.teamId);
    return this.studio.setCurrentVersion(principal.teamId, id);
  }

  @Post('versions/:id/restore')
  @RequirePermissions(Permission.AI_ACCESS)
  async restore(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Param('id') id: string) {
    await this.studio.assertAccess(principal.teamId);
    return this.studio.restoreVersion(principal.teamId, principal.userId, id);
  }

  @Delete('versions/:id')
  @RequirePermissions(Permission.AI_ACCESS)
  async deleteVersion(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Param('id') id: string) {
    await this.studio.assertAccess(principal.teamId);
    return this.studio.deleteVersion(principal.teamId, id);
  }

  @Put('projects/:id/continuity')
  @RequirePermissions(Permission.AI_ACCESS)
  async continuity(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('id') id: string,
    @Body() body: Record<string, string | undefined>,
  ) {
    await this.studio.assertAccess(principal.teamId);
    return this.studio.upsertContinuity(principal.teamId, principal.userId, id, body);
  }

  @Get('projects/:id/music')
  @RequirePermissions(Permission.AI_ACCESS)
  async music(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Param('id') id: string) {
    await this.studio.assertAccess(principal.teamId);
    return this.studio.recommendMusic(principal.teamId, id);
  }

  @Post('projects/:id/music')
  @ApiConsumes('multipart/form-data')
  @RequirePermissions(Permission.AI_ACCESS)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 20 * 1024 * 1024 } }))
  async uploadMusic(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('id') id: string,
    @UploadedFile() file: UploadedMediaFile,
    @Body() body: { name?: string; mood?: string; licenseConfirmed?: string; licenseNote?: string },
  ) {
    await this.studio.assertAccess(principal.teamId);
    void id;
    return this.studio.uploadMusic(principal.teamId, principal.userId, file, {
      name: body.name || file.originalname,
      mood: body.mood,
      licenseConfirmed: body.licenseConfirmed === 'true' || body.licenseConfirmed === '1',
      licenseNote: body.licenseNote,
    });
  }

  @Get('generated/:id/file')
  @RequirePermissions(Permission.AI_ACCESS)
  async generatedFile(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('id') id: string,
    @Query('download') download?: string,
  ) {
    await this.studio.assertAccess(principal.teamId);
    const file = await this.studio.openGeneratedFile(principal.teamId, id);
    return new StreamableFile(file.stream, {
      type: file.mimeType,
      disposition: download ? `attachment; filename="${file.fileName || 'creative-media'}"` : undefined,
    });
  }

  @Get('assets/:id/file')
  @RequirePermissions(Permission.AI_ACCESS)
  async productFile(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Param('id') id: string) {
    await this.studio.assertAccess(principal.teamId);
    const file = await this.studio.openProductAsset(principal.teamId, id);
    return new StreamableFile(file.stream, { type: file.mimeType });
  }
}
