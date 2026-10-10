export type ResolutionMeta = {
  requestedResolution?: string;
  actualResolution?: string;
  resolutionType: 'NATIVE' | 'UPSCALED';
  isNative4k: boolean;
};

export function isFourKRequest(resolution?: string) {
  if (!resolution) return false;
  const lower = resolution.toLowerCase();
  return lower.includes('4k') || lower.includes('2160') || lower.includes('3840');
}

export function describeResolution(requested: string | undefined, width?: number, height?: number): ResolutionMeta {
  const actualResolution = width && height ? `${width}x${height}` : undefined;
  const isNative4k = Boolean(
    width &&
      height &&
      ((width >= 3840 && height >= 2160) || (height >= 3840 && width >= 2160)),
  );
  return {
    requestedResolution: requested,
    actualResolution,
    resolutionType: 'NATIVE',
    isNative4k,
  };
}
