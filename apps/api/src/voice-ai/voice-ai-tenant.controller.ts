import { BadRequestException, Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { IsBoolean, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentPrincipal } from '../common/current-principal.decorator';
import { AuthenticatedPrincipal } from '../common/principal';
import { PlanEntitlementsService } from '../billing/plan-entitlements.service';
import { PrismaService } from '../prisma/prisma.service';
import { VoiceAiCallService } from './voice-ai-call.service';
import { VoiceAiSettingsService } from './voice-ai-settings.service';
import { normalizeE164 } from './voice-ai.util';

class UpsertAgentDto {
  @IsOptional() @IsString() @MaxLength(80) name?: string;
  @IsOptional() @IsBoolean() enabled?: boolean;
  @IsOptional() @IsString() @MaxLength(20) language?: string;
  @IsOptional() @IsString() @MaxLength(60) voiceName?: string;
  @IsOptional() @IsString() @MaxLength(500) greeting?: string;
  @IsOptional() @IsString() @MaxLength(300) unclearMessage?: string;
  @IsOptional() @IsString() @MaxLength(300) holdMessage?: string;
  @IsOptional() @IsString() @MaxLength(300) handoffMessage?: string;
  @IsOptional() @IsInt() @Min(30) maxDurationSec?: number;
  @IsOptional() @IsBoolean() recordingEnabled?: boolean;
  @IsOptional() @IsBoolean() transcriptEnabled?: boolean;
  @IsOptional() @IsBoolean() summaryEnabled?: boolean;
}

class AddNumberDto {
  @IsString() @MaxLength(20) e164!: string;
}

@Controller('voice-ai')
@UseGuards(JwtAuthGuard)
export class VoiceAiTenantController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly calls: VoiceAiCallService,
    private readonly settings: VoiceAiSettingsService,
    private readonly entitlements: PlanEntitlementsService,
  ) {}

  @Get('me')
  async me(@CurrentPrincipal() principal: AuthenticatedPrincipal) {
    await this.entitlements.assertVoiceAiEnabled(principal.teamId);
    const platform = await this.settings.getPlatform();
    const agent = await this.prisma.voiceAgent.findFirst({
      where: { teamId: principal.teamId },
      include: { phoneNumbers: true },
    });
    return { platformEnabled: platform.enabled, agent };
  }

  @Patch('me')
  async updateMe(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Body() body: UpsertAgentDto) {
    await this.entitlements.assertVoiceAiEnabled(principal.teamId);
    const existing = await this.prisma.voiceAgent.findFirst({ where: { teamId: principal.teamId } });
    if (!existing) {
      return this.prisma.voiceAgent.create({
        data: {
          teamId: principal.teamId,
          name: body.name || 'Voice Agent',
          enabled: body.enabled ?? true,
          language: body.language || 'ar-AE',
          voiceName: body.voiceName || 'Polly.Zeina',
          greeting: body.greeting || 'أهلاً بيك، شلون أگدر أساعدك؟',
          unclearMessage: body.unclearMessage || 'ما سمعتك زين، تكدر تعيد؟',
          holdMessage: body.holdMessage || 'لحظة واحدة.',
          handoffMessage: body.handoffMessage || 'راح أحولك للدعم.',
          maxDurationSec: body.maxDurationSec ?? 600,
          recordingEnabled: body.recordingEnabled ?? false,
          transcriptEnabled: body.transcriptEnabled ?? true,
          summaryEnabled: body.summaryEnabled ?? true,
        },
        include: { phoneNumbers: true },
      });
    }
    return this.prisma.voiceAgent.update({
      where: { id: existing.id },
      data: body,
      include: { phoneNumbers: true },
    });
  }

  @Post('numbers')
  async addNumber(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Body() body: AddNumberDto) {
    await this.entitlements.assertVoiceAiEnabled(principal.teamId);
    const e164 = normalizeE164(body.e164);
    if (!e164) throw new BadRequestException('Phone number is required');
    let agent = await this.prisma.voiceAgent.findFirst({ where: { teamId: principal.teamId } });
    if (!agent) {
      agent = await this.prisma.voiceAgent.create({
        data: {
          teamId: principal.teamId,
          greeting: 'أهلاً بيك، شلون أگدر أساعدك؟',
          unclearMessage: 'ما سمعتك زين، تكدر تعيد؟',
          holdMessage: 'لحظة واحدة.',
          handoffMessage: 'راح أحولك للدعم.',
        },
      });
    }
    return this.prisma.voicePhoneNumber.create({
      data: { teamId: principal.teamId, agentId: agent.id, e164, provider: 'twilio' },
    });
  }

  @Get('calls')
  async callsList(@CurrentPrincipal() principal: AuthenticatedPrincipal) {
    await this.entitlements.assertVoiceAiEnabled(principal.teamId);
    return this.calls.listCalls({ teamId: principal.teamId });
  }

  @Get('calls/:id')
  call(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Param('id') id: string) {
    return this.calls.getCallForTeam(principal.teamId, id);
  }

  @Get('stats')
  async stats(@CurrentPrincipal() principal: AuthenticatedPrincipal) {
    await this.entitlements.assertVoiceAiEnabled(principal.teamId);
    return this.calls.stats(principal.teamId);
  }
}
