import { parseEditIntent } from './edit-intent';
import { describeResolution, isFourKRequest } from './resolution';

describe('edit intent parser', () => {
  it('parses Arabic background-only edits and lists preserve fields', () => {
    const parsed = parseEditIntent('غير الخلفية');
    expect(parsed.target).toBe('background');
    expect(parsed.preserve).toEqual(expect.arrayContaining(['product', 'model', 'clothing']));
    expect(parsed.preservationGuaranteed).toBe(true);
  });

  it('scopes a scene index', () => {
    const parsed = parseEditIntent('غير المشهد الثاني فقط');
    expect(parsed.regenerationScope).toBe('scene');
    expect(parsed.sceneIndex).toBe(2);
  });
});

describe('4K labeling', () => {
  it('never labels 1024 output as 4K', () => {
    expect(isFourKRequest('1024x1024')).toBe(false);
    const meta = describeResolution('4k', 1024, 1024);
    expect(meta.isNative4k).toBe(false);
    expect(meta.resolutionType).toBe('NATIVE');
  });

  it('labels genuine 3840x2160 as native 4K', () => {
    expect(describeResolution('3840x2160', 3840, 2160).isNative4k).toBe(true);
  });
});
