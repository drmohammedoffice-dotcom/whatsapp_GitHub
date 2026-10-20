export type EditIntent = {
  targetType: 'SCENE' | 'PROJECT' | 'VOICE' | 'MUSIC' | 'BACKGROUND' | 'MODEL' | 'SCRIPT';
  targetId?: string;
  target: string;
  changes: string[];
  changeMap: Record<string, string>;
  preserve: string[];
  regenerationScope: 'asset' | 'scene' | 'project';
  sceneIndex?: number;
  action?: 'DELETE_LAST_SCENE' | 'ADD_SCENE' | 'SHORTEN' | 'REGENERATE';
  preservationGuaranteed: boolean;
  userMessage: string;
};

const BACKGROUND = /خلفية|background/i;
const MODEL = /موديل|model|persona|امرأة|رجل/i;
const CLOTHING = /ملابس|لباس|clothing|outfit/i;
const LIGHTING = /إضاءة|اضاءة|lighting/i;
const CAMERA = /كاميرا|زاوية|camera|angle/i;
const SCENE = /مشهد\s*(\d+)|scene\s*(\d+)/i;
const HOSPITAL = /مستشفى|عيادة|hospital|clinic/i;
const LARGER = /أكبر|bigger|larger/i;
const VOICE = /صوت|voice|نسائي|رجالي|أنثوي/i;
const MUSIC = /موسيقى|music/i;
const IRAQI = /عراق|iraqi|لهجة/i;
const DELETE_LAST = /احذف\s*المشهد\s*الأخير|delete\s*(the\s*)?last\s*scene/i;
const ADD_SCENE = /أضف\s*مشهد|add\s*(a\s*)?scene/i;
const SHORTER = /أقصر|أقصر|shorter|أقصر/i;
const QUIET = /هادئة|هادئه|quiet|calm|elegant|سينما/i;
const PRODUCT_ONLY = /المنتج|product/i;

export function parseEditIntent(instruction: string): EditIntent {
  const text = instruction.trim();
  const changes: string[] = [];
  const changeMap: Record<string, string> = {};
  const preserve = ['product', 'packaging', 'logo', 'labels'];
  let target = 'scene';
  let targetType: EditIntent['targetType'] = 'SCENE';
  let regenerationScope: EditIntent['regenerationScope'] = 'asset';
  let sceneIndex: number | undefined;
  let action: EditIntent['action'] = 'REGENERATE';
  let preservationGuaranteed = false;

  if (/المشهد الثاني|scene two|scene 2/i.test(text)) {
    regenerationScope = 'scene';
    sceneIndex = 2;
  }
  if (/المشهد الثالث|scene three|scene 3/i.test(text)) {
    regenerationScope = 'scene';
    sceneIndex = 3;
  }
  const scene = text.match(SCENE);
  if (scene) {
    regenerationScope = 'scene';
    sceneIndex = Number(scene[1] || scene[2]);
  }
  if (/فقط|only/i.test(text) && sceneIndex) regenerationScope = 'scene';

  if (DELETE_LAST.test(text)) {
    action = 'DELETE_LAST_SCENE';
    targetType = 'SCENE';
    target = 'scene';
    changes.push('delete last scene');
  } else if (ADD_SCENE.test(text)) {
    action = 'ADD_SCENE';
    targetType = 'SCENE';
    changes.push('add scene');
    changeMap.usage = 'show product usage';
  } else if (VOICE.test(text) && !MUSIC.test(text)) {
    target = 'voice';
    targetType = 'VOICE';
    changes.push(/نسائي|أنثوي|female/i.test(text) ? 'female voice' : 'change voice');
    changeMap.voice = /نسائي|أنثوي|female/i.test(text) ? 'female' : 'replace';
    preserve.push('product', 'model', 'clothing', 'camera', 'music', 'script', 'background');
    preservationGuaranteed = true;
    if (IRAQI.test(text)) changeMap.dialect = 'iraqi';
  } else if (MUSIC.test(text)) {
    target = 'music';
    targetType = 'MUSIC';
    changes.push(QUIET.test(text) ? 'calm licensed music' : 'change music');
    changeMap.music = QUIET.test(text) ? 'calm' : 'replace';
    preserve.push('product', 'model', 'clothing', 'camera', 'voice', 'script');
    preservationGuaranteed = true;
  } else if (BACKGROUND.test(text)) {
    target = 'background';
    targetType = 'BACKGROUND';
    const env = HOSPITAL.test(text) ? 'hospital / modern clinic' : 'new background';
    changes.push(HOSPITAL.test(text) ? 'set background to hospital environment' : 'change background only');
    changeMap.background = env;
    preserve.push('model', 'clothing', 'camera', 'lighting', 'composition', 'voice', 'music', 'script');
    preservationGuaranteed = true;
  } else if (CLOTHING.test(text)) {
    target = 'clothing';
    targetType = 'MODEL';
    changes.push('change clothing only');
    preserve.push('model', 'background', 'camera', 'product');
    preservationGuaranteed = true;
  } else if (MODEL.test(text)) {
    target = 'model';
    targetType = 'MODEL';
    changes.push(LARGER.test(text) && PRODUCT_ONLY.test(text) ? 'increase product scale in frame' : 'change model');
    if (/30/.test(text) && /امرأة|woman|female/i.test(text)) changeMap.model = 'woman age 30';
    preserve.push('product', 'background', 'clothing');
  } else if (LIGHTING.test(text)) {
    target = 'lighting';
    targetType = 'BACKGROUND';
    changes.push('make lighting more professional');
    preserve.push('product', 'model', 'clothing', 'background', 'camera', 'composition');
    preservationGuaranteed = true;
  } else if (CAMERA.test(text)) {
    target = 'camera';
    targetType = 'SCENE';
    changes.push('change camera angle');
    preserve.push('product', 'model', 'clothing', 'background');
  } else if (SHORTER.test(text)) {
    action = 'SHORTEN';
    targetType = 'SCENE';
    changes.push('shorten scene duration');
    changeMap.duration = 'shorter';
    preserve.push('product', 'model', 'clothing', 'camera', 'voice', 'music', 'script');
    preservationGuaranteed = true;
  } else if (IRAQI.test(text)) {
    target = 'voice';
    targetType = 'VOICE';
    changeMap.dialect = 'iraqi';
    changes.push('Iraqi dialect speech');
    preserve.push('product', 'model', 'clothing', 'camera', 'music');
  } else {
    changes.push(text);
    preserve.push('product');
    targetType = 'PROJECT';
  }

  if (LARGER.test(text) && PRODUCT_ONLY.test(text)) {
    changes.push('make product larger in frame');
    changeMap.productScale = 'larger';
    preserve.push('model', 'clothing', 'camera');
  }

  if (sceneIndex) regenerationScope = 'scene';

  return {
    targetType,
    target,
    changes,
    changeMap,
    preserve,
    regenerationScope,
    sceneIndex,
    action,
    preservationGuaranteed,
    userMessage: preservationGuaranteed
      ? 'سيتم الحفاظ على العناصر غير المذكورة قدر الإمكان حسب قدرات النموذج. لن نضمن التطابق التام إذا كان المزود لا يدعم التحرير الجزئي.'
      : 'لا يمكن ضمان الحفاظ الدقيق على كل العناصر مع النموذج المختار.',
  };
}
