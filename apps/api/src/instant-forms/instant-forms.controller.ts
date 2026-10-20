import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  Patch,
  Post,
  Query,
  Res,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SubscriptionGuard } from '../billing/subscription.guard';
import { CurrentPrincipal } from '../common/current-principal.decorator';
import { AuthenticatedPrincipal } from '../common/principal';
import { UploadedMediaFile } from '../common/uploaded-media-file';
import {
  CreateInstantFormDto,
  GenerateInstantFormDto,
  ListFormsQueryDto,
  ListOrdersQueryDto,
  SaveDraftDto,
  UpdateInstantFormDto,
  UpdateOrderDto,
} from './dto/instant-form.dto';
import { InstantFormAiService } from './instant-form-ai.service';
import { InstantFormsService } from './instant-forms.service';
import { InstantFormDocument } from './instant-form.document';

@ApiTags('Instant Forms')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, SubscriptionGuard)
@Controller('instant-forms')
export class InstantFormsController {
  constructor(
    private readonly forms: InstantFormsService,
    private readonly formAi: InstantFormAiService,
  ) {}

  @Get('templates')
  templates() {
    return this.forms.listTemplates();
  }

  @Post('generate')
  generate(@CurrentPrincipal() p: AuthenticatedPrincipal, @Body() dto: GenerateInstantFormDto) {
    return this.formAi.generate(p.teamId, dto);
  }

  @Post('media')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  uploadMedia(
    @CurrentPrincipal() p: AuthenticatedPrincipal,
    @UploadedFile() file: UploadedMediaFile,
  ) {
    return this.forms.uploadMedia(p.teamId, file);
  }

  @Get()
  list(@CurrentPrincipal() p: AuthenticatedPrincipal, @Query() query: ListFormsQueryDto) {
    return this.forms.list(p.teamId, query);
  }

  @Get('orders')
  listOrders(@CurrentPrincipal() p: AuthenticatedPrincipal, @Query() query: ListOrdersQueryDto) {
    return this.forms.listOrders(p.teamId, query);
  }

  @Get('orders/export.csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  async exportCsv(
    @CurrentPrincipal() p: AuthenticatedPrincipal,
    @Query('formId') formId: string | undefined,
    @Query('mode') mode: 'all' | 'new' | undefined,
    @Query('since') since: string | undefined,
    @Res() res: Response,
  ) {
    const result = await this.forms.exportOrdersCsv(p.teamId, { formId, mode, since });
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="instant-form-orders-${result.mode}-${Date.now()}.csv"`,
    );
    res.setHeader('X-Export-Count', String(result.count));
    res.setHeader('X-Export-Cursor', result.cursor);
    res.setHeader('Access-Control-Expose-Headers', 'X-Export-Count, X-Export-Cursor');
    res.send('\uFEFF' + result.csv);
  }

  @Get('orders/:orderId')
  getOrder(@CurrentPrincipal() p: AuthenticatedPrincipal, @Param('orderId') orderId: string) {
    return this.forms.getOrder(p.teamId, orderId);
  }

  @Patch('orders/:orderId')
  updateOrder(
    @CurrentPrincipal() p: AuthenticatedPrincipal,
    @Param('orderId') orderId: string,
    @Body() dto: UpdateOrderDto,
  ) {
    return this.forms.updateOrder(p.teamId, orderId, dto);
  }

  @Delete('orders/:orderId')
  deleteOrder(@CurrentPrincipal() p: AuthenticatedPrincipal, @Param('orderId') orderId: string) {
    return this.forms.deleteOrder(p.teamId, orderId);
  }

  @Post()
  create(@CurrentPrincipal() p: AuthenticatedPrincipal, @Body() dto: CreateInstantFormDto) {
    return this.forms.create(p.teamId, p.userId, dto);
  }

  @Get(':id')
  get(@CurrentPrincipal() p: AuthenticatedPrincipal, @Param('id') id: string) {
    return this.forms.get(p.teamId, id);
  }

  @Patch(':id')
  update(
    @CurrentPrincipal() p: AuthenticatedPrincipal,
    @Param('id') id: string,
    @Body() dto: UpdateInstantFormDto,
  ) {
    return this.forms.update(p.teamId, id, dto);
  }

  @Post(':id/save-draft')
  saveDraft(
    @CurrentPrincipal() p: AuthenticatedPrincipal,
    @Param('id') id: string,
    @Body() body: SaveDraftDto,
  ) {
    return this.forms.saveDraft(p.teamId, id, body.draftDocument as unknown as InstantFormDocument);
  }

  @Post(':id/publish')
  publish(@CurrentPrincipal() p: AuthenticatedPrincipal, @Param('id') id: string) {
    return this.forms.publish(p.teamId, id, p.userId);
  }

  @Post(':id/duplicate')
  duplicate(@CurrentPrincipal() p: AuthenticatedPrincipal, @Param('id') id: string) {
    return this.forms.duplicate(p.teamId, id, p.userId);
  }

  @Post(':id/archive')
  archive(@CurrentPrincipal() p: AuthenticatedPrincipal, @Param('id') id: string) {
    return this.forms.archive(p.teamId, id);
  }

  @Delete(':id')
  remove(@CurrentPrincipal() p: AuthenticatedPrincipal, @Param('id') id: string) {
    return this.forms.remove(p.teamId, id);
  }

  @Get(':id/versions')
  versions(@CurrentPrincipal() p: AuthenticatedPrincipal, @Param('id') id: string) {
    return this.forms.listVersions(p.teamId, id);
  }

  @Post(':id/versions/:versionId/restore')
  restore(
    @CurrentPrincipal() p: AuthenticatedPrincipal,
    @Param('id') id: string,
    @Param('versionId') versionId: string,
  ) {
    return this.forms.restoreVersion(p.teamId, id, versionId);
  }
}
