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
      <div className="inline-flex items-center rounded-full border border-slate-200/80 bg-white/80 p-0.5 shadow-sm backdrop-blur">
        <button
          type="button"
          onClick={() => setLocale('en')}
          className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
            locale === 'en' ? 'bg-violet-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          EN
        </button>
        <button
          type="button"
          onClick={() => setLocale('ar')}
          className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
            locale === 'ar' ? 'bg-violet-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          ع
        </button>
      </div>
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
