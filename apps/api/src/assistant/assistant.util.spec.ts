import {
  inferNavigateAction,
  parseAssistantActions,
  sanitizeAssistantPath,
  wantsInAppNavigation,
} from './assistant-nav';
import { ASSISTANT_KNOWLEDGE_SEED } from './assistant-knowledge.catalog';
import {
  looksUnanswered,
  retrieveArticleScore,
  supportWhatsAppUrl,
  toIraqWhatsAppE164,
  wantsHumanSupport,
} from './assistant.util';

describe('assistant helpers', () => {
  it('builds a correct Iraq WhatsApp link', () => {
    expect(toIraqWhatsAppE164('07864314333')).toBe('9647864314333');
    expect(supportWhatsAppUrl('07864314333')).toBe('https://wa.me/9647864314333');
    expect(supportWhatsAppUrl('9647864314333', 'hello')).toContain('https://wa.me/9647864314333?text=');
  });

  it('detects human support intent in Iraqi Arabic and English', () => {
    expect(wantsHumanSupport('أريد موظف')).toBe(true);
    expect(wantsHumanSupport('ما أريد الذكاء الاصطناعي')).toBe(true);
    expect(wantsHumanSupport('talk to a human')).toBe(true);
    expect(wantsHumanSupport('شلون أربط الواتساب')).toBe(false);
  });

  it('retrieves WhatsApp knowledge for Iraqi phrasing', () => {
    const article = ASSISTANT_KNOWLEDGE_SEED.find((row) => row.slug === 'whatsapp-inbox')!;
    expect(retrieveArticleScore('شلون أربط الواتساب؟', article)).toBeGreaterThan(0);
    expect(retrieveArticleScore('how to connect instagram', article)).toBeLessThan(
      retrieveArticleScore('how to connect instagram', ASSISTANT_KNOWLEDGE_SEED.find((row) => row.slug === 'instagram')!),
    );
  });

  it('marks uncertain replies as unanswered', () => {
    expect(looksUnanswered('ما لقيت جواب مؤكد لهذه الحالة')).toBe(true);
    expect(looksUnanswered('افتح صفحة واتساب وامسح رمز QR')).toBe(false);
  });

  it('only allows in-app assistant navigation paths', () => {
    expect(sanitizeAssistantPath('/pricing')).toBe('/pricing');
    expect(sanitizeAssistantPath('/admin/users')).toBeNull();
    expect(sanitizeAssistantPath('https://evil.example')).toBeNull();
    expect(wantsInAppNavigation('افتح قسم الباقات')).toBe(true);
    expect(inferNavigateAction('افتح قسم الباقات')?.path).toBe('/pricing');
    const parsed = parseAssistantActions('تم\n<<<ACTIONS\n[{"type":"navigate","path":"/whatsapp"}]\nACTIONS>>>');
    expect(parsed.text).toContain('تم');
    expect(parsed.actions[0]?.path).toBe('/whatsapp');
  });
});
