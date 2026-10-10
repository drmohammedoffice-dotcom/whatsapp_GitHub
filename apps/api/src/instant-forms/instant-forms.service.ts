import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  InstantFormAdPlatform,
  InstantFormOrderStatus,
  InstantFormStatus,
  Prisma,
} from '@watsapp/database';
import { createReadStream } from 'fs';
import { access } from 'fs/promises';
import { randomBytes } from 'crypto';
import { extname } from 'path';
import { UploadedMediaFile } from '../common/uploaded-media-file';
import { PrismaService } from '../prisma/prisma.service';
import { LocalStorageService } from '../storage/local-storage.service';
import { TikTokIntegrationTrackingService } from '../tiktok-integration/tiktok-integration-tracking.service';
import {
  InstantFormDocument,
  InstantFormField,
  IRAQI_PHONE_ERROR,
  isValidIraqiPhone,
  normalizeIraqiPhone,
  starterDocument,
} from './instant-form.document';
import { getTemplateDocument, INSTANT_FORM_TEMPLATES } from './instant-form.templates';
import {
  CreateInstantFormDto,
  ListOrdersQueryDto,
  SubmitInstantFormDto,
  UpdateInstantFormDto,
  UpdateOrderDto,
} from './dto/instant-form.dto';

function slugify(input: string): string {
  // Keep public URLs ASCII-only so Arabic form names don't break browser encoding.
  const base = input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  const suffix = randomBytes(3).toString('hex');
  return (base || 'form') + '-' + suffix;
}

function shortCode(): string {
  return randomBytes(4).toString('hex');
}

function orderNumber(): string {
  const d = new Date();
  const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  return `IF-${stamp}-${randomBytes(3).toString('hex').toUpperCase()}`;
}

function asDocument(value: unknown): InstantFormDocument {
  return value as InstantFormDocument;
}

function sumChoiceUnits(raw: unknown): number {
  if (raw == null || raw === '') return 0;
  if (Array.isArray(raw)) {
    return raw.reduce((sum: number, item) => {
      if (typeof item === 'string' && item.trim()) return sum + 1;
      if (item && typeof item === 'object' && 'label' in item) {
        return sum + Math.max(1, Number((item as { qty?: unknown }).qty) || 1);
      }
      return sum;
    }, 0);
  }
  if (typeof raw === 'string' && raw.trim()) return 1;
  if (typeof raw === 'object' && raw && 'label' in (raw as object)) {
    return Math.max(1, Number((raw as { qty?: unknown }).qty) || 1);
  }
  return 0;
}

function buildOrderDisplayPayload(
  document: InstantFormDocument,
  fields: InstantFormField[],
  answers: Record<string, unknown>,
  quantity: number,
  unitPrice: number | null,
  totalPrice: number | null,
) {
  const skip = new Set([
    'name',
    'phone',
    'whatsapp',
    'email',
    'address',
    'area',
    'city',
    'governorate',
    'notes',
    'landmark',
    'image_upload',
    'file_upload',
    'quantity',
  ]);
  const lines: Array<{ label: string; value: string }> = [];
  for (const field of fields) {
    if (skip.has(field.type)) continue;
    const value = fieldValue(answers, field);
    if (!value) continue;
    lines.push({ label: field.label || field.type, value });
  }
  return {
    product: document.product?.name || null,
    unitPrice,
    quantity,
    totalPrice,
    currency: document.product?.currency || 'IQD',
    lines,
    summary: lines.map((l) => `${l.label}: ${l.value}`).join(' | '),
  };
}

function extractFields(doc: InstantFormDocument): InstantFormField[] {
  const formBlock = doc.blocks.find((b) => b.type === 'form');
  const fields = ((formBlock?.props?.fields as InstantFormField[] | undefined) ?? []).filter(
    (f) => !f.hidden,
  );

  for (const block of doc.blocks) {
    if (block.type !== 'multi_choice') continue;
    const choices = (block.props.choices as InstantFormField['choices']) || [];
    fields.push({
      id: block.id,
      type: 'multiselect',
      label: String(block.props.title || 'اختيارات متعددة'),
      required: Boolean(block.props.required),
      allowMultiple: block.props.allowMultiple !== false,
      withQuantity: block.props.showQuantity !== false,
      choices,
      options: choices.map((c) => c.label).filter(Boolean),
    });
  }

  return fields;
}

