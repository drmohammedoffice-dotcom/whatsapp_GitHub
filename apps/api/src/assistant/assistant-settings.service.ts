import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@watsapp/database';
import { PrismaService } from '../prisma/prisma.service';

export type AssistantSettings = {
  enabled: boolean;
  model: string;
  systemPrompt: string;
  welcomeAr: string;
  welcomeEn: string;
  dailyLimit: number;
  supportPhone: string;
  supportWhatsApp: string;
};

const KEY = 'assistant.config';

const DEFAULT_PROMPT = `أنت مساعد Chatloora الرسمي داخل المنصة. اسمك Chatloora AI Assistant.
تصرف كموظف دعم ذكي: ودود، واضح، محترم. افهم العربية الفصحى واللهجة العراقية والإنجليزية، وأجب بلغة المستخدم.
مهمتك شرح استخدام Chatloora وتشخيص المشاكل خطوة بخطوة (واتساب، إنستغرام، فيسبوك، تيليغرام، TikTok والبكسل، WhatsApp API، الذكاء الاصطناعي، المنتجات، الرسائل، التعليقات، المواعيد، الطلبيات، الباقات).
استخدم فقط معرفة المنصة وحالة الحساب الآمنة المعطاة لك. لا تخترع صفحات أو أزرار غير مذكورة. لا تدّعِ أنك نفذت عملية لم تنفذها.
يمكنك تحليل لقطات الشاشة التي يرسلها المستخدم لتشخيص الخلل داخل Chatloora فقط.
إذا طلب فتح قسم أو رابط داخل المنصة، وجّهه عبر إجراء التنقل المسموح (لا تختلق صفحات).
أنت للقراءة والتوجيه فقط: لا تحذف حسابات ولا تغيّر الاشتراك ولا تلمس التوكنات أو كلمات المرور.
إذا لم تعرف الجواب بوضوح قل ذلك ولا تعطِ معلومة غير مؤكدة، ثم اقترح موظف الدعم.
إذا طلب المستخدم موظفاً بشرياً، وجّهه بلطف إلى زر واتساب الدعم.
بعد الشرح اقترح خطوة تالية مفيدة عند الحاجة.`;

export const DEFAULT_ASSISTANT_SETTINGS: AssistantSettings = {
  enabled: true,
  model: '',
  systemPrompt: DEFAULT_PROMPT,
  welcomeAr: 'كيف أستطيع مساعدتك اليوم؟',
  welcomeEn: 'How can I help you today?',
  dailyLimit: 80,
  supportPhone: '07864314333',
  supportWhatsApp: '9647864314333',
};

@Injectable()
export class AssistantSettingsService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async onModuleInit() {
    await this.ensure();
  }

  async ensure() {
    const existing = await this.prisma.systemSetting.findUnique({ where: { key: KEY } });
    if (existing) return;
    await this.prisma.systemSetting.create({
      data: { key: KEY, category: 'assistant', value: DEFAULT_ASSISTANT_SETTINGS as never },
    });
  }

  async get(): Promise<AssistantSettings> {
    await this.ensure();
    const row = await this.prisma.systemSetting.findUnique({ where: { key: KEY } });
    const stored = (row?.value ?? {}) as Partial<AssistantSettings>;
    const model =
      stored.model?.trim() ||
      this.config.get<string>('AI_GATEWAY_CHAT_MODEL') ||
      this.config.get<string>('AI_CHAT_MODEL') ||
      'gpt-4o-mini';
    return {
      ...DEFAULT_ASSISTANT_SETTINGS,
      ...stored,
      model,
      enabled: stored.enabled !== false,
      dailyLimit: Number(stored.dailyLimit ?? DEFAULT_ASSISTANT_SETTINGS.dailyLimit) || 80,
      supportPhone: stored.supportPhone || DEFAULT_ASSISTANT_SETTINGS.supportPhone,
      supportWhatsApp: stored.supportWhatsApp || DEFAULT_ASSISTANT_SETTINGS.supportWhatsApp,
    };
  }

  async update(patch: Partial<AssistantSettings>) {
    const current = await this.get();
    const next: AssistantSettings = {
      ...current,
      ...patch,
      dailyLimit: Math.max(1, Number(patch.dailyLimit ?? current.dailyLimit)),
    };
    await this.prisma.systemSetting.upsert({
      where: { key: KEY },
      create: { key: KEY, category: 'assistant', value: next as unknown as Prisma.InputJsonValue },
      update: { value: next as unknown as Prisma.InputJsonValue, category: 'assistant' },
    });
    return next;
  }
}
