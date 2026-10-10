import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { AppointmentVertical } from '@watsapp/database';
import { PlanEntitlementsService } from '../billing/plan-entitlements.service';
import { PrismaService } from '../prisma/prisma.service';
import type { BusinessHoursConfig } from './appointment-slots.util';
import { assertValidTimeZone } from './appointment-timezone.util';
import type { UpdateAppointmentProfileDto, UpsertServiceDto, UpsertStaffDto } from './dto/appointment.dto';

@Injectable()
export class AppointmentProfileService {
  private readonly logger = new Logger(AppointmentProfileService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly entitlements: PlanEntitlementsService,
  ) {}

  async ensure(teamId: string) {
    return this.prisma.appointmentBusinessProfile.upsert({
      where: { teamId },
      update: {},
      create: { teamId, vertical: AppointmentVertical.CLINIC },
      include: {
        staff: { orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] },
        services: { orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] },
      },
    });
  }

  async get(teamId: string) {
    return this.ensure(teamId);
  }

  async update(teamId: string, dto: UpdateAppointmentProfileDto) {
    if (dto.enabled) {
      await this.entitlements.assertAppointmentsEnabled(teamId);
    }
    await this.ensure(teamId);
    if (dto.timezone) {
      try {
        assertValidTimeZone(dto.timezone);
      } catch {
        throw new BadRequestException('Invalid clinic timezone');
      }
    }
    const updated = await this.prisma.appointmentBusinessProfile.update({
      where: { teamId },
      data: {
        vertical: dto.vertical,
        orgName: dto.orgName === undefined ? undefined : dto.orgName,
        description: dto.description === undefined ? undefined : dto.description,
        phone: dto.phone === undefined ? undefined : dto.phone,
        email: dto.email === undefined ? undefined : dto.email,
        address: dto.address === undefined ? undefined : dto.address,
        timezone: dto.timezone,
        defaultDurationMin: dto.defaultDurationMin,
        bufferMin: dto.bufferMin,
        bufferBeforeMin: dto.bufferBeforeMin,
        bufferAfterMin: dto.bufferAfterMin,
        breakMin: dto.breakMin,
        maxDailyAppointments: dto.maxDailyAppointments === undefined ? undefined : dto.maxDailyAppointments,
        bookingWindowDays: dto.bookingWindowDays,
        instructions: dto.instructions === undefined ? undefined : dto.instructions,
        faqJson: dto.faqJson === undefined ? undefined : (dto.faqJson as object),
        clinicKnowledge:
          dto.clinicKnowledge === undefined
            ? undefined
            : (dto.clinicKnowledge as object),
        businessHours: dto.businessHours === undefined ? undefined : (dto.businessHours as object),
        aiCanReply: dto.aiCanReply,
        aiCanCreate: dto.aiCanCreate,
        aiCanUpdate: dto.aiCanUpdate,
        aiCanCancel: dto.aiCanCancel,
        aiCanReadCalendar: dto.aiCanReadCalendar,
        aiCanSendReminders: dto.aiCanSendReminders,
        enabled: dto.enabled,
      },
      include: {
        staff: { orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] },
        services: { orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] },
      },
    });
    this.logger.log(`[Appointments] Profile updated teamId=${teamId} enabled=${updated.enabled}`);
    return updated;
  }

  async addStaff(teamId: string, dto: UpsertStaffDto) {
    const profile = await this.ensure(teamId);
    return this.prisma.appointmentStaff.create({
      data: {
        teamId,
        profileId: profile.id,
        name: dto.name.trim(),
        title: dto.title?.trim() || null,
        specialty: dto.specialty?.trim() || null,
        bio: dto.bio?.trim() || null,
        phone: dto.phone?.trim() || null,
        email: dto.email?.trim() || null,
        isActive: dto.isActive ?? true,
        sortOrder: dto.sortOrder ?? 0,
      },
    });
  }

  async updateStaff(teamId: string, id: string, dto: UpsertStaffDto) {
    const row = await this.prisma.appointmentStaff.findFirst({ where: { id, teamId } });
    if (!row) throw new NotFoundException('Staff not found');
    return this.prisma.appointmentStaff.update({
      where: { id },
      data: {
        name: dto.name.trim(),
        title: dto.title?.trim() || null,
        specialty: dto.specialty?.trim() || null,
        bio: dto.bio?.trim() || null,
        phone: dto.phone?.trim() || null,
        email: dto.email?.trim() || null,
        isActive: dto.isActive,
        sortOrder: dto.sortOrder,
      },
    });
  }

  async removeStaff(teamId: string, id: string) {
    const row = await this.prisma.appointmentStaff.findFirst({ where: { id, teamId } });
    if (!row) throw new NotFoundException('Staff not found');
    await this.prisma.appointmentStaff.delete({ where: { id } });
    return { ok: true };
  }

  async addService(teamId: string, dto: UpsertServiceDto) {
    const profile = await this.ensure(teamId);
    return this.prisma.appointmentServiceOffer.create({
      data: {
        teamId,
        profileId: profile.id,
        staffId: dto.staffId || null,
        name: dto.name.trim(),
        description: dto.description?.trim() || null,
        durationMin: dto.durationMin ?? profile.defaultDurationMin,
        priceCents: dto.priceCents ?? null,
        currency: dto.currency ?? 'IQD',
        isActive: dto.isActive ?? true,
        sortOrder: dto.sortOrder ?? 0,
      },
    });
  }

  async updateService(teamId: string, id: string, dto: UpsertServiceDto) {
    const row = await this.prisma.appointmentServiceOffer.findFirst({ where: { id, teamId } });
    if (!row) throw new NotFoundException('Service not found');
    return this.prisma.appointmentServiceOffer.update({
      where: { id },
      data: {
        name: dto.name.trim(),
        description: dto.description?.trim() || null,
        durationMin: dto.durationMin,
        priceCents: dto.priceCents,
        currency: dto.currency,
        staffId: dto.staffId === undefined ? undefined : dto.staffId || null,
        isActive: dto.isActive,
        sortOrder: dto.sortOrder,
      },
    });
  }

  async removeService(teamId: string, id: string) {
    const row = await this.prisma.appointmentServiceOffer.findFirst({ where: { id, teamId } });
    if (!row) throw new NotFoundException('Service not found');
    await this.prisma.appointmentServiceOffer.delete({ where: { id } });
    return { ok: true };
  }

  businessHoursOf(profile: {
    businessHours?: unknown | null;
    timezone?: string;
  }): BusinessHoursConfig {
    const configured = (profile.businessHours as BusinessHoursConfig | null) ?? {};
    return {
      ...configured,
      timezone: profile.timezone ?? configured.timezone ?? 'Asia/Baghdad',
    };
  }

  /** Compact context block for the AI system prompt. */
  async buildAiContext(teamId: string): Promise<string | null> {
    const profile = await this.prisma.appointmentBusinessProfile.findUnique({
      where: { teamId },
      include: {
        staff: { where: { isActive: true }, orderBy: { sortOrder: 'asc' }, take: 20 },
        services: { where: { isActive: true }, orderBy: { sortOrder: 'asc' }, take: 30 },
      },
    });
    if (!profile?.enabled) return null;

    const faq = Array.isArray(profile.faqJson)
      ? (profile.faqJson as Array<{ q?: string; a?: string }>)
          .slice(0, 12)
          .map((item, i) => `Q${i + 1}: ${item.q ?? ''}\nA${i + 1}: ${item.a ?? ''}`)
          .join('\n')
      : '';

    const staff = profile.staff
      .map((s, i) => `D${i + 1}|id=${s.id}|name=${s.name}|title=${s.title ?? ''}|specialty=${s.specialty ?? ''}`)
      .join('\n');
    const services = profile.services
      .map(
        (s, i) =>
          `S${i + 1}|id=${s.id}|name=${s.name}|duration=${s.durationMin}m|price=${s.priceCents ?? 'n/a'} ${s.currency}|staffId=${s.staffId ?? 'any'}`,
      )
      .join('\n');
    const clinicKnowledge = profile.clinicKnowledge
      ? Object.entries(profile.clinicKnowledge as Record<string, unknown>)
          .filter(([, value]) => value !== null && value !== '' && value !== undefined)
          .map(([key, value]) =>
            `${key}: ${Array.isArray(value) ? value.join(', ') : String(value)}`,
          )
          .join('\n')
      : '';

    return [
      `Organization: ${profile.orgName ?? 'Business'} (${profile.vertical})`,
      profile.description ? `About: ${profile.description}` : '',
      profile.phone ? `Phone: ${profile.phone}` : '',
      profile.address ? `Address: ${profile.address}` : '',
      `Timezone: ${profile.timezone}`,
      `Default duration: ${profile.defaultDurationMin} minutes`,
      profile.instructions ? `Instructions:\n${profile.instructions}` : '',
      clinicKnowledge ? `Clinic Knowledge:\n${clinicKnowledge}` : '',
      staff ? `Staff:\n${staff}` : '',
      services ? `Services:\n${services}` : '',
      faq ? `FAQ:\n${faq}` : '',
      `Capabilities: create=${profile.aiCanCreate} update=${profile.aiCanUpdate} cancel=${profile.aiCanCancel} calendar=${profile.aiCanReadCalendar}`,
    ]
      .filter(Boolean)
      .join('\n');
  }
}
