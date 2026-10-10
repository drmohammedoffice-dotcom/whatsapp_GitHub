'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Pencil, Copy, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  fetchTikTokInstantForms,
  fetchTikTokTipSdkToken,
  renameTikTokInstantForm,
  type TikTokInstantForm,
} from '@/lib/tiktok-business';
import { openTikTokInstantFormEditor, type TipSdkActionType } from '@/lib/tiktok-instant-page-sdk';
import { parseApiError } from '@/lib/utils';

type Props = {
  open: boolean;
  advertiserId: string;
  tipAppId?: string | null;
  selectedPageId?: string;
  onClose: () => void;
  onSelect: (form: TikTokInstantForm) => void;
  onFormsChanged?: (forms: TikTokInstantForm[]) => void;
};

export function InstantFormLibraryModal({
  open,
  advertiserId,
  tipAppId,
  selectedPageId,
  onClose,
  onSelect,
  onFormsChanged,
}: Props) {
  const [forms, setForms] = useState<TikTokInstantForm[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState(selectedPageId || '');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  const load = useCallback(async () => {
    if (!advertiserId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchTikTokInstantForms(advertiserId);
      setForms(data.forms ?? []);
      onFormsChanged?.(data.forms ?? []);
      setPicked((current) => current || selectedPageId || data.forms?.[0]?.pageId || '');
    } catch (err) {
      setError(parseApiError(err));
    } finally {
      setLoading(false);
    }
  }, [advertiserId, onFormsChanged, selectedPageId]);

  useEffect(() => {
    if (!open) return;
    setPicked(selectedPageId || '');
    setQuery('');
    setRenamingId(null);
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload only when modal opens / advertiser changes
  }, [open, advertiserId]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return forms;
    return forms.filter(
      (row) =>
        row.name.toLowerCase().includes(q)
        || row.pageId.toLowerCase().includes(q),
    );
  }, [forms, query]);

  const selected = filtered.find((row) => row.pageId === picked) || forms.find((row) => row.pageId === picked) || null;

  async function runEditor(actionType: TipSdkActionType, pageId?: string) {
    setBusy(true);
    setError(null);
    try {
      const token = await fetchTikTokTipSdkToken(advertiserId);
      const appId = tipAppId || token.appId;
      if (!appId) throw new Error('معرّف تطبيق تيك توك غير متوفر');
      const result = await openTikTokInstantFormEditor({
        appId,
        advertiserId,
        ixAccessToken: token.tipSdkAccessToken,
        actionType,
        pageId,
        language: 'ar',
      });
      await load();
      const nextId = String(result.pageId || pageId || '').trim();
      if (nextId) {
        setPicked(nextId);
        const match = (await fetchTikTokInstantForms(advertiserId)).forms.find((row) => row.pageId === nextId);
        if (match) onSelect(match);
      }
    } catch (err) {
      setError(parseApiError(err));
    } finally {
      setBusy(false);
    }
  }

  async function saveRename(form: TikTokInstantForm) {
    const title = renameValue.trim();
    if (!title || title === form.name) {
      setRenamingId(null);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const updated = await renameTikTokInstantForm(advertiserId, form.pageId, title);
      setForms((current) => current.map((row) => (row.pageId === form.pageId ? { ...row, name: updated.name } : row)));
      setRenamingId(null);
    } catch (err) {
      // إن فشلت واجهة التسمية: افتح المحرر ليغيّر الاسم من تيك توك
      setError(`${parseApiError(err)} — سيتم فتح المحرر لتعديل الاسم.`);
      setRenamingId(null);
      await runEditor('edit', form.pageId);
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3" dir="rtl">
      <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-background shadow-xl">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div>
            <h2 className="text-base font-semibold">حدّد قالب صفحة فورية</h2>
            <p className="text-xs text-muted-foreground">اختر استمارة من مكتبتك أو أنشئ / كرّر وعدّل كما في تيك توك</p>
          </div>
          <button type="button" className="rounded-md p-1 hover:bg-muted" onClick={onClose} aria-label="إغلاق">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid min-h-0 flex-1 gap-0 md:grid-cols-[280px_1fr]">
          <div className="border-l bg-muted/20 p-4">
            <div className="mx-auto flex h-[420px] w-[220px] flex-col overflow-hidden rounded-[28px] border bg-zinc-900 text-white shadow-lg">
              {selected?.thumbnail || selected?.previewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={selected.thumbnail || selected.previewUrl || ''}
                  alt=""
                  className="h-40 w-full object-cover"
                />
              ) : (
                <div className="flex h-40 items-center justify-center bg-zinc-800 text-xs text-zinc-400">معاينة</div>
              )}
              <div className="flex flex-1 flex-col gap-2 p-3 text-xs">
                <p className="line-clamp-3 font-medium">{selected?.name || 'اختر استمارة لعرض المعاينة'}</p>
                <p className="text-zinc-400">الحالة: {selected?.status || '—'}</p>
                <div className="mt-auto rounded-md bg-zinc-700 py-2 text-center text-sm">إرسال</div>
              </div>
            </div>
          </div>

          <div className="flex min-h-0 flex-col p-4">
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="البحث بحسب اسم الصفحة أو المُعرّف"
              className="mb-3"
            />
            {loading ? (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> جاري تحميل المكتبة…
              </p>
            ) : (
              <div className="min-h-0 flex-1 overflow-auto rounded-xl border">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-muted/80 text-xs text-muted-foreground">
                    <tr>
                      <th className="w-10 p-2" />
                      <th className="p-2 text-right">الاسم</th>
                      <th className="p-2 text-right">الحالة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((form) => {
                      const active = picked === form.pageId;
                      return (
                        <tr
                          key={form.pageId}
                          className={`border-t hover:bg-muted/40 ${active ? 'bg-teal-50' : ''}`}
                          onClick={() => setPicked(form.pageId)}
                        >
                          <td className="p-2 align-top">
                            <input type="radio" checked={active} onChange={() => setPicked(form.pageId)} />
                          </td>
                          <td className="p-2 align-top">
                            <div className="flex gap-2">
                              {form.thumbnail ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={form.thumbnail} alt="" className="h-12 w-10 rounded object-cover" />
                              ) : (
                                <div className="h-12 w-10 rounded bg-muted" />
                              )}
                              <div className="min-w-0">
                                {renamingId === form.pageId ? (
                                  <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                    <Input
                                      value={renameValue}
                                      onChange={(event) => setRenameValue(event.target.value)}
                                      className="h-8"
                                    />
                                    <Button type="button" size="sm" disabled={busy} onClick={() => void saveRename(form)}>
                                      حفظ
                                    </Button>
                                  </div>
                                ) : (
                                  <p className="truncate font-medium">{form.name}</p>
                                )}
                                <p className="text-[11px] text-muted-foreground" dir="ltr">
                                  {form.createTime || form.updateTime || form.pageId}
                                </p>
                                {active && renamingId !== form.pageId && (
                                  <div className="mt-1 flex flex-wrap gap-2 text-[11px]" onClick={(e) => e.stopPropagation()}>
                                    <button
                                      type="button"
                                      className="inline-flex items-center gap-1 text-teal-700 hover:underline"
                                      disabled={busy}
                                      onClick={() => {
                                        setRenamingId(form.pageId);
                                        setRenameValue(form.name);
                                      }}
                                    >
                                      <Pencil className="h-3 w-3" /> تعديل الاسم
                                    </button>
                                    <button
                                      type="button"
                                      className="inline-flex items-center gap-1 text-teal-700 hover:underline"
                                      disabled={busy}
                                      onClick={() => void runEditor('copy', form.pageId)}
                                    >
                                      <Copy className="h-3 w-3" /> تكرار وتعديل
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="p-2 align-top text-xs">
                            <span className="inline-flex items-center gap-1">
                              <span className={`h-2 w-2 rounded-full ${form.status === 'EDITED' ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                              {form.status === 'EDITED' ? 'مسودة' : 'منشورة'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                    {!filtered.length && (
                      <tr>
                        <td colSpan={3} className="p-6 text-center text-sm text-muted-foreground">
                          لا توجد استمارات فورية في هذا الحساب. أنشئ استمارة جديدة.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
            {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t px-4 py-3">
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" disabled={busy} onClick={() => void runEditor('create')}>
              + إنشاء جديد
            </Button>
            {selected && (
              <Button type="button" variant="outline" disabled={busy} onClick={() => void runEditor('copy', selected.pageId)}>
                تكرار وتعديل
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={busy}>إلغاء</Button>
            <Button
              type="button"
              disabled={busy || !selected}
              onClick={() => {
                if (!selected) return;
                onSelect(selected);
                onClose();
              }}
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'تأكيد'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
