import { Injectable } from '@nestjs/common';
import { Prisma } from '@watsapp/database';
import { PrismaService } from '../prisma/prisma.service';
import { parseModelJson } from './json';
import { OpenAIProvider } from './providers/openai.provider';
import { PROVIDER_NOT_CONFIGURED, ProviderError } from './providers/provider-error';
import { ProviderRegistry } from './providers/provider-registry';

const ANALYSIS_SYSTEM = `You are Chatloora Product Intelligence. Analyze product photos and user-supplied facts.
Return JSON only. Never invent regulatory, medical, or efficacy claims.
Distinguish userProvided vs inferred. Mark uncertain OCR. Confidence is high|medium|low.
Do not stereotype people.`;

@Injectable()
export class ProductIntelligenceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly openai: OpenAIProvider,
    private readonly registry: ProviderRegistry,
  ) {}

  async analyze(teamId: string, userId: string, projectId: string, images: Array<{ mimeType: string; dataBase64: string }>) {
    if (!this.openai.isConfigured()) {
      throw new ProviderError(PROVIDER_NOT_CONFIGURED, 'OpenAI غير معدّ لتحليل المنتج.', 503);
    }
    const project = await this.prisma.creativeProject.findFirst({
      where: { id: projectId, teamId },
      include: { productProfile: true },
    });
    if (!project) throw new ProviderError('INVALID_MODEL', 'المشروع غير موجود.', 404);
    const profile = project.productProfile;
    const user = [
      `Name: ${profile?.name || project.name}`,
      `Description: ${profile?.description || ''}`,
      `Category: ${profile?.category || ''}`,
      `Brand: ${profile?.brand || ''}`,
      `Ingredients: ${profile?.ingredients || ''}`,
      `Price: ${profile?.price || ''} ${profile?.currency || ''}`,
      `Audience: ${profile?.targetAudience || ''}`,
      `User claims (authoritative, do not expand): ${profile?.userClaims || profile?.benefits || ''}`,
      `Extra: ${profile?.extra || ''}`,
      'Return JSON with keys: overallConfidence, identity{name,category,brand,productType,confidence}, visual{colors,packaging,logo,style,shape,materials,lighting,cameraAngle,composition,confidence}, ocr{items:[{text,language,uncertain}]}, components[], audience{suggested,confidence}, claims{userProvided:[],inferred:[],warning}, aiUnderstanding, factsUncertain[]',
    ].join('\n');

    const result = await this.openai.completeText({
      model: this.registry.openaiTextModel(),
      system: ANALYSIS_SYSTEM,
      user,
      images,
      json: true,
    });
    const intelligence = parseModelJson<Record<string, unknown>>(result.text);
    const identity = (intelligence.identity || {}) as Record<string, string>;
    const updated = await this.prisma.creativeProductProfile.upsert({
      where: { projectId },
      create: {
        teamId,
        userId,
        projectId,
        name: (identity.name || profile?.name || project.name).toString(),
        description: profile?.description,
        category: identity.category || profile?.category,
        brand: identity.brand || profile?.brand,
        intelligence: intelligence as Prisma.InputJsonValue,
        analyzedAt: new Date(),
      },
      update: {
        category: identity.category || profile?.category,
        brand: identity.brand || profile?.brand,
        intelligence: intelligence as Prisma.InputJsonValue,
        analyzedAt: new Date(),
      },
    });
    await this.prisma.creativeProject.update({
      where: { id: projectId },
      data: { status: 'DRAFT' },
    });
    await this.prisma.aiCostEvent.create({
      data: {
        teamId,
        provider: 'openai',
        model: result.model,
        operation: 'creative.intelligence',
        promptTokens: result.promptTokens || 0,
        completionTokens: result.completionTokens || 0,
        costCents: 0,
      },
    });
    return updated;
  }

  async generateBrief(teamId: string, userId: string, projectId: string, hints?: Record<string, string | undefined>) {
    if (!this.openai.isConfigured()) {
      throw new ProviderError(PROVIDER_NOT_CONFIGURED, 'OpenAI غير معدّ لإنشاء الموجز الإبداعي.', 503);
    }
    const project = await this.prisma.creativeProject.findFirst({
      where: { id: projectId, teamId },
      include: { productProfile: true },
    });
    if (!project?.productProfile) throw new ProviderError('INVALID_MODEL', 'حلّل المنتج أولاً.', 400);
    const result = await this.openai.completeText({
      model: this.registry.openaiTextModel(),
      system: 'You are a Creative Director. Return JSON only with: objective, audience, platform, aspectRatio, visualStyle, environment, lighting, cameraStyle, modelRequirements, productPlacement, messaging, restrictions. Do not add unverified claims.',
      user: JSON.stringify({
        profile: project.productProfile,
        hints,
        locale: project.locale,
        aspectRatio: project.aspectRatio,
      }),
      json: true,
    });
    const payload = parseModelJson<Record<string, string>>(result.text);
    return this.prisma.creativeBrief.upsert({
      where: { projectId },
      create: {
        teamId,
        userId,
        projectId,
        objective: payload.objective,
        audience: payload.audience,
        platform: payload.platform,
        aspectRatio: payload.aspectRatio || project.aspectRatio,
        visualStyle: payload.visualStyle,
        environment: payload.environment,
        lighting: payload.lighting,
        cameraStyle: payload.cameraStyle,
        modelRequirements: payload.modelRequirements,
        productPlacement: payload.productPlacement,
        messaging: payload.messaging,
        restrictions: payload.restrictions,
        payload: payload as Prisma.InputJsonValue,
      },
      update: {
        objective: payload.objective,
        audience: payload.audience,
        platform: payload.platform,
        aspectRatio: payload.aspectRatio || project.aspectRatio,
        visualStyle: payload.visualStyle,
        environment: payload.environment,
        lighting: payload.lighting,
        cameraStyle: payload.cameraStyle,
        modelRequirements: payload.modelRequirements,
        productPlacement: payload.productPlacement,
        messaging: payload.messaging,
        restrictions: payload.restrictions,
        payload: payload as Prisma.InputJsonValue,
      },
    });
  }

  async generateConcepts(teamId: string, userId: string, projectId: string) {
    if (!this.openai.isConfigured()) {
      throw new ProviderError(PROVIDER_NOT_CONFIGURED, 'OpenAI غير معدّ لتوليد المفاهيم.', 503);
    }
    const project = await this.prisma.creativeProject.findFirst({
      where: { id: projectId, teamId },
      include: { productProfile: true, briefs: true },
    });
    if (!project?.productProfile) throw new ProviderError('INVALID_MODEL', 'حلّل المنتج أولاً.', 400);
    const result = await this.openai.completeText({
      model: this.registry.openaiTextModel(),
      system: `Return JSON {concepts:[{key,title,description,visualDirection,environment,modelDirection,cameraDirection,lighting,composition,productPlacement,recommendedAspectRatio,recommendedDurationSec,rationale,generationRequirements}]}.
Provide 5 concepts: premium_hero, product_model, lifestyle, professional, social_ad.
Do not invent claims.`,
      user: JSON.stringify({
        product: project.productProfile,
        brief: project.briefs[0] || null,
      }),
      json: true,
    });
    const parsed = parseModelJson<{ concepts?: Array<Record<string, unknown>> }>(result.text);
    const concepts = parsed.concepts || [];
    await this.prisma.creativeConcept.deleteMany({ where: { projectId, teamId } });
    const rows = [];
    for (let i = 0; i < concepts.length; i += 1) {
      const c = concepts[i]!;
      rows.push(
        await this.prisma.creativeConcept.create({
          data: {
            teamId,
            userId,
            projectId,
            key: String(c.key || `c${i + 1}`),
            title: String(c.title || `Concept ${i + 1}`),
            position: i,
            payload: c as Prisma.InputJsonValue,
          },
        }),
      );
    }
    return rows;
  }
}
