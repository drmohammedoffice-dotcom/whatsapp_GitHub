import { ar } from './ar';
import { en } from './en';
import type { Locale, Messages } from './types';

export type { Locale, Messages };

export const LOCALES: Locale[] = ['en', 'ar'];

export const LOCALE_STORAGE_KEY = 'locale';

export const messages: Record<Locale, Messages> = { en, ar };

export function getMessage(locale: Locale, key: string): string {
  const parts = key.split('.');
  let value: unknown = messages[locale];
  for (const part of parts) {
    if (value && typeof value === 'object' && part in (value as object)) {
      value = (value as Record<string, unknown>)[part];
    } else {
      return key;
    }
  }
  return typeof value === 'string' ? value : key;
}

export function isRtl(locale: Locale) {
  return locale === 'ar';
}
