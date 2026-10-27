'use client';

import { useEffect, useRef, useState } from 'react';
import { Camera, Loader2, MapPin } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  fetchAdminMe,
  fetchStaffAvatarObjectUrl,
  uploadStaffAvatar,
  type AdminMe,
} from '@/lib/admin-api';
import { cn } from '@/lib/utils';

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ''}${parts[1]![0] ?? ''}`.toUpperCase();
}

export function StaffIdentityBadge({ className }: { className?: string }) {
  const [me, setMe] = useState<AdminMe | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;
    fetchAdminMe()
      .then(async (profile) => {
        if (cancelled) return;
        setMe(profile);
        if (!profile.hasAvatar) {
          setAvatarUrl(null);
          return;
        }
        try {
          objectUrl = await fetchStaffAvatarObjectUrl();
          if (!cancelled) setAvatarUrl(objectUrl);
        } catch {
          if (!cancelled) setAvatarUrl(null);
        }
      })
      .catch(() => {
        if (!cancelled) setMe(null);
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, []);

  async function onPick(file: File | null) {
    if (!file) return;
    setBusy(true);
    try {
      await uploadStaffAvatar(file);
      const next = await fetchStaffAvatarObjectUrl();
      setAvatarUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return next;
      });
      setMe((current) => (current ? { ...current, hasAvatar: true } : current));
    } catch {
      /* keep previous */
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  if (!me) return null;

  return (
    <div
      className={cn(
        'flex max-w-full items-center gap-3 rounded-2xl border bg-card px-3 py-2 shadow-sm',
        className,
      )}
    >
      <div className="relative shrink-0">
        <Avatar className="h-12 w-12 border">
          {avatarUrl ? <AvatarImage src={avatarUrl} alt={me.user.name} /> : null}
          <AvatarFallback className="bg-primary/10 text-sm font-semibold text-primary">
            {initials(me.user.name)}
          </AvatarFallback>
        </Avatar>
        <button
          type="button"
          className="absolute -bottom-1 -start-1 inline-flex h-6 w-6 items-center justify-center rounded-full border bg-background text-muted-foreground shadow-sm hover:text-foreground"
          title="تغيير الصورة"
          disabled={busy}
          onClick={() => fileRef.current?.click()}
        >
          {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Camera className="h-3 w-3" />}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => void onPick(e.target.files?.[0] ?? null)}
        />
      </div>
      <div className="min-w-0 text-start">
        <p className="truncate text-sm font-semibold leading-tight">{me.user.name}</p>
        <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted-foreground">
          <MapPin className="h-3 w-3 shrink-0" />
          <span className="truncate">{me.residence?.trim() || 'لم يُحدد عنوان السكن'}</span>
        </p>
      </div>
    </div>
  );
}