function fieldValue(answers: Record<string, unknown>, field: InstantFormField): string {
  const raw = answers[field.id] ?? answers[field.type];
  if (Array.isArray(raw)) {
    return raw
      .map((item) => {
        if (typeof item === 'string') return item;
        if (item && typeof item === 'object' && 'label' in item) {
          const label = String((item as { label: unknown }).label || '').trim();
          if (!label) return '';
          const qty = Math.max(1, Number((item as { qty?: unknown }).qty) || 1);
          const sizes = Array.isArray((item as { sizes?: unknown }).sizes)
            ? ((item as { sizes: unknown[] }).sizes || [])
                .map((s) => String(s ?? '').trim())
                .filter(Boolean)
            : [];
          const sizePart = sizes.length ? ` (قياس: ${sizes.join('، ')})` : '';
          return qty > 1 ? `${label} × ${qty}${sizePart}` : `${label}${sizePart}`;
        }
        return String(item ?? '');
      })
      .filter(Boolean)
      .join('، ');
  }
  if (raw == null) return '';
  return String(raw).trim();
}

function validateAnswers(fields: InstantFormField[], answers: Record<string, unknown>) {
  const errors: Array<{ fieldId: string; message: string }> = [];
  for (const field of fields) {
    if (field.type === 'phone' || field.type === 'whatsapp') {
      const digits = normalizeIraqiPhone(answers[field.id] ?? answers[field.type]);
      if (field.required && !digits) {
        errors.push({
          fieldId: field.id,
          message: field.validation?.errorMessage || `${field.label} مطلوب`,
        });
        continue;
      }
      if (!digits) continue;
      if (!isValidIraqiPhone(digits)) {
        errors.push({
          fieldId: field.id,
          message: field.validation?.errorMessage || IRAQI_PHONE_ERROR,
        });
      }
      continue;
    }

    const value = fieldValue(answers, field);
    if (field.required && !value) {
      errors.push({
        fieldId: field.id,
        message: field.validation?.errorMessage || `${field.label} مطلوب`,
      });
      continue;
    }
    if (!value) continue;
    const { validation } = field;
    if (validation?.minLength && value.length < validation.minLength) {
      errors.push({
        fieldId: field.id,
        message: validation.errorMessage || `الحد الأدنى ${validation.minLength} أحرف`,
      });
    }
    if (validation?.maxLength && value.length > validation.maxLength) {
      errors.push({
        fieldId: field.id,
        message: validation.errorMessage || `الحد الأقصى ${validation.maxLength} أحرف`,
      });
    }
    if (validation?.regex) {
      try {
        const re = new RegExp(validation.regex);
        if (!re.test(value)) {
          errors.push({
            fieldId: field.id,
            message: validation.errorMessage || 'القيمة غير صحيحة',
          });
        }
      } catch {
        /* ignore bad regex from editor */
      }
    }
    if (field.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      errors.push({
        fieldId: field.id,
        message: validation?.errorMessage || 'البريد غير صحيح',
      });
    }

    if (field.type === 'color' && field.withSizes !== false) {
      const sizeOpts = (field.sizeOptions || []).map((s) => s.trim()).filter(Boolean);
      if (sizeOpts.length) {
        const raw = answers[field.id] ?? answers[field.type];
        if (Array.isArray(raw) && raw.length) {
          for (const item of raw) {
            if (!item || typeof item !== 'object' || !('label' in item)) continue;
            const qty = Math.max(1, Number((item as { qty?: unknown }).qty) || 1);
            const sizes = Array.isArray((item as { sizes?: unknown }).sizes)
              ? ((item as { sizes: unknown[] }).sizes || []).map((s) => String(s ?? '').trim())
              : [];
            const filled = sizes.slice(0, qty).filter(Boolean);
            if (filled.length < qty) {
              errors.push({
                fieldId: field.id,
                message: 'يرجى اختيار القياس لكل قطعة مطلوبة',
              });
              break;
            }
          }
        }
      }
    }
  }
  return errors;
}

@Injectable()
export class InstantFormsService {
  private readonly logger = new Logger(InstantFormsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly storage: LocalStorageService,
    @Inject(forwardRef(() => TikTokIntegrationTrackingService))
    private readonly tiktokTracking: TikTokIntegrationTrackingService,
  ) {}

  private webBase(): string {
    return (this.config.get<string>('WEB_PUBLIC_URL') || 'http://localhost:3000').replace(/\/$/, '');
  }

  private apiBase(): string {
    return (this.config.get<string>('API_PUBLIC_URL') || 'http://localhost:4000').replace(/\/$/, '');
  }

