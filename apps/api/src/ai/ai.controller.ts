import { Body, Controller, Get, Param, Post, Query, Res, StreamableFile, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import type { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Permission } from '@watsapp/database';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { CurrentPrincipal } from '../common/current-principal.decorator';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { AuthenticatedPrincipal } from '../common/principal';
import { UploadedMediaFile } from '../common/uploaded-media-file';
import { PrismaService } from '../prisma/prisma.service';
import { AiAssistantService } from './ai-assistant.service';
import { AiCostService } from './ai-cost.service';
import { AiKnowledgeService } from './ai-knowledge.service';
import { AiMediaService } from './ai-media.service';
import { AiMemoryService } from './ai-memory.service';
import { AiProviderConfigService } from './ai-provider-config.service';
import { AiSettingsService } from './ai-settings.service';
import { AiTrainingMediaService } from './ai-training-media.service';
import { AiToolsService } from './ai-tools.service';
import { AiTransferService } from './ai-transfer.service';
import { AutomationService } from './automation.service';
import { AiChatDto, AiProviderConfigDto, AiSettingsDto, AiTextTaskDto, AutomationRuleDto, CrawlWebsiteDto, ExecuteToolDto, FaqDto, KnowledgeTextDto, MemoryDto, SatisfactionDto, SearchDto, TestAiProviderDto, ToolDto, TransferConversationDto } from './dto/ai.dto';

@ApiTags('AI')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('ai')
export class AiController {
  constructor(
    private readonly assistant: AiAssistantService,
    private readonly knowledge: AiKnowledgeService,
    private readonly memory: AiMemoryService,
    private readonly tools: AiToolsService,
    private readonly media: AiMediaService,
    private readonly costs: AiCostService,
    private readonly settings: AiSettingsService,
    private readonly providerConfig: AiProviderConfigService,
    private readonly transfer: AiTransferService,
    private readonly automation: AutomationService,
    private readonly trainingMedia: AiTrainingMediaService,
    private readonly prisma: PrismaService,
  ) {}

  @Post('chat')
  @RequirePermissions(Permission.AI_ACCESS)
  chat(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Body() dto: AiChatDto) { return this.assistant.chat(principal.teamId, principal.userId, dto); }

  @Post('conversations/:id/suggest-reply')
  @RequirePermissions(Permission.AI_ACCESS)
  suggest(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Param('id') id: string) { return this.assistant.conversationTask(principal.teamId, principal.userId, id, 'suggest_reply'); }

  @Post('conversations/:id/summarize')
  @RequirePermissions(Permission.AI_ACCESS)
  summarize(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Param('id') id: string) { return this.assistant.conversationTask(principal.teamId, principal.userId, id, 'summarize_conversation'); }

  @Post('rewrite')
  @RequirePermissions(Permission.AI_ACCESS)
  rewrite(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Body() dto: AiTextTaskDto) { return this.assistant.rewrite(principal.teamId, principal.userId, dto); }

  @Post('translate')
  @RequirePermissions(Permission.AI_ACCESS)
  translate(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Body() dto: AiTextTaskDto) { return this.assistant.translate(principal.teamId, principal.userId, dto); }

  @Post('sentiment')
  @RequirePermissions(Permission.AI_ACCESS)
  sentiment(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Body() dto: AiTextTaskDto) { return this.assistant.classify(principal.teamId, principal.userId, 'sentiment_analysis', dto.text); }

  @Post('intent')
  @RequirePermissions(Permission.AI_ACCESS)
  intent(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Body() dto: AiTextTaskDto) { return this.assistant.classify(principal.teamId, principal.userId, 'intent_detection', dto.text); }

  @Post('spam')
  @RequirePermissions(Permission.AI_ACCESS)
  spam(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Body() dto: AiTextTaskDto) { return this.assistant.classify(principal.teamId, principal.userId, 'spam_detection', dto.text); }

  @Post('lead-qualification')
  @RequirePermissions(Permission.AI_ACCESS)
  lead(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Body() dto: AiTextTaskDto) { return this.assistant.classify(principal.teamId, principal.userId, 'lead_qualification', dto.text); }

  @Post('classification')
  @RequirePermissions(Permission.AI_ACCESS)
  classification(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Body() dto: AiTextTaskDto) { return this.assistant.classify(principal.teamId, principal.userId, 'conversation_classification', dto.text); }

  @Post('smart-routing')
  @RequirePermissions(Permission.AI_ACCESS)
  routing(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Body() dto: AiTextTaskDto) { return this.assistant.classify(principal.teamId, principal.userId, 'smart_routing_department_agent_priority', dto.text); }

  @Get('knowledge')
  @RequirePermissions(Permission.AI_ACCESS)
  knowledgeList(@CurrentPrincipal() principal: AuthenticatedPrincipal) { return this.knowledge.list(principal.teamId); }

  @Post('knowledge/text')
  @RequirePermissions(Permission.AI_MANAGE_KNOWLEDGE)
  ingestText(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Body() dto: KnowledgeTextDto) { return this.knowledge.ingestText(principal.teamId, dto); }

  @Post('knowledge/faq')
  @RequirePermissions(Permission.AI_MANAGE_KNOWLEDGE)
  faq(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Body() dto: FaqDto) { return this.knowledge.ingestText(principal.teamId, { title: `FAQ: ${dto.question}`, content: `Question: ${dto.question}\nAnswer: ${dto.answer}`, mimeType: 'text/faq' }); }

  @Post('knowledge/crawl')
  @RequirePermissions(Permission.AI_MANAGE_KNOWLEDGE)
  crawl(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Body() dto: CrawlWebsiteDto) { return this.knowledge.crawl(principal.teamId, dto.url); }

  @Post('knowledge/document')
  @UseInterceptors(FileInterceptor('file'))
  @RequirePermissions(Permission.AI_MANAGE_KNOWLEDGE)
  document(@CurrentPrincipal() principal: AuthenticatedPrincipal, @UploadedFile() file: UploadedMediaFile) { return this.knowledge.ingestUpload(principal.teamId, file); }

  @Post('search')
  @RequirePermissions(Permission.AI_ACCESS)
  search(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Body() dto: SearchDto) { return this.knowledge.search(principal.teamId, dto.query); }

  @Get('memory')
  @RequirePermissions(Permission.AI_ACCESS)
  memoryList(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Query('scope') scope?: string) { return this.memory.list(principal.teamId, scope); }

  @Post('memory')
  @RequirePermissions(Permission.AI_ACCESS)
  memoryUpsert(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Body() dto: MemoryDto) { return this.memory.upsert(principal.teamId, principal.userId, dto); }

  @Get('tools')
  @RequirePermissions(Permission.AI_MANAGE_TOOLS)
  toolsList(@CurrentPrincipal() principal: AuthenticatedPrincipal) { return this.tools.list(principal.teamId); }

  @Post('tools')
  @RequirePermissions(Permission.AI_MANAGE_TOOLS)
  toolsCreate(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Body() dto: ToolDto) { return this.tools.create(principal.teamId, dto); }

  @Post('tools/:id/execute')
  @RequirePermissions(Permission.AI_MANAGE_TOOLS)
  toolsExecute(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Param('id') id: string, @Body() dto: ExecuteToolDto) { return this.tools.execute(principal.teamId, id, dto); }

  @Post('voice/speech')
  @RequirePermissions(Permission.AI_ACCESS)
  async speech(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Body() dto: AiTextTaskDto) {
    return new StreamableFile(await this.media.speech(principal.teamId, dto.text), { type: 'audio/mpeg' });
  }

  @Post('voice/transcribe')
  @UseInterceptors(FileInterceptor('file'))
  @RequirePermissions(Permission.AI_ACCESS)
  transcribe(@CurrentPrincipal() principal: AuthenticatedPrincipal, @UploadedFile() file: UploadedMediaFile) {
    return this.media.transcribe(principal.teamId, file).then((text) => ({ text }));
  }

  @Post('ocr')
  @UseInterceptors(FileInterceptor('file'))
  @RequirePermissions(Permission.AI_ACCESS)
  ocr(@UploadedFile() file: UploadedMediaFile) { return this.media.ocr(file); }

  @Get('costs')
  @RequirePermissions(Permission.AI_VIEW_COSTS)
  costSummary(@CurrentPrincipal() principal: AuthenticatedPrincipal) { return this.costs.summary(principal.teamId); }

  @Get('settings')
  @RequirePermissions(Permission.AI_ACCESS)
  getSettings(@CurrentPrincipal() principal: AuthenticatedPrincipal) { return this.settings.get(principal.teamId); }

  @Post('settings')
  @RequirePermissions(Permission.AI_MANAGE_TOOLS)
  updateSettings(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Body() dto: AiSettingsDto) { return this.settings.update(principal.teamId, dto); }

  @Get('providers')
  @RequirePermissions(Permission.AI_MANAGE_TOOLS)
  getProvider(@CurrentPrincipal() principal: AuthenticatedPrincipal) { return this.providerConfig.get(principal.teamId); }

  @Post('providers')
  @RequirePermissions(Permission.AI_MANAGE_TOOLS)
  updateProvider(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Body() dto: AiProviderConfigDto) {
    return this.providerConfig.update(principal.teamId, principal.userId, dto);
  }

  @Post('providers/test')
  @RequirePermissions(Permission.AI_MANAGE_TOOLS)
  testProvider(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Body() dto: TestAiProviderDto) {
    return this.providerConfig.test(principal.teamId, principal.userId, dto);
  }

  @Post('providers/models')
  @RequirePermissions(Permission.AI_MANAGE_TOOLS)
  listProviderModels(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Body() dto: TestAiProviderDto) {
    return this.providerConfig.listModels(principal.teamId, dto);
  }

  @Get('automation')
  @RequirePermissions(Permission.AI_ACCESS)
  listAutomation(@CurrentPrincipal() principal: AuthenticatedPrincipal) { return this.automation.list(principal.teamId); }

  @Post('automation')
  @RequirePermissions(Permission.AI_MANAGE_TOOLS)
  createAutomation(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Body() dto: AutomationRuleDto) { return this.automation.create(principal.teamId, dto); }

  @Post('automation/:id')
  @RequirePermissions(Permission.AI_MANAGE_TOOLS)
  updateAutomation(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Param('id') id: string, @Body() dto: AutomationRuleDto) { return this.automation.update(principal.teamId, id, dto); }

  @Post('automation/:id/delete')
  @RequirePermissions(Permission.AI_MANAGE_TOOLS)
  deleteAutomation(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Param('id') id: string) { return this.automation.delete(principal.teamId, id); }

  @Post('conversations/:id/transfer')
  @RequirePermissions(Permission.CONVERSATION_ASSIGN)
  transferConversation(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Param('id') id: string, @Body() dto: TransferConversationDto) {
    return this.transfer.transfer({ teamId: principal.teamId, conversationId: id, reason: dto.reason, initiatedByUserId: principal.userId, assigneeUserId: dto.assigneeUserId });
  }

  @Post('conversations/:id/reactivate')
  @RequirePermissions(Permission.INBOX_WRITE)
  reactivateAi(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Param('id') id: string) { return this.transfer.reactivateAi(principal.teamId, id, principal.userId!); }

  @Post('conversations/:id/pause')
  @RequirePermissions(Permission.INBOX_WRITE)
  pauseAi(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Param('id') id: string) { return this.transfer.pauseAi(principal.teamId, id, principal.userId); }

  @Get('transfers')
  @RequirePermissions(Permission.ANALYTICS_READ)
  listTransfers(@CurrentPrincipal() principal: AuthenticatedPrincipal) {
    return this.prisma.conversationTransfer.findMany({ where: { teamId: principal.teamId }, orderBy: { createdAt: 'desc' }, take: 100, include: { conversation: { select: { id: true, subject: true } }, assignedUser: { select: { id: true, name: true } } } });
  }

  @Post('satisfaction')
  @RequirePermissions(Permission.AI_ACCESS)
  recordSatisfaction(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Body() dto: SatisfactionDto) {
    return this.prisma.customerSatisfaction.create({ data: { teamId: principal.teamId, conversationId: dto.conversationId, rating: dto.rating, comment: dto.comment } });
  }

  @Get('training-media')
  @RequirePermissions(Permission.AI_MANAGE_KNOWLEDGE)
  listTrainingMedia(@CurrentPrincipal() principal: AuthenticatedPrincipal) {
    return this.trainingMedia.list(principal.teamId);
  }

  @Post('training-media')
  @UseInterceptors(FileInterceptor('file'))
  @RequirePermissions(Permission.AI_MANAGE_KNOWLEDGE)
  uploadTrainingMedia(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @UploadedFile() file: UploadedMediaFile,
    @Body('title') title: string,
    @Body('productName') productName?: string,
    @Body('description') description?: string,
    @Body('tags') tags?: string,
  ) {
    return this.trainingMedia.upload(principal.teamId, file, { title: title || file.originalname, productName, description, tags });
  }

  @Get('training-media/:id/file')
  @RequirePermissions(Permission.AI_MANAGE_KNOWLEDGE)
  async trainingMediaFile(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const file = await this.trainingMedia.getFile(principal.teamId, id);
    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('Content-Length', file.sizeBytes);
    res.setHeader('Cache-Control', 'private, max-age=86400');
    file.stream.pipe(res);
  }

  @Post('training-media/:id/delete')
  @RequirePermissions(Permission.AI_MANAGE_KNOWLEDGE)
  deleteTrainingMedia(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Param('id') id: string) {
    return this.trainingMedia.remove(principal.teamId, id);
  }
}
