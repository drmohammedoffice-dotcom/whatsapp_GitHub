'use client';

import Image from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type BrandSize = 'sm' | 'md' | 'lg' | 'xl';

const sizeMap: Record<
  BrandSize,
  { mark: number; fullHeight: number; text: string; tagline: string }
> = {
  sm: { mark: 40, fullHeight: 52, text: 'text-lg', tagline: 'text-[11px]' },
  md: { mark: 48, fullHeight: 64, text: 'text-xl', tagline: 'text-xs' },
  lg: { mark: 56, fullHeight: 76, text: 'text-2xl', tagline: 'text-sm' },
  xl: { mark: 64, fullHeight: 88, text: 'text-3xl', tagline: 'text-sm' },
};

type ChatLooraWordmarkProps = {
  className?: string;
  size?: BrandSize;
  variant?: 'default' | 'onDark';
};

export function ChatLooraWordmark({ className, size = 'md', variant = 'default' }: ChatLooraWordmarkProps) {
  const textSize = sizeMap[size].text;

  if (variant === 'onDark') {
    return (
      <span className={cn('inline-flex font-bold tracking-tight', textSize, className)}>
        <span className="text-white">Chat</span>
        <span className="bg-gradient-to-r from-[#67E8F9] via-[#60A5FA] to-[#C084FC] bg-clip-text text-transparent">Loora</span>
      </span>
    );
  }

  return (
    <span className={cn('inline-flex font-bold tracking-tight', textSize, className)}>
      <span className="text-[#0F172A] dark:text-foreground">Chat</span>
      <span className="bg-gradient-to-r from-[#3B82F6] via-[#6366F1] to-[#9333EA] bg-clip-text text-transparent">Loora</span>
    </span>
  );
}

/** Square mark showing only the icon portion. */
export function ChatLooraLogoMark({ size = 48, className }: { size?: number; className?: string }) {
  return (
    <div
      className={cn('relative shrink-0', className)}
      style={{ width: size, height: size }}
    >
      <Image
        src="/chatloora-icon.png"
        alt="ChatLoora"
        width={size}
        height={size}
        className="h-full w-full object-contain"
        priority
        unoptimized
      />
    </div>
  );
}

export function ChatLooraLogoFull({
  size = 'md',
  className,
  priority = false,
}: {
  size?: BrandSize;
  className?: string;
  priority?: boolean;
}) {
  const height = sizeMap[size].fullHeight;
  return (
    <Image
      src="/chatloora-logo.png"
      alt="ChatLoora"
      width={Math.round(height * 1.64)}
      height={height}
      className={cn('h-auto w-auto object-contain', className)}
      style={{ height, width: 'auto' }}
      priority={priority}
      unoptimized
    />
  );
}

type ChatLooraBrandProps = {
  href?: string;
  size?: BrandSize;
  variant?: 'default' | 'onDark';
  showText?: boolean;
  showTagline?: boolean;
  tagline?: string;
  collapsed?: boolean;
  className?: string;
  layout?: 'horizontal' | 'full-logo' | 'stacked';
};

export function ChatLooraBrand({
  href = '/',
  size = 'md',
  variant = 'default',
  showText = true,
  showTagline = false,
  tagline,
  collapsed = false,
  className,
  layout = 'horizontal',
}: ChatLooraBrandProps) {
  const dims = sizeMap[size];
  const taglineClass = dims.tagline;

  let inner: React.ReactNode;

  if (layout === 'stacked') {
    inner = (
      <div className={cn('space-y-3', className)}>
        <div className="inline-flex rounded-2xl bg-white px-5 py-3.5 shadow-md">
          <ChatLooraLogoFull size={size === 'xl' ? 'lg' : size} priority className="!h-[4.5rem] w-auto sm:!h-20" />
        </div>
        {showTagline && tagline && <p className={cn('text-white/85', taglineClass)}>{tagline}</p>}
      </div>
    );
  } else if (layout === 'full-logo' && !collapsed) {
    inner = (
      <ChatLooraLogoFull
        size={size}
        priority
        className={cn(className, size === 'lg' ? '!h-16 w-auto sm:!h-[4.5rem]' : '!h-14 w-auto')}
      />
    );
  } else if (collapsed) {
    inner = <ChatLooraLogoMark size={dims.mark} className={className} />;
  } else {
    inner = (
      <div className={cn('flex items-center gap-3', className)}>
        <ChatLooraLogoMark size={dims.mark} />
        {showText && (
          <div className="min-w-0">
            <ChatLooraWordmark size={size} variant={variant} />
            {showTagline && tagline && (
              <p className={cn('truncate', taglineClass, variant === 'onDark' ? 'text-white/80' : 'text-muted-foreground')}>
                {tagline}
              </p>
            )}
          </div>
        )}
      </div>
    );
  }

  if (href) {
    return (
      <Link href={href} className="inline-flex shrink-0">
        {inner}
      </Link>
    );
  }

  return <div className="inline-flex shrink-0">{inner}</div>;
}