  /** يحلّ بكسل تيك توك المرتبط بالاستمارة (حتى لو لم يُحفظ pixelIntegrationId سابقاً) */
  private async resolveLinkedPixelIntegrationId(form: {
    id: string;
    teamId: string;
    pixelIntegrationId: string | null;
    shortCode: string;
    slug: string;
  }): Promise<string | null> {
    if (form.pixelIntegrationId) {
      const ok = await this.prisma.tikTokIntegration.findFirst({
        where: { id: form.pixelIntegrationId, teamId: form.teamId },
        select: { id: true },
      });
      if (ok) return ok.id;
    }

    const integrations = await this.prisma.tikTokIntegration.findMany({
      where: {
        teamId: form.teamId,
        OR: [
          { redirectDestinationType: 'INSTANT_FORM' },
          { externalRedirectUrl: { contains: '/f/' } },
        ],
      },
      orderBy: { updatedAt: 'desc' },
      take: 40,
    });

    const byUrl = integrations.find((item) => {
      const url = item.externalRedirectUrl || '';
      return (
        url.includes(form.shortCode)
        || url.includes(`/f/s/${form.shortCode}`)
        || url.includes(`/f/${form.slug}`)
        || url.includes(form.slug)
      );
    });

    // إن وُجد أكثر من بكسل استمارة بدون تطابق رابط: خذ أحدث بكسل مكتمل الإعداد
    const picked =
      byUrl
      || integrations.find((item) => item.wizardCompleted && item.pixelCode)
      || integrations[0]
      || null;

    if (!picked) return null;

    await this.prisma.instantForm.update({
      where: { id: form.id },
      data: { pixelIntegrationId: picked.id },
    }).catch(() => undefined);

    if (!picked.externalRedirectUrl?.includes(form.shortCode)) {
      await this.linkPixelRedirectToForm(
        picked.id,
        form.teamId,
        `${this.webBase()}/f/s/${form.shortCode}`,
      ).catch(() => undefined);
    }

    return picked.id;
  }

  async uploadMedia(teamId: string, file: UploadedMediaFile | undefined) {
    if (!file?.buffer?.length) throw new BadRequestException('الملف مطلوب');
    if (!file.mimetype?.startsWith('image/')) {
      throw new BadRequestException('يُسمح برفع الصور فقط (JPG/PNG/WebP/GIF)');
    }
    if (file.size > 8 * 1024 * 1024) {
      throw new BadRequestException('حجم الصورة يجب أن يكون أقل من 8MB');
    }
    const stored = await this.storage.putMedia(teamId, file);
    const url = `${this.apiBase()}/api/v1/instant-forms/public/assets?key=${encodeURIComponent(stored.storageKey)}`;
    return {
      url,
      storageKey: stored.storageKey,
      sizeBytes: stored.sizeBytes,
      mimeType: file.mimetype,
      fileName: file.originalname,
    };
  }

  async openPublicAsset(key: string) {
    const decoded = decodeURIComponent(key || '').replace(/\\/g, '/');
    if (!decoded.startsWith('media/') || decoded.includes('..')) {
      throw new BadRequestException('Invalid media key');
    }
    const path = this.storage.resolvePath(decoded);
    try {
      await access(path);
    } catch {
      throw new NotFoundException('File not found');
    }
    const ext = extname(decoded).toLowerCase();
    const type =
      ext === '.png'
        ? 'image/png'
        : ext === '.webp'
          ? 'image/webp'
          : ext === '.gif'
            ? 'image/gif'
            : 'image/jpeg';
    return { stream: createReadStream(path), type };
  }

