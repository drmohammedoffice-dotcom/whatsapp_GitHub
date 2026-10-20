import type { ReactNode } from 'react';

function Wrap({ label, className, children }: { label: string; className: string; children: ReactNode }) {
  return (
    <span title={label} className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full shadow-sm ring-1 ring-white/20 sm:h-9 sm:w-9 ${className}`}>
      {children}
    </span>
  );
}

export function CourseBrand({ name }: { name: string }) {
  switch (name) {
    case 'facebook':
      return (
        <Wrap label="Facebook" className="bg-[#1877F2]">
          <svg viewBox="0 0 24 24" className="h-5 w-5 fill-white" aria-hidden>
            <path d="M14.5 8.5h2.4V5.2h-2.4c-2.7 0-4.4 1.6-4.4 4.4v1.7H8v3.3h2.1V22h3.4v-7.4h2.5l.5-3.3h-3V9.7c0-.8.4-1.2 1.3-1.2z" />
          </svg>
        </Wrap>
      );
    case 'instagram':
      return (
        <Wrap label="Instagram" className="bg-[linear-gradient(45deg,#f9ce34,#ee2a7b,#6228d7)]">
          <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-white sm:h-5 sm:w-5" strokeWidth="2" aria-hidden>
            <rect x="4" y="4" width="16" height="16" rx="5" />
            <circle cx="12" cy="12" r="3.5" />
            <circle cx="17.2" cy="6.8" r="1" fill="white" stroke="none" />
          </svg>
        </Wrap>
      );
    case 'canva':
      return (
        <Wrap label="Canva" className="bg-[#00C4CC]">
          <svg viewBox="0 0 24 24" className="h-5 w-5 fill-white" aria-hidden>
            <path d="M12.2 4.2c-3.4 0-6.2 2.3-6.2 6.3 0 3.6 2.6 6.4 6.4 6.4 1.7 0 3.2-.5 4.3-1.5l-1.4-1.6c-.8.7-1.8 1-2.9 1-2.3 0-3.9-1.7-3.9-4.3 0-2.5 1.6-4.2 3.8-4.2 1.2 0 2.2.4 2.9 1.1l1.4-1.7c-1.1-1-2.6-1.5-4.4-1.5z" />
          </svg>
        </Wrap>
      );
    case 'youtube':
      return (
        <Wrap label="YouTube" className="bg-[#FF0000]">
          <svg viewBox="0 0 24 24" className="h-5 w-5 fill-white" aria-hidden>
            <path d="M23 12.2s0-3.4-.4-4.9c-.2-1.3-1.3-2.3-2.5-2.5C18.4 4.4 12 4.4 12 4.4s-6.4 0-8.1.4C2.6 4.8 1.2 5.8 1 7.3.6 8.8 1 12.2 1 12.2s0 3.4.4 4.9c.2 1.3 1.3 2.3 2.5 2.5 1.7.4 8.1.4 8.1.4s6.4 0 8.1-.4c1.3-.2 2.3-1.2 2.5-2.5.4-1.5.4-4.9.4-4.9zM9.8 15.6V8.8l6.2 3.4-6.2 3.4z" />
          </svg>
        </Wrap>
      );
    case 'premiere':
      return (
        <Wrap label="Adobe Premiere" className="bg-[#9999FF]">
          <span className="text-[10px] font-black tracking-tight text-[#2c2c84]">Pr</span>
        </Wrap>
      );
    case 'chatgpt':
      return (
        <Wrap label="ChatGPT" className="bg-[#10A37F]">
          <svg viewBox="0 0 24 24" className="h-5 w-5 fill-white" aria-hidden>
            <path d="M12.4 3.2 8.7 5.3 12 7.3l3.3-2-3-2.1zm4.4 2.6-3.3 2v4.1l3.3 1.9 3.3-1.9v-4.1l-3.3-2zM7.6 5.8 4.3 7.8v4.1l3.3 1.9 3.3-1.9V7.8L7.6 5.8zM12 13.2l-3.3 1.9v4.1l3.3 2 3.3-2v-4.1L12 13.2z" />
          </svg>
        </Wrap>
      );
    case 'tiktok':
      return (
        <Wrap label="TikTok" className="bg-black">
          <svg viewBox="0 0 24 24" className="h-5 w-5 fill-white" aria-hidden>
            <path d="M14.5 3v11.1a3.6 3.6 0 1 1-3.1-3.5V13a1.7 3.6 0 1 0 1.3 1.6V3h1.8zm4.2 0c.3 2.4 1.9 4.3 4.3 5v2.1c-1.6-.1-3.1-.7-4.3-1.7v5.4A6.6 6.6 0 1 1 10 9.7V12a4.7 4.7 0 1 0 4.7 4.7V8.7c1.4 1 3.1 1.6 4.9 1.7V7.4c-1.8-.2-3.4-1.2-4.3-2.8H18.7V3h0z" />
          </svg>
        </Wrap>
      );
    case 'shop':
      return (
        <Wrap label="منتجات رقمية" className="bg-amber-400">
          <svg viewBox="0 0 24 24" className="h-5 w-5 stroke-[#071428] fill-none" strokeWidth="2" aria-hidden>
            <path d="M6 7h12l-1 12H7L6 7z" />
            <path d="M9 7a3 3 0 0 1 6 0" />
          </svg>
        </Wrap>
      );
    case 'ads':
      return (
        <Wrap label="إعلانات" className="bg-[#4285F4]">
          <svg viewBox="0 0 24 24" className="h-5 w-5 fill-white" aria-hidden>
            <path d="M4 12h2l3 7h2.2L8.6 12H12V9.8H3.5V12H4zm10.4 0H22v7h-2.2v-2.2h-3.2V19H14.4v-7zm2.2 2.2v1.4h3.2v-1.4h-3.2z" />
          </svg>
        </Wrap>
      );
    case 'print':
      return (
        <Wrap label="طباعة" className="bg-slate-700">
          <svg viewBox="0 0 24 24" className="h-5 w-5 stroke-white fill-none" strokeWidth="2" aria-hidden>
            <path d="M7 8V4h10v4M7 17H5a2 2 0 0 1-2-2v-4h18v4a2 2 0 0 1-2 2h-2" />
            <rect x="7" y="14" width="10" height="6" />
          </svg>
        </Wrap>
      );
    case 'ebook':
      return (
        <Wrap label="كتب إلكترونية" className="bg-orange-500">
          <svg viewBox="0 0 24 24" className="h-5 w-5 stroke-white fill-none" strokeWidth="2" aria-hidden>
            <path d="M4 5c2.5-1 5.5-1 8 0s5.5 1 8 0v14c-2.5 1-5.5 1-8 0s-5.5-1-8 0V5z" />
            <path d="M12 5v14" />
          </svg>
        </Wrap>
      );
    case 'affiliate':
      return (
        <Wrap label="عمولة" className="bg-emerald-600">
          <svg viewBox="0 0 24 24" className="h-5 w-5 stroke-white fill-none" strokeWidth="2" aria-hidden>
            <circle cx="8" cy="8" r="3" />
            <circle cx="16" cy="16" r="3" />
            <path d="M10.5 10.5 13.5 13.5" />
          </svg>
        </Wrap>
      );
    default:
      return null;
  }
}

export function CourseBrands({ names }: { names: string[] }) {
  return (
    <span className="flex shrink-0 items-center gap-1">
      {names.map((name) => (
        <CourseBrand key={name} name={name} />
      ))}
    </span>
  );
}
