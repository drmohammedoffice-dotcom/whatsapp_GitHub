'use client';

import { Languages } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLocale } from '@/components/providers/locale-provider';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export function LanguageToggle({ variant = 'icon' }: { variant?: 'icon' | 'button' }) {
  const { locale, setLocale, t } = useLocale();

  if (variant === 'button') {
    return (
      <Button variant="outline" size="sm" onClick={() => setLocale(locale === 'en' ? 'ar' : 'en')} className="gap-2">
        <Languages className="h-4 w-4" />
        {locale === 'en' ? t('lang.switchToArabic') : t('lang.switchToEnglish')}
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={t('lang.label')}>
          <Languages className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setLocale('en')} className={locale === 'en' ? 'font-semibold' : ''}>
          English
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setLocale('ar')} className={locale === 'ar' ? 'font-semibold' : ''}>
          العربية
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