  private toView(row: {
    id: string;
    name: string;
    slug: string;
    shortCode: string;
    adPlatform: InstantFormAdPlatform;
    adAccountLabel: string | null;
    status: InstantFormStatus;
    templateKey: string | null;
    draftDocument: Prisma.JsonValue;
    publishedDocument: Prisma.JsonValue | null;
    publishedAt: Date | null;
    whatsappNumber: string | null;
    pixelIntegrationId: string | null;
    seoTitle: string | null;
    seoDescription: string | null;
    createdAt: Date;
    updatedAt: Date;
    _count?: { orders: number };
  }) {
    const shortUrl = `${this.webBase()}/f/s/${row.shortCode}`;
    // Prefer short ASCII URL so Arabic form names don't break shared/preview links.
    const publicUrl = shortUrl;
    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      shortCode: row.shortCode,
      adPlatform: row.adPlatform,
      adAccountLabel: row.adAccountLabel,
      status: row.status,
      templateKey: row.templateKey,
      draftDocument: asDocument(row.draftDocument),
      publishedDocument: row.publishedDocument ? asDocument(row.publishedDocument) : null,
      publishedAt: row.publishedAt,
      whatsappNumber: row.whatsappNumber,
      pixelIntegrationId: row.pixelIntegrationId,
      seoTitle: row.seoTitle,
      seoDescription: row.seoDescription,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      ordersCount: row._count?.orders ?? 0,
      publicUrl,
      shortUrl,
      qrUrl: `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(publicUrl)}`,
    };
  }

  listTemplates() {
    return INSTANT_FORM_TEMPLATES.map((t) => ({
      key: t.key,
      nameAr: t.nameAr,
      nameEn: t.nameEn,
      category: t.category,
      descriptionAr: t.descriptionAr,
    }));
  }

  async list(teamId: string, opts?: { status?: InstantFormStatus; q?: string }) {
    const rows = await this.prisma.instantForm.findMany({
      where: {
        teamId,
        ...(opts?.status ? { status: opts.status } : {}),
        ...(opts?.q
          ? {
              OR: [
                { name: { contains: opts.q, mode: 'insensitive' } },
                { slug: { contains: opts.q, mode: 'insensitive' } },
                { adAccountLabel: { contains: opts.q, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      include: { _count: { select: { orders: true } } },
      orderBy: { updatedAt: 'desc' },
    });
    return rows.map((r) => this.toView(r));
  }

  async get(teamId: string, id: string) {
    const row = await this.prisma.instantForm.findFirst({
      where: { id, teamId },
      include: { _count: { select: { orders: true } } },
    });
    if (!row) throw new NotFoundException('Form not found');
    return this.toView(row);
  }

  async create(teamId: string, userId: string | undefined, dto: CreateInstantFormDto) {
    const document = dto.draftDocument
      ? asDocument(dto.draftDocument)
      : dto.templateKey
        ? getTemplateDocument(dto.templateKey)
        : starterDocument(dto.name);
    if (document.product) document.product.name = document.product.name || dto.name;
    const hero = document.blocks.find((b) => b.type === 'hero');
    if (hero && !dto.draftDocument) hero.props = { ...hero.props, title: dto.name };

    const row = await this.prisma.instantForm.create({
      data: {
        teamId,
        createdByUserId: userId,
        name: dto.name,
        slug: slugify(dto.name),
        shortCode: shortCode(),
        adPlatform: dto.adPlatform,
        adAccountLabel: dto.adAccountLabel,
        templateKey: dto.templateKey ?? (dto.draftDocument ? 'ai' : null),
        whatsappNumber: dto.whatsappNumber,
        pixelIntegrationId: dto.pixelIntegrationId ?? null,
        draftDocument: document as unknown as Prisma.InputJsonValue,
        status: InstantFormStatus.DRAFT,
      },
      include: { _count: { select: { orders: true } } },
    });
    return this.toView(row);
  }

  async update(teamId: string, id: string, dto: UpdateInstantFormDto) {
    await this.get(teamId, id);
    const row = await this.prisma.instantForm.update({
      where: { id },
      data: {
        ...(dto.name != null ? { name: dto.name } : {}),
        ...(dto.adAccountLabel !== undefined ? { adAccountLabel: dto.adAccountLabel } : {}),
        ...(dto.adPlatform != null ? { adPlatform: dto.adPlatform } : {}),
        ...(dto.whatsappNumber !== undefined ? { whatsappNumber: dto.whatsappNumber } : {}),
        ...(dto.pixelIntegrationId !== undefined ? { pixelIntegrationId: dto.pixelIntegrationId } : {}),
        ...(dto.seoTitle !== undefined ? { seoTitle: dto.seoTitle } : {}),
        ...(dto.seoDescription !== undefined ? { seoDescription: dto.seoDescription } : {}),
        ...(dto.draftDocument
          ? { draftDocument: dto.draftDocument as Prisma.InputJsonValue }
          : {}),
      },
      include: { _count: { select: { orders: true } } },
    });
    const view = this.toView(row);
    if (
      dto.pixelIntegrationId
      && row.status === InstantFormStatus.PUBLISHED
      && row.publishedDocument
    ) {
      await this.linkPixelRedirectToForm(dto.pixelIntegrationId, teamId, view.publicUrl).catch(() => undefined);
    }
    return view;
  }

  async saveDraft(teamId: string, id: string, draftDocument: InstantFormDocument) {
    return this.update(teamId, id, { draftDocument: draftDocument as unknown as Record<string, unknown> });
  }

  async publish(teamId: string, id: string, userId?: string) {
    const form = await this.prisma.instantForm.findFirst({ where: { id, teamId } });
    if (!form) throw new NotFoundException('Form not found');
    const document = asDocument(form.draftDocument);
    const last = await this.prisma.instantFormVersion.findFirst({
      where: { formId: id },
      orderBy: { version: 'desc' },
    });
    const nextVersion = (last?.version ?? 0) + 1;
    const [row] = await this.prisma.$transaction([
      this.prisma.instantForm.update({
        where: { id },
        data: {
          publishedDocument: form.draftDocument as Prisma.InputJsonValue,
          publishedAt: new Date(),
          status: InstantFormStatus.PUBLISHED,
        },
        include: { _count: { select: { orders: true } } },
      }),
      this.prisma.instantFormVersion.create({
        data: {
          formId: id,
          version: nextVersion,
          label: `v${nextVersion}`,
          document: document as unknown as Prisma.InputJsonValue,
          createdBy: userId,
        },
      }),
    ]);
    const view = this.toView(row);
    if (row.pixelIntegrationId) {
      await this.linkPixelRedirectToForm(row.pixelIntegrationId, teamId, view.publicUrl).catch(() => undefined);
    }
    return view;
  }

  /** إنشاء ونشر استمارة فورية مربوطة ببكسل — رابط البكسل يفتح الاستمارة والطلبات تذهب لقسم الطلبات */
  async ensureLeadFormForPixel(input: {
    teamId: string;
    userId?: string;
    pixelIntegrationId: string;
    pixelName?: string | null;
    instantFormId?: string | null;
  }) {
    if (input.instantFormId?.trim()) {
      return this.attachFormToPixel({
        teamId: input.teamId,
        userId: input.userId,
        pixelIntegrationId: input.pixelIntegrationId,
        formId: input.instantFormId.trim(),
      });
    }

    const existing = await this.prisma.instantForm.findFirst({
      where: {
        teamId: input.teamId,
        pixelIntegrationId: input.pixelIntegrationId,
        status: { not: InstantFormStatus.ARCHIVED },
      },
      orderBy: { updatedAt: 'desc' },
      include: { _count: { select: { orders: true } } },
    });
    if (existing) {
      if (existing.status !== InstantFormStatus.PUBLISHED) {
        return this.publish(input.teamId, existing.id, input.userId);
      }
      const view = this.toView(existing);
      await this.linkPixelRedirectToForm(input.pixelIntegrationId, input.teamId, view.publicUrl);
      return view;
    }
    const name = `استمارة ${input.pixelName?.trim() || 'البكسل'}`.slice(0, 120);
    const created = await this.create(input.teamId, input.userId, {
      name,
      adPlatform: InstantFormAdPlatform.TIKTOK,
      pixelIntegrationId: input.pixelIntegrationId,
      templateKey: 'lead',
    });
    return this.publish(input.teamId, created.id, input.userId);
  }

  /** ربط استمارة موجودة ببكسل التتبع ونشرها إن كانت مسودة */
  async attachFormToPixel(input: {
    teamId: string;
    userId?: string;
    pixelIntegrationId: string;
    formId: string;
  }) {
    const form = await this.prisma.instantForm.findFirst({
      where: {
        id: input.formId,
        teamId: input.teamId,
        status: { not: InstantFormStatus.ARCHIVED },
      },
    });
    if (!form) {
      throw new BadRequestException('الاستمارة الفورية غير موجودة أو مؤرشفة');
    }

    await this.prisma.instantForm.update({
      where: { id: form.id },
      data: { pixelIntegrationId: input.pixelIntegrationId },
    });

    if (form.status !== InstantFormStatus.PUBLISHED || !form.publishedDocument) {
      return this.publish(input.teamId, form.id, input.userId);
    }

    const refreshed = await this.prisma.instantForm.findFirstOrThrow({
      where: { id: form.id },
      include: { _count: { select: { orders: true } } },
    });
    const view = this.toView(refreshed);
    await this.linkPixelRedirectToForm(input.pixelIntegrationId, input.teamId, view.publicUrl);
    return view;
  }

  private async linkPixelRedirectToForm(pixelIntegrationId: string, teamId: string, publicUrl: string) {
    const integration = await this.prisma.tikTokIntegration.findFirst({
      where: { id: pixelIntegrationId, teamId },
    });
    if (!integration) return;
    await this.prisma.tikTokIntegration.update({
      where: { id: integration.id },
      data: {
        redirectDestinationType: 'INSTANT_FORM',
        externalRedirectUrl: publicUrl,
      },
    });
  }

  async duplicate(teamId: string, id: string, userId?: string) {
    const src = await this.prisma.instantForm.findFirst({ where: { id, teamId } });
    if (!src) throw new NotFoundException('Form not found');
    const row = await this.prisma.instantForm.create({
      data: {
        teamId,
        createdByUserId: userId,
        name: `${src.name} (نسخة)`,
        slug: slugify(src.name),
        shortCode: shortCode(),
        adPlatform: src.adPlatform,
        adAccountLabel: src.adAccountLabel,
        templateKey: src.templateKey,
        whatsappNumber: src.whatsappNumber,
        draftDocument: src.draftDocument as Prisma.InputJsonValue,
        status: InstantFormStatus.DRAFT,
      },
      include: { _count: { select: { orders: true } } },
    });
    return this.toView(row);
  }

  async archive(teamId: string, id: string) {
    await this.get(teamId, id);
    const row = await this.prisma.instantForm.update({
      where: { id },
      data: { status: InstantFormStatus.ARCHIVED },
      include: { _count: { select: { orders: true } } },
    });
    return this.toView(row);
  }

  async remove(teamId: string, id: string) {
    await this.get(teamId, id);
    await this.prisma.instantForm.delete({ where: { id } });
    return { ok: true };
  }

  async listVersions(teamId: string, id: string) {
    await this.get(teamId, id);
    return this.prisma.instantFormVersion.findMany({
      where: { formId: id },
      orderBy: { version: 'desc' },
      select: { id: true, version: true, label: true, createdAt: true, createdBy: true },
    });
  }

  async restoreVersion(teamId: string, id: string, versionId: string) {
    await this.get(teamId, id);
    const version = await this.prisma.instantFormVersion.findFirst({
      where: { id: versionId, formId: id },
    });
    if (!version) throw new NotFoundException('Version not found');
    const row = await this.prisma.instantForm.update({
      where: { id },
      data: { draftDocument: version.document as Prisma.InputJsonValue },
      include: { _count: { select: { orders: true } } },
    });
    return this.toView(row);
  }

  async getPublicBySlug(slug: string) {
    const row = await this.prisma.instantForm.findFirst({
      where: {
        OR: [{ slug }, { shortCode: slug }],
        status: InstantFormStatus.PUBLISHED,
      },
    });
    if (!row || !row.publishedDocument) throw new NotFoundException('Form not found');
    let tiktokPixelCode: string | null = null;
    const pixelIntegrationId = await this.resolveLinkedPixelIntegrationId(row);
    if (pixelIntegrationId) {
      const pixel = await this.prisma.tikTokIntegration.findUnique({
        where: { id: pixelIntegrationId },
        select: { pixelCode: true },
      });
      tiktokPixelCode = pixel?.pixelCode ?? null;
    }
    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      shortCode: row.shortCode,
      adPlatform: row.adPlatform,
      whatsappNumber: row.whatsappNumber,
      seoTitle: row.seoTitle ?? row.name,
      seoDescription: row.seoDescription,
      document: asDocument(row.publishedDocument),
      tiktokPixelCode,
      pixelIntegrationId,
    };
  }

  async submitPublic(
    slug: string,
    dto: SubmitInstantFormDto,
    meta: { ip?: string; userAgent?: string },
  ) {
    const row = await this.prisma.instantForm.findFirst({
      where: {
        OR: [{ slug }, { shortCode: slug }],
        status: InstantFormStatus.PUBLISHED,
      },
    });
    if (!row || !row.publishedDocument) throw new NotFoundException('Form not found');
    const document = asDocument(row.publishedDocument);
    const fields = extractFields(document);
    for (const field of fields) {
      if (field.type !== 'color') continue;
      if (!field.sizeOptions?.length && document.product?.sizes?.length) {
        field.sizeOptions = [...document.product.sizes];
      }
    }
    const answers: Record<string, unknown> = { ...(dto.answers || {}) };
    for (const field of fields) {
      if (field.type !== 'phone' && field.type !== 'whatsapp') continue;
      if (answers[field.id] != null) {
        answers[field.id] = normalizeIraqiPhone(answers[field.id]);
      }
    }
    const errors = validateAnswers(fields, answers);
    if (errors.length) {
      throw new BadRequestException({ message: 'Validation failed', errors });
    }

    const byType = (type: string) => {
      const field = fields.find((f) => f.type === type);
      return field ? fieldValue(answers, field) : '';
    };

    const quantityRaw = byType('quantity') || '';
    const choiceQtySum = (fields || []).reduce((sum, field) => {
      if (field.type !== 'multiselect' && field.type !== 'color') return sum;
      return sum + sumChoiceUnits(answers[field.id]);
    }, 0);
    const quantityField = Math.max(0, Number.parseInt(quantityRaw, 10) || 0);
    // Prefer pieces from colors / multi-choice; fall back to quantity field.
    const quantity = Math.max(1, choiceQtySum > 0 ? choiceQtySum : quantityField || 1);
    const unitPrice = document.product?.price ?? null;
    const totalPrice = unitPrice != null ? Number(unitPrice) * quantity : null;

    answers._display = buildOrderDisplayPayload(
      document,
      fields,
      answers,
      quantity,
      unitPrice,
      totalPrice,
    );

    const order = await this.prisma.instantFormOrder.create({
      data: {
        teamId: row.teamId,
        formId: row.id,
        orderNumber: orderNumber(),
        status: InstantFormOrderStatus.NEW,
        customerName: byType('name') || null,
        customerPhone: byType('phone') || null,
        customerWhatsapp: byType('whatsapp') || byType('phone') || null,
        customerEmail: byType('email') || null,
        city: byType('city') || null,
        governorate: byType('governorate') || null,
        address: byType('address') || byType('area') || null,
        productName: document.product?.name || row.name,
        quantity,
        unitPrice: unitPrice != null ? new Prisma.Decimal(unitPrice) : null,
        totalPrice: totalPrice != null ? new Prisma.Decimal(totalPrice) : null,
        currency: document.product?.currency || 'IQD',
        answers: answers as Prisma.InputJsonValue,
        notes: byType('notes') || null,
        adPlatform: row.adPlatform,
        adAccountLabel: row.adAccountLabel,
        ipAddress: meta.ip,
        userAgent: meta.userAgent,
        deviceType: dto.deviceType,
        browser: dto.browser,
        utmSource: dto.utmSource,
        utmMedium: dto.utmMedium,
        utmCampaign: dto.utmCampaign,
        utmContent: dto.utmContent,
        utmTerm: dto.utmTerm,
        ttclid: dto.ttclid,
        fbclid: dto.fbclid,
        gclid: dto.gclid,
      },
    });

    // أول طلب في الاستمارة → Events API لتيك توك (تفعيل هدف التحسين + إحصائيات البكسل)
    const pixelIntegrationId = await this.resolveLinkedPixelIntegrationId(row);
    let pixelTracked = false;
    let trackEventName: string | null = null;
    if (pixelIntegrationId) {
      const trackValue =
        totalPrice != null && Number.isFinite(Number(totalPrice)) && Number(totalPrice) > 0
          ? Number(totalPrice)
          : unitPrice != null && Number.isFinite(Number(unitPrice)) && Number(unitPrice) > 0
            ? Number(unitPrice)
            : 1;
      const pageUrl = `${this.webBase()}/f/${encodeURIComponent(row.slug)}`;
      try {
        const trackResult = await this.tiktokTracking.trackEcommerceOrderConversion({
          integrationId: pixelIntegrationId,
          orderId: order.id,
          orderNumber: order.orderNumber,
          ttclid: dto.ttclid,
          phone: order.customerWhatsapp || order.customerPhone,
          value: trackValue,
          currency: order.currency || 'IQD',
          pageUrl,
          ip: meta.ip,
          userAgent: meta.userAgent,
          kind: 'INSTANT_FORM',
          eventId: dto.eventId || undefined,
        });
        pixelTracked = Boolean(trackResult?.ok);
        trackEventName = (trackResult as { eventName?: string } | null)?.eventName ?? null;
        this.logger.log(
          `[InstantForm] order=${order.orderNumber} pixel=${pixelIntegrationId} track=${JSON.stringify(trackResult)}`,
        );
      } catch (err) {
        this.logger.warn(
          `[InstantForm] pixel track failed order=${order.orderNumber}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    } else {
      this.logger.warn(
        `[InstantForm] no linked pixel for form=${row.id} order=${order.orderNumber} — order saved but Events API skipped`,
      );
    }

    return {
      ok: true,
      orderId: order.id,
      orderNumber: order.orderNumber,
      thankYou: document.thankYou,
      whatsappNumber: row.whatsappNumber,
      formName: row.name,
      pixelTracked,
      trackEventName,
    };
  }

  async listOrders(teamId: string, query: ListOrdersQueryDto) {
    const page = query.page ?? 1;
    const pageSize = Math.min(query.pageSize ?? 20, 100);
    const where: Prisma.InstantFormOrderWhereInput = {
      teamId,
      ...(query.formId ? { formId: query.formId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.q
        ? {
            OR: [
              { orderNumber: { contains: query.q, mode: 'insensitive' } },
              { customerName: { contains: query.q, mode: 'insensitive' } },
              { customerPhone: { contains: query.q, mode: 'insensitive' } },
              { city: { contains: query.q, mode: 'insensitive' } },
              { productName: { contains: query.q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const sortKey = query.sort ?? 'submittedAt';
    const order = query.order === 'asc' ? 'asc' : 'desc';
    const [total, items] = await this.prisma.$transaction([
      this.prisma.instantFormOrder.count({ where }),
      this.prisma.instantFormOrder.findMany({
        where,
        include: { form: { select: { id: true, name: true, slug: true } } },
        orderBy: { [sortKey]: order },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    return { total, page, pageSize, items };
  }

  async getOrder(teamId: string, id: string) {
    const order = await this.prisma.instantFormOrder.findFirst({
      where: { id, teamId },
      include: { form: { select: { id: true, name: true, slug: true } } },
    });
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  async updateOrder(teamId: string, id: string, dto: UpdateOrderDto) {
    await this.getOrder(teamId, id);
    return this.prisma.instantFormOrder.update({
      where: { id },
      data: {
        ...(dto.status != null ? { status: dto.status } : {}),
        ...(dto.internalNotes !== undefined ? { internalNotes: dto.internalNotes } : {}),
        ...(dto.customerName !== undefined ? { customerName: dto.customerName } : {}),
        ...(dto.customerPhone !== undefined ? { customerPhone: dto.customerPhone } : {}),
        ...(dto.city !== undefined ? { city: dto.city } : {}),
        ...(dto.address !== undefined ? { address: dto.address } : {}),
        ...(dto.quantity != null ? { quantity: dto.quantity } : {}),
      },
      include: { form: { select: { id: true, name: true, slug: true } } },
    });
  }

  async deleteOrder(teamId: string, id: string) {
    await this.getOrder(teamId, id);
    await this.prisma.instantFormOrder.delete({ where: { id } });
    return { ok: true };
  }

  async exportOrdersCsv(
    teamId: string,
    opts?: { formId?: string; since?: string; mode?: 'all' | 'new' },
  ) {
    const formId = opts?.formId;
    const mode = opts?.mode === 'new' ? 'new' : 'all';
    let sinceDate: Date | null = null;
    if (mode === 'new' && opts?.since) {
      const parsed = new Date(opts.since);
      if (!Number.isNaN(parsed.getTime())) sinceDate = parsed;
    }

    const items = await this.prisma.instantFormOrder.findMany({
      where: {
        teamId,
        ...(formId ? { formId } : {}),
        ...(sinceDate ? { submittedAt: { gt: sinceDate } } : {}),
      },
      include: { form: { select: { name: true } } },
      orderBy: { submittedAt: 'asc' },
      take: 5000,
    });

    // Absolute sequence numbers across the full form/team history (oldest = 1).
    const priorCount = sinceDate
      ? await this.prisma.instantFormOrder.count({
          where: {
            teamId,
            ...(formId ? { formId } : {}),
            submittedAt: { lte: sinceDate },
          },
        })
      : 0;

    const header = [
      '#',
      'orderNumber',
      'status',
      'customerName',
      'customerPhone',
      'city',
      'address',
      'productName',
      'selections',
      'quantity',
      'unitPrice',
      'totalPrice',
      'currency',
      'form',
      'adPlatform',
      'ttclid',
      'fbclid',
      'utmSource',
      'utmCampaign',
      'submittedAt',
    ];
    const lines = [header.join(',')];
    for (let i = 0; i < items.length; i++) {
      const o = items[i]!;
      const display = (o.answers as { _display?: { summary?: string } } | null)?._display;
      const selections = display?.summary || '';
      const row = [
        String(priorCount + i + 1),
        o.orderNumber,
        o.status,
        o.customerName,
        o.customerPhone,
        o.city,
        o.address,
        o.productName,
        selections,
        o.quantity,
        o.unitPrice?.toString() ?? '',
        o.totalPrice?.toString() ?? '',
        o.currency,
        o.form.name,
        o.adPlatform,
        o.ttclid,
        o.fbclid,
        o.utmSource,
        o.utmCampaign,
        o.submittedAt.toISOString(),
      ].map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`);
      lines.push(row.join(','));
    }

    const cursor =
      items.length > 0
        ? items[items.length - 1]!.submittedAt.toISOString()
        : sinceDate?.toISOString() || new Date().toISOString();

    return {
      csv: lines.join('\n'),
      count: items.length,
      cursor,
      mode,
    };
  }
}
