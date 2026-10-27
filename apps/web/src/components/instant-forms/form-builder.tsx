'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  CopyPlus,
  Eye,
  GripVertical,
  ImagePlus,
  Loader2,
  Plus,
  Save,
  Sparkles,
  Trash2,
  Upload,
} from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { InstantFormRenderer } from '@/components/instant-forms/form-renderer';
import {
  BLOCK_CATALOG,
  createBlockId,
  createColorChoiceId,
  createDefaultBlock,
  createFieldId,
  defaultColorField,
  defaultMultiChoiceField,
  IRAQ_GOVERNORATES,
  moneyInputValue,
  parseMoneyInput,
  type InstantFormBlock,
  type InstantFormColorChoice,
  type InstantFormDocument,
  type InstantFormField,
  type InstantFormFieldType,
  type InstantFormProduct,
} from '@/lib/instant-forms/document';
import { uploadInstantFormMedia, type InstantFormView } from '@/lib/instant-forms/api';
import { cn } from '@/lib/utils';

function cloneFormBlock(block: InstantFormBlock): InstantFormBlock {
  const clone = structuredClone(block) as InstantFormBlock;
  clone.id = createBlockId(block.type);
  if (Array.isArray(clone.props.fields)) {
    clone.props.fields = (clone.props.fields as InstantFormField[]).map((field) => ({
      ...field,
      id: createFieldId(field.type || 'f'),
      choices: Array.isArray(field.choices)
        ? field.choices.map((choice) => ({ ...choice, id: createColorChoiceId() }))
        : field.choices,
    }));
  }
  return clone;
}

type Props = {
  form: InstantFormView;
  onSaveDraft: (doc: InstantFormDocument) => Promise<void>;
  onPublish: () => Promise<void>;
  saving?: boolean;
  publishing?: boolean;
  locale?: 'ar' | 'en';
};

const FIELD_TYPES: Array<{ type: InstantFormFieldType; label: string }> = [
  { type: 'name', label: 'الاسم' },
  { type: 'phone', label: 'الهاتف' },
  { type: 'whatsapp', label: 'واتساب' },
  { type: 'email', label: 'البريد' },
  { type: 'governorate', label: 'المحافظة' },
  { type: 'city', label: 'المدينة' },
  { type: 'address', label: 'العنوان' },
  { type: 'area', label: 'المنطقة' },
  { type: 'landmark', label: 'أقرب نقطة' },
  { type: 'quantity', label: 'الكمية' },
  { type: 'color', label: 'ألوان المنتج' },
  { type: 'multiselect', label: 'اختيارات متعددة' },
  { type: 'size', label: 'المقاس' },
  { type: 'notes', label: 'ملاحظات' },
  { type: 'text', label: 'نص' },
  { type: 'textarea', label: 'نص طويل' },
  { type: 'select', label: 'قائمة' },
  { type: 'radio', label: 'اختيار واحد' },
  { type: 'checkbox', label: 'Checkbox' },
  { type: 'date', label: 'تاريخ' },
  { type: 'time', label: 'وقت' },
  { type: 'custom', label: 'مخصص' },
];

export function InstantFormBuilder({
  form,
  onSaveDraft,
  onPublish,
  saving,
  publishing,
  locale = 'ar',
}: Props) {
  const [doc, setDoc] = useState<InstantFormDocument>(form.draftDocument);
  const [selectedId, setSelectedId] = useState<string | null>(doc.blocks[0]?.id ?? null);
  const [dirty, setDirty] = useState(false);
  const [copied, setCopied] = useState(false);
  const [dragType, setDragType] = useState<string | null>(null);
  const [dragBlockId, setDragBlockId] = useState<string | null>(null);
  const [dragFieldId, setDragFieldId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const docRef = useRef(doc);
  docRef.current = doc;

  const selected = useMemo(
    () => doc.blocks.find((b) => b.id === selectedId) ?? null,
    [doc.blocks, selectedId],
  );

  const updateDoc = useCallback((updater: (prev: InstantFormDocument) => InstantFormDocument) => {
    setDoc((prev) => {
      const next = updater(prev);
      setDirty(true);
      return next;
    });
  }, []);

  useEffect(() => {
    if (!dirty) return;
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      void onSaveDraft(docRef.current).then(() => setDirty(false));
    }, 2500);
    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    };
  }, [doc, dirty, onSaveDraft]);

  function addBlock(type: InstantFormBlock['type'], index?: number) {
    const block = createDefaultBlock(type);
    updateDoc((prev) => {
      const blocks = [...prev.blocks];
      const at = index == null ? blocks.length : index;
      blocks.splice(at, 0, block);
      return { ...prev, blocks };
    });
    setSelectedId(block.id);
  }

  function updateBlock(id: string, patch: Partial<InstantFormBlock>) {
    updateDoc((prev) => ({
      ...prev,
      blocks: prev.blocks.map((b) => (b.id === id ? { ...b, ...patch, props: { ...b.props, ...patch.props } } : b)),
    }));
  }

  function updateBlockProps(id: string, props: Record<string, unknown>) {
    updateDoc((prev) => ({
      ...prev,
      blocks: prev.blocks.map((b) => (b.id === id ? { ...b, props: { ...b.props, ...props } } : b)),
    }));
  }

  function removeBlock(id: string) {
    const index = doc.blocks.findIndex((b) => b.id === id);
    const nextSelected =
      selectedId === id
        ? doc.blocks[index - 1]?.id ?? doc.blocks[index + 1]?.id ?? null
        : selectedId;
    updateDoc((prev) => ({ ...prev, blocks: prev.blocks.filter((b) => b.id !== id) }));
    setSelectedId(nextSelected);
  }

  function moveBlock(id: string, dir: -1 | 1) {
    updateDoc((prev) => {
      const blocks = [...prev.blocks];
      const i = blocks.findIndex((b) => b.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= blocks.length) return prev;
      [blocks[i], blocks[j]] = [blocks[j]!, blocks[i]!];
      return { ...prev, blocks };
    });
  }

  function duplicateBlock(id: string) {
    let newId: string | null = null;
    updateDoc((prev) => {
      const i = prev.blocks.findIndex((b) => b.id === id);
      if (i < 0) return prev;
      const clone = cloneFormBlock(prev.blocks[i]!);
      newId = clone.id;
      const blocks = [...prev.blocks];
      blocks.splice(i + 1, 0, clone);
      return { ...prev, blocks };
    });
    if (newId) setSelectedId(newId);
  }

  function reorderBlock(fromId: string, toId: string) {
    if (fromId === toId) return;
    updateDoc((prev) => {
      const blocks = [...prev.blocks];
      const from = blocks.findIndex((b) => b.id === fromId);
      const to = blocks.findIndex((b) => b.id === toId);
      if (from < 0 || to < 0) return prev;
      const [item] = blocks.splice(from, 1);
      blocks.splice(to, 0, item!);
      return { ...prev, blocks };
    });
  }

  function moveFormField(formBlockId: string, fieldId: string, dir: -1 | 1) {
    updateDoc((prev) => ({
      ...prev,
      blocks: prev.blocks.map((b) => {
        if (b.id !== formBlockId) return b;
        const fields = [...((b.props.fields as InstantFormField[]) || [])];
        const i = fields.findIndex((f) => f.id === fieldId);
        const j = i + dir;
        if (i < 0 || j < 0 || j >= fields.length) return b;
        [fields[i], fields[j]] = [fields[j]!, fields[i]!];
        return { ...b, props: { ...b.props, fields } };
      }),
    }));
  }

  function reorderFormField(formBlockId: string, fromId: string, toId: string) {
    if (fromId === toId) return;
    updateDoc((prev) => ({
      ...prev,
      blocks: prev.blocks.map((b) => {
        if (b.id !== formBlockId) return b;
        const fields = [...((b.props.fields as InstantFormField[]) || [])];
        const from = fields.findIndex((f) => f.id === fromId);
        const to = fields.findIndex((f) => f.id === toId);
        if (from < 0 || to < 0) return b;
        const [item] = fields.splice(from, 1);
        fields.splice(to, 0, item!);
        return { ...b, props: { ...b.props, fields } };
      }),
    }));
  }

  async function uploadImageFile(file: File): Promise<string | null> {
    setUploading(true);
    try {
      const result = await uploadInstantFormMedia(file);
      return result.url;
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'فشل رفع الصورة');
      return null;
    } finally {
      setUploading(false);
    }
  }

  async function copyUrl() {
    await navigator.clipboard.writeText(form.publicUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  const formFields: InstantFormField[] =
    selected?.type === 'form' ? ((selected.props.fields as InstantFormField[]) || []) : [];

  return (
    <div className="flex h-[calc(100vh-7rem)] min-h-[640px] flex-col overflow-hidden rounded-2xl border bg-background shadow-sm">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
        <div>
          <h1 className="font-semibold">{form.name}</h1>
          <p className="text-xs text-muted-foreground">
            {dirty ? 'تعديلات غير محفوظة…' : 'محفوظ تلقائياً'} · {form.status}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => void copyUrl()}>
            {copied ? <Check className="me-1 h-3.5 w-3.5" /> : <Copy className="me-1 h-3.5 w-3.5" />}
            نسخ الرابط
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href={form.shortUrl || `/f/${encodeURIComponent(form.slug)}`} target="_blank">
              <Eye className="me-1 h-3.5 w-3.5" />
              معاينة
            </Link>
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={saving}
            onClick={() => void onSaveDraft(doc).then(() => setDirty(false))}
          >
            {saving ? <Loader2 className="me-1 h-3.5 w-3.5 animate-spin" /> : <Save className="me-1 h-3.5 w-3.5" />}
            حفظ مسودة
          </Button>
          <Button size="sm" disabled={publishing} onClick={() => void onPublish()}>
            {publishing ? <Loader2 className="me-1 h-3.5 w-3.5 animate-spin" /> : <Upload className="me-1 h-3.5 w-3.5" />}
            نشر
          </Button>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[240px_1fr_300px]">
        {/* Left: page structure + catalog */}
        <aside className="overflow-y-auto border-e bg-muted/30 p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            ترتيب الأقسام
          </p>
          <p className="mb-2 text-[11px] text-muted-foreground">
            اسحب القسم، أو استخدم الأزرار: أعلى / أسفل / تكرار / حذف
          </p>
          <div className="mb-4 space-y-1">
            {doc.blocks.map((block, index) => {
              const meta = BLOCK_CATALOG.find((c) => c.type === block.type);
              const label = locale === 'ar' ? meta?.labelAr : meta?.labelEn;
              return (
                <div
                  key={block.id}
                  draggable
                  onDragStart={() => setDragBlockId(block.id)}
                  onDragEnd={() => setDragBlockId(null)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (dragBlockId) reorderBlock(dragBlockId, block.id);
                    setDragBlockId(null);
                  }}
                  onClick={() => setSelectedId(block.id)}
                  className={cn(
                    'rounded-lg border bg-background px-2 py-2 text-start text-xs',
                    selectedId === block.id
                      ? 'border-violet-400 bg-violet-50'
                      : 'border-transparent hover:border-violet-200',
                    dragBlockId === block.id && 'opacity-50',
                  )}
                >
                  <div className="flex cursor-grab items-center gap-2 active:cursor-grabbing">
                    <GripVertical className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate font-medium">
                      {index + 1}. {label || block.type}
                    </span>
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1 ps-5">
                    <button
                      type="button"
                      title="تحريك لأعلى"
                      disabled={index === 0}
                      className="rounded border bg-white p-1 text-muted-foreground hover:bg-muted disabled:opacity-30"
                      onClick={(e) => {
                        e.stopPropagation();
                        moveBlock(block.id, -1);
                      }}
                    >
                      <ChevronUp className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      title="تحريك لأسفل"
                      disabled={index >= doc.blocks.length - 1}
                      className="rounded border bg-white p-1 text-muted-foreground hover:bg-muted disabled:opacity-30"
                      onClick={(e) => {
                        e.stopPropagation();
                        moveBlock(block.id, 1);
                      }}
                    >
                      <ChevronDown className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      title="تكرار القسم"
                      className="rounded border bg-white p-1 text-muted-foreground hover:bg-muted"
                      onClick={(e) => {
                        e.stopPropagation();
                        duplicateBlock(block.id);
                      }}
                    >
                      <CopyPlus className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      title="حذف القسم"
                      className="rounded border border-red-200 bg-white p-1 text-red-600 hover:bg-red-50"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (window.confirm('حذف هذا القسم؟')) removeBlock(block.id);
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
            {!doc.blocks.length ? (
              <p className="text-xs text-muted-foreground">لا توجد أقسام بعد</p>
            ) : null}
          </div>

          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">إضافة عنصر</p>
          <div className="space-y-1">
            {BLOCK_CATALOG.map((item) => (
              <button
                key={item.type}
                type="button"
                draggable
                onDragStart={() => setDragType(item.type)}
                onDragEnd={() => setDragType(null)}
                onClick={() => addBlock(item.type)}
                className="flex w-full items-center gap-2 rounded-lg border border-transparent bg-background px-2.5 py-2 text-start text-sm hover:border-violet-200 hover:bg-violet-50"
              >
                <Plus className="h-3.5 w-3.5 text-violet-500" />
                {locale === 'ar' ? item.labelAr : item.labelEn}
              </button>
            ))}
          </div>
        </aside>

        {/* Center: preview */}
        <main
          className="overflow-y-auto bg-slate-200/60 p-4"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            if (dragType) addBlock(dragType as InstantFormBlock['type']);
            setDragType(null);
          }}
        >
          {/* Customers always see the public form in light mode, so the preview stays light. */}
          <div data-theme="light" className="mx-auto max-w-[480px] overflow-hidden rounded-[1.5rem] border bg-white shadow-xl">
            <InstantFormRenderer
              document={doc}
              mode="preview"
              selectedBlockId={selectedId}
              onSelectBlock={setSelectedId}
              onMoveBlockUp={(id) => moveBlock(id, -1)}
              onMoveBlockDown={(id) => moveBlock(id, 1)}
              onDuplicateBlock={duplicateBlock}
              onDeleteBlock={(id) => {
                if (window.confirm('حذف هذا القسم؟')) removeBlock(id);
              }}
              whatsappNumber={form.whatsappNumber}
            />
          </div>
          {selected ? (
            <div className="mx-auto mt-3 flex max-w-[480px] flex-wrap justify-center gap-2">
              <Button size="sm" variant="outline" onClick={() => moveBlock(selected.id, -1)}>
                <ChevronUp className="me-1 h-3.5 w-3.5" />
                أعلى
              </Button>
              <Button size="sm" variant="outline" onClick={() => moveBlock(selected.id, 1)}>
                <ChevronDown className="me-1 h-3.5 w-3.5" />
                أسفل
              </Button>
              <Button size="sm" variant="outline" onClick={() => duplicateBlock(selected.id)}>
                <CopyPlus className="me-1 h-3.5 w-3.5" />
                تكرار
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => {
                  if (window.confirm('حذف هذا القسم؟')) removeBlock(selected.id);
                }}
              >
                <Trash2 className="me-1 h-3.5 w-3.5" />
                حذف
              </Button>
            </div>
          ) : null}
        </main>

        {/* Right: properties */}
        <aside className="overflow-y-auto border-s p-3">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">الخصائص</p>
          {selected ? (
            <div className="mb-3 rounded-xl border border-violet-200 bg-violet-50/70 p-2">
              <p className="mb-2 text-xs font-medium text-violet-900">إدارة القسم المحدد</p>
              <div className="grid grid-cols-4 gap-1">
                <Button size="sm" variant="outline" className="h-8 px-1 text-[11px]" onClick={() => moveBlock(selected.id, -1)}>
                  أعلى
                </Button>
                <Button size="sm" variant="outline" className="h-8 px-1 text-[11px]" onClick={() => moveBlock(selected.id, 1)}>
                  أسفل
                </Button>
                <Button size="sm" variant="outline" className="h-8 px-1 text-[11px]" onClick={() => duplicateBlock(selected.id)}>
                  تكرار
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  className="h-8 px-1 text-[11px]"
                  onClick={() => {
                    if (window.confirm('حذف هذا القسم؟')) removeBlock(selected.id);
                  }}
                >
                  حذف
                </Button>
              </div>
            </div>
          ) : null}

          <div className="mb-4 space-y-2 rounded-xl border p-3">
            <p className="text-sm font-medium">إعدادات الصفحة</p>
            <Label>لون الخلفية</Label>
            <Input
              type="color"
              value={doc.theme.pageBackground || '#f8fafc'}
              onChange={(e) =>
                updateDoc((prev) => ({ ...prev, theme: { ...prev.theme, pageBackground: e.target.value } }))
              }
            />
            <Label>اللون الأساسي</Label>
            <Input
              type="color"
              value={doc.theme.primaryColor || '#7c3aed'}
              onChange={(e) =>
                updateDoc((prev) => ({ ...prev, theme: { ...prev.theme, primaryColor: e.target.value } }))
              }
            />
            <Label>اسم المنتج</Label>
            <Input
              value={doc.product?.name || ''}
              onChange={(e) =>
                updateDoc((prev) => ({
                  ...prev,
                  product: { ...prev.product, name: e.target.value },
                }))
              }
            />
            <Label>وصف المنتج</Label>
            <textarea
              className="min-h-20 w-full rounded-md border px-3 py-2 text-sm"
              value={doc.product?.description || ''}
              placeholder="اكتب وصفاً مختصراً للمنتج يظهر في بطاقة المنتج"
              onChange={(e) =>
                updateDoc((prev) => ({
                  ...prev,
                  product: { ...prev.product, description: e.target.value },
                }))
              }
            />
            <Label>شارة المنتج</Label>
            <Input
              value={doc.product?.badge || ''}
              placeholder="مثل: الأكثر مبيعاً"
              onChange={(e) =>
                updateDoc((prev) => ({
                  ...prev,
                  product: { ...prev.product, badge: e.target.value },
                }))
              }
            />
            <Label>السعر</Label>
            <Input
              type="text"
              inputMode="numeric"
              dir="ltr"
              lang="en"
              className="text-start"
              placeholder="15000"
              value={moneyInputValue(doc.product?.price)}
              onChange={(e) => {
                const parsed = parseMoneyInput(e.target.value);
                updateDoc((prev) => ({
                  ...prev,
                  product: {
                    ...prev.product,
                    price: parsed == null ? undefined : parsed,
                  },
                }));
              }}
            />
            <Label>السعر السابق</Label>
            <Input
              type="text"
              inputMode="numeric"
              dir="ltr"
              lang="en"
              className="text-start"
              placeholder="25000"
              value={moneyInputValue(doc.product?.compareAtPrice)}
              onChange={(e) => {
                const parsed = parseMoneyInput(e.target.value);
                updateDoc((prev) => ({
                  ...prev,
                  product: {
                    ...prev.product,
                    compareAtPrice: parsed == null ? undefined : parsed,
                  },
                }));
              }}
            />
            <Label>صورة المنتج</Label>
            <ImagePicker
              value={(doc.product?.images && doc.product.images[0]) || ''}
              uploading={uploading}
              onUpload={async (file) => {
                const url = await uploadImageFile(file);
                if (!url) return;
                updateDoc((prev) => ({
                  ...prev,
                  product: { ...prev.product, images: [url, ...(prev.product?.images?.slice(1) || [])] },
                }));
              }}
              onUrlChange={(url) =>
                updateDoc((prev) => ({
                  ...prev,
                  product: {
                    ...prev.product,
                    images: url ? [url, ...(prev.product?.images?.slice(1) || [])] : [],
                  },
                }))
              }
            />
            <ImageSizeControls
              title="قياسات صورة المنتج"
              values={{
                width: doc.product?.imageWidth || '100%',
                height: doc.product?.imageHeight || '160px',
                objectFit: doc.product?.imageObjectFit || 'cover',
                borderRadius: doc.product?.imageBorderRadius || '0px',
              }}
              onChange={(patch) =>
                updateDoc((prev) => ({
                  ...prev,
                  product: {
                    ...prev.product,
                    ...(patch.width != null ? { imageWidth: patch.width } : {}),
                    ...(patch.height != null ? { imageHeight: patch.height } : {}),
                    ...(patch.objectFit != null
                      ? {
                          imageObjectFit: patch.objectFit as
                            | 'cover'
                            | 'contain'
                            | 'fill'
                            | 'none'
                            | 'scale-down',
                        }
                      : {}),
                    ...(patch.borderRadius != null ? { imageBorderRadius: patch.borderRadius } : {}),
                  },
                }))
              }
            />
          </div>

          {!selected ? (
            <p className="text-sm text-muted-foreground">اختر عنصراً من المعاينة أو قائمة الأقسام لتعديل خصائصه.</p>
          ) : (
            <div className="space-y-3">
              <p className="text-sm font-medium">{selected.type}</p>

              <BlockPropsEditor
                block={selected}
                product={doc.product}
                uploading={uploading}
                onUpload={uploadImageFile}
                onChangeProps={(patch) => updateBlockProps(selected.id, patch)}
                onChangeProduct={(patch) =>
                  updateDoc((prev) => ({
                    ...prev,
                    product: { ...prev.product, ...patch },
                  }))
                }
              />

              <Label>لون خلفية العنصر</Label>
              <Input
                type="color"
                value={selected.style?.backgroundColor || '#ffffff'}
                onChange={(e) =>
                  updateBlock(selected.id, {
                    style: { ...selected.style, backgroundColor: e.target.value },
                  })
                }
              />
              <Label>الحواف (border radius)</Label>
              <Input
                value={selected.style?.borderRadius || ''}
                placeholder="16px"
                onChange={(e) =>
                  updateBlock(selected.id, {
                    style: { ...selected.style, borderRadius: e.target.value },
                  })
                }
              />
              <Label>Padding</Label>
              <Input
                value={selected.style?.padding || ''}
                placeholder="16px"
                onChange={(e) =>
                  updateBlock(selected.id, {
                    style: { ...selected.style, padding: e.target.value },
                  })
                }
              />

              {selected.type === 'form' ? (
                <div className="space-y-3 rounded-xl border p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">حقول النموذج</p>
                    <span className="text-[10px] text-muted-foreground">اسحب أو استخدم الأسهم للترتيب</span>
                  </div>
                  <Label>نص زر الإرسال</Label>
                  <Input
                    value={String(selected.props.submitLabel || '')}
                    onChange={(e) => updateBlockProps(selected.id, { submitLabel: e.target.value })}
                  />
                  {formFields.map((field, idx) => (
                    <div
                      key={field.id}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (dragFieldId) reorderFormField(selected.id, dragFieldId, field.id);
                        setDragFieldId(null);
                      }}
                      className={cn(
                        'space-y-2 rounded-lg border bg-muted/40 p-2 transition',
                        dragFieldId === field.id && 'opacity-50 ring-2 ring-violet-300',
                        dragFieldId && dragFieldId !== field.id && 'border-dashed border-violet-300',
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-1.5">
                          <button
                            type="button"
                            draggable
                            onDragStart={(e) => {
                              e.stopPropagation();
                              setDragFieldId(field.id);
                            }}
                            onDragEnd={() => setDragFieldId(null)}
                            className="cursor-grab rounded p-0.5 text-muted-foreground hover:bg-background active:cursor-grabbing"
                            title="اسحب للترتيب"
                            aria-label="اسحب للترتيب"
                          >
                            <GripVertical className="h-4 w-4" />
                          </button>
                          <span className="text-[10px] font-semibold text-muted-foreground">
                            {idx + 1}.
                          </span>
                          <span className="rounded bg-violet-100 px-1.5 py-0.5 text-[10px] font-semibold text-violet-800">
                            {field.type === 'color'
                              ? 'ألوان المنتج'
                              : field.type === 'multiselect'
                                ? 'اختيارات متعددة'
                                : field.type}
                          </span>
                        </div>
                        <div className="flex shrink-0 items-center gap-0.5">
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0"
                            disabled={idx === 0}
                            title="تقديم"
                            onClick={() => moveFormField(selected.id, field.id, -1)}
                          >
                            <ChevronUp className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0"
                            disabled={idx === formFields.length - 1}
                            title="تأخير"
                            onClick={() => moveFormField(selected.id, field.id, 1)}
                          >
                            <ChevronDown className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-destructive"
                            onClick={() => {
                              updateBlockProps(selected.id, {
                                fields: formFields.filter((f) => f.id !== field.id),
                              });
                            }}
                          >
                            حذف
                          </Button>
                        </div>
                      </div>
                      <Input
                        value={field.label}
                        onChange={(e) => {
                          const fields = [...formFields];
                          fields[idx] = { ...field, label: e.target.value };
                          updateBlockProps(selected.id, { fields });
                        }}
                      />
                      <Input
                        value={field.placeholder || ''}
                        placeholder="Placeholder"
                        onChange={(e) => {
                          const fields = [...formFields];
                          fields[idx] = { ...field, placeholder: e.target.value };
                          updateBlockProps(selected.id, { fields });
                        }}
                      />
                      <label className="flex items-center gap-2 text-xs">
                        <input
                          type="checkbox"
                          checked={!!field.required}
                          onChange={(e) => {
                            const fields = [...formFields];
                            fields[idx] = { ...field, required: e.target.checked };
                            updateBlockProps(selected.id, { fields });
                          }}
                        />
                        إجباري
                      </label>

                      {field.type === 'color' || field.type === 'multiselect' ? (
                        <ColorChoicesEditor
                          field={field}
                          variant={field.type === 'color' ? 'color' : 'choices'}
                          uploading={uploading}
                          onUpload={uploadImageFile}
                          onChange={(patch) => {
                            const fields = [...formFields];
                            const next = { ...field, ...patch };
                            if (next.choices) {
                              next.options = next.choices.map((c) => c.label).filter(Boolean);
                            }
                            if (field.type === 'multiselect') {
                              next.allowMultiple = true;
                            }
                            fields[idx] = next;
                            updateBlockProps(selected.id, { fields });
                            if (field.type === 'color') {
                              updateDoc((prev) => ({
                                ...prev,
                                product: {
                                  ...prev.product,
                                  ...(next.choices
                                    ? {
                                        colors: next.choices!
                                          .map((c) => c.label)
                                          .filter(Boolean),
                                      }
                                    : {}),
                                  ...(next.sizeOptions
                                    ? { sizes: next.sizeOptions.filter(Boolean) }
                                    : {}),
                                },
                              }));
                            }
                          }}
                        />
                      ) : null}

                      {(field.type === 'select' ||
                        field.type === 'radio' ||
                        field.type === 'checkbox' ||
                        field.type === 'size' ||
                        field.type === 'city' ||
                        field.type === 'governorate') && (
                        <div className="space-y-1">
                          <div className="flex items-center justify-between gap-2">
                            <Label className="text-xs">الخيارات (سطر لكل خيار)</Label>
                            {field.type === 'city' || field.type === 'governorate' ? (
                              <button
                                type="button"
                                className="text-[10px] font-medium text-violet-700 hover:underline"
                                onClick={() => {
                                  const fields = [...formFields];
                                  fields[idx] = { ...field, options: [...IRAQ_GOVERNORATES] };
                                  updateBlockProps(selected.id, { fields });
                                }}
                              >
                                تعبئة كل محافظات العراق
                              </button>
                            ) : null}
                          </div>
                          <textarea
                            className="min-h-20 w-full rounded-md border px-2 py-1.5 text-xs"
                            value={(field.options || []).join('\n')}
                            onChange={(e) => {
                              const fields = [...formFields];
                              fields[idx] = {
                                ...field,
                                options: e.target.value.split('\n').map((s) => s.trim()).filter(Boolean),
                              };
                              updateBlockProps(selected.id, { fields });
                            }}
                          />
                        </div>
                      )}
                    </div>
                  ))}
                  <div className="grid grid-cols-2 gap-1">
                    {FIELD_TYPES.map((ft) => (
                      <button
                        key={ft.type}
                        type="button"
                        className={cn(
                          'rounded-md border px-2 py-1.5 text-xs hover:bg-violet-50',
                          (ft.type === 'color' || ft.type === 'multiselect') &&
                            'border-violet-300 bg-violet-50 font-medium text-violet-800',
                        )}
                        onClick={() => {
                          const next: InstantFormField =
                            ft.type === 'color'
                              ? defaultColorField()
                              : ft.type === 'multiselect'
                                ? defaultMultiChoiceField()
                                : ft.type === 'phone' || ft.type === 'whatsapp'
                                  ? {
                                      id: createFieldId(ft.type),
                                      type: ft.type,
                                      label: ft.label,
                                      required: true,
                                      placeholder: '07xxxxxxxxx',
                                      validation: {
                                        regex: '^07\\d{9}$',
                                        minLength: 11,
                                        maxLength: 11,
                                        errorMessage:
                                          'رقم الهاتف يجب أن يكون 11 رقماً ويبدأ بـ 07 (مثال: 07701234567)',
                                      },
                                    }
                                : ft.type === 'city' || ft.type === 'governorate'
                                  ? {
                                      id: createFieldId(ft.type),
                                      type: ft.type,
                                      label: ft.type === 'city' ? 'المدينة / المحافظة' : 'المحافظة',
                                      required: true,
                                      placeholder: 'اختر المحافظة',
                                      options: [...IRAQ_GOVERNORATES],
                                    }
                                  : {
                                      id: createFieldId(ft.type),
                                      type: ft.type,
                                      label: ft.label,
                                      required: ft.type === 'name',
                                      placeholder: ft.label,
                                    };
                          updateBlockProps(selected.id, { fields: [...formFields, next] });
                        }}
                      >
                        + {ft.label}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          )}

          <div className="mt-6 space-y-2 rounded-xl border p-3">
            <p className="text-sm font-medium">صفحة الشكر</p>
            <Label>العنوان</Label>
            <Input
              value={doc.thankYou.title}
              onChange={(e) =>
                updateDoc((prev) => ({
                  ...prev,
                  thankYou: { ...prev.thankYou, title: e.target.value },
                }))
              }
            />
            <Label>الرسالة</Label>
            <textarea
              className="min-h-20 w-full rounded-md border px-3 py-2 text-sm"
              value={doc.thankYou.message}
              onChange={(e) =>
                updateDoc((prev) => ({
                  ...prev,
                  thankYou: { ...prev.thankYou, message: e.target.value },
                }))
              }
            />
          </div>

          <div className="mt-4 space-y-2 text-xs text-muted-foreground">
            <p>الرابط العام:</p>
            <code className="block break-all rounded bg-muted p-2">{form.publicUrl}</code>
            <p>رابط قصير:</p>
            <code className="block break-all rounded bg-muted p-2">{form.shortUrl}</code>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={form.qrUrl} alt="QR" className="mx-auto mt-2 h-32 w-32 rounded-lg border bg-white p-2" />
            <Link
              href="/tiktok/integration/forms/orders"
              className="inline-flex items-center gap-1 text-violet-600 hover:underline"
            >
              <Sparkles className="h-3.5 w-3.5" />
              إدارة الطلبات
            </Link>
          </div>
        </aside>
      </div>
    </div>
  );
}

function toDatetimeLocalValue(iso?: string) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function remainingParts(endsAt?: string) {
  const end = endsAt ? new Date(endsAt).getTime() : Date.now();
  const diff = Math.max(0, end - Date.now());
  return {
    days: Math.floor(diff / 86_400_000),
    hours: Math.floor((diff % 86_400_000) / 3_600_000),
    minutes: Math.floor((diff % 3_600_000) / 60_000),
  };
}

function BlockPropsEditor({
  block,
  product,
  uploading,
  onUpload,
  onChangeProps,
  onChangeProduct,
}: {
  block: InstantFormBlock;
  product?: InstantFormProduct;
  uploading: boolean;
  onUpload: (file: File) => Promise<string | null>;
  onChangeProps: (patch: Record<string, unknown>) => void;
  onChangeProduct: (patch: Partial<InstantFormProduct>) => void;
}) {
  const p = block.props;
  const set = onChangeProps;

  const commonText = (
    <>
      {'title' in p ? (
        <div className="space-y-1">
          <Label>العنوان</Label>
          <Input value={String(p.title || '')} onChange={(e) => set({ title: e.target.value })} />
        </div>
      ) : null}
      {'subtitle' in p ? (
        <div className="space-y-1">
          <Label>العنوان الفرعي</Label>
          <Input value={String(p.subtitle || '')} onChange={(e) => set({ subtitle: e.target.value })} />
        </div>
      ) : null}
      {'badge' in p ? (
        <div className="space-y-1">
          <Label>الشارة</Label>
          <Input value={String(p.badge || '')} onChange={(e) => set({ badge: e.target.value })} />
        </div>
      ) : null}
      {'text' in p ? (
        <div className="space-y-1">
          <Label>النص</Label>
          <textarea
            className="min-h-24 w-full rounded-md border px-3 py-2 text-sm"
            value={String(p.text || '')}
            onChange={(e) => set({ text: e.target.value })}
          />
        </div>
      ) : null}
      {'label' in p ? (
        <div className="space-y-1">
          <Label>التسمية / نص الزر</Label>
          <Input value={String(p.label || '')} onChange={(e) => set({ label: e.target.value })} />
        </div>
      ) : null}
    </>
  );

  if (block.type === 'countdown' || block.type === 'offer_countdown') {
    const rem = remainingParts(String(p.endsAt || ''));
    const applyDuration = (days: number, hours: number, minutes: number) => {
      const ms = Math.max(0, days) * 86_400_000 + Math.max(0, hours) * 3_600_000 + Math.max(0, minutes) * 60_000;
      set({ endsAt: new Date(Date.now() + ms).toISOString() });
    };
    return (
      <div className="space-y-3 rounded-xl border border-amber-100 bg-amber-50/40 p-2.5">
        <p className="text-xs font-semibold text-amber-900">إعداد العدّاد التنازلي</p>
        <div className="space-y-1">
          <Label>العنوان</Label>
          <Input value={String(p.title || '')} onChange={(e) => set({ title: e.target.value })} />
        </div>
        <div className="space-y-1">
          <Label>تاريخ ووقت الانتهاء</Label>
          <Input
            type="datetime-local"
            value={toDatetimeLocalValue(String(p.endsAt || ''))}
            onChange={(e) => {
              const v = e.target.value;
              if (!v) return;
              set({ endsAt: new Date(v).toISOString() });
            }}
          />
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div className="space-y-1">
            <Label className="text-xs">أيام</Label>
            <Input
              type="number"
              min={0}
              value={rem.days}
              onChange={(e) => applyDuration(Number(e.target.value) || 0, rem.hours, rem.minutes)}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">ساعات</Label>
            <Input
              type="number"
              min={0}
              value={rem.hours}
              onChange={(e) => applyDuration(rem.days, Number(e.target.value) || 0, rem.minutes)}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">دقائق</Label>
            <Input
              type="number"
              min={0}
              max={59}
              value={rem.minutes}
              onChange={(e) => applyDuration(rem.days, rem.hours, Number(e.target.value) || 0)}
            />
          </div>
        </div>
        <div className="flex flex-wrap gap-1">
          {[
            { l: 'ساعة', d: 0, h: 1, m: 0 },
            { l: '6 ساعات', d: 0, h: 6, m: 0 },
            { l: 'يوم', d: 1, h: 0, m: 0 },
            { l: '3 أيام', d: 3, h: 0, m: 0 },
            { l: 'أسبوع', d: 7, h: 0, m: 0 },
          ].map((opt) => (
            <button
              key={opt.l}
              type="button"
              className="rounded-md border bg-background px-2 py-1 text-[11px] hover:bg-muted"
              onClick={() => applyDuration(opt.d, opt.h, opt.m)}
            >
              {opt.l}
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (block.type === 'order_counter' || block.type === 'viewer_counter') {
    return (
      <div className="space-y-2">
        <div className="space-y-1">
          <Label>التسمية</Label>
          <Input value={String(p.label || '')} onChange={(e) => set({ label: e.target.value })} />
        </div>
        <div className="space-y-1">
          <Label>الرقم</Label>
          <Input
            type="number"
            min={0}
            value={Number(p.value ?? 0)}
            onChange={(e) => set({ value: Number(e.target.value) || 0 })}
          />
        </div>
      </div>
    );
  }

  if (block.type === 'reviews') {
    return (
      <div className="space-y-2">
        <div className="space-y-1">
          <Label>التسمية</Label>
          <Input value={String(p.label || '')} onChange={(e) => set({ label: e.target.value })} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label>التقييم</Label>
            <Input
              type="number"
              min={0}
              max={5}
              step={0.1}
              value={Number(p.rating ?? 5)}
              onChange={(e) => set({ rating: Number(e.target.value) || 0 })}
            />
          </div>
          <div className="space-y-1">
            <Label>عدد التقييمات</Label>
            <Input
              type="number"
              min={0}
              value={Number(p.count ?? 0)}
              onChange={(e) => set({ count: Number(e.target.value) || 0 })}
            />
          </div>
        </div>
      </div>
    );
  }

  if (block.type === 'spacer') {
    return (
      <div className="space-y-1">
        <Label>الارتفاع (px)</Label>
        <Input
          type="number"
          min={4}
          value={Number(p.height ?? 24)}
          onChange={(e) => set({ height: Number(e.target.value) || 24 })}
        />
      </div>
    );
  }

  if (block.type === 'button') {
    return (
      <div className="space-y-2">
        <div className="space-y-1">
          <Label>نص الزر</Label>
          <Input value={String(p.label || '')} onChange={(e) => set({ label: e.target.value })} />
        </div>
        <div className="space-y-1">
          <Label>الرابط</Label>
          <Input value={String(p.href || '')} onChange={(e) => set({ href: e.target.value })} placeholder="#form" />
        </div>
      </div>
    );
  }

  if (block.type === 'whatsapp_button') {
    return (
      <div className="space-y-2">
        <div className="space-y-1">
          <Label>نص الزر</Label>
          <Input value={String(p.label || '')} onChange={(e) => set({ label: e.target.value })} />
        </div>
        <div className="space-y-1">
          <Label>رسالة واتساب</Label>
          <textarea
            className="min-h-20 w-full rounded-md border px-3 py-2 text-sm"
            value={String(p.message || '')}
            onChange={(e) => set({ message: e.target.value })}
          />
        </div>
      </div>
    );
  }

  if (block.type === 'google_maps' || block.type === 'location') {
    return (
      <div className="space-y-2">
        <div className="space-y-1">
          <Label>العنوان</Label>
          <Input value={String(p.address || '')} onChange={(e) => set({ address: e.target.value })} />
        </div>
        <div className="space-y-1">
          <Label>رابط Embed للخريطة</Label>
          <Input value={String(p.embedUrl || '')} onChange={(e) => set({ embedUrl: e.target.value })} />
        </div>
      </div>
    );
  }

  if (block.type === 'testimonials') {
    const items = (Array.isArray(p.items) ? p.items : []) as Array<{
      name: string;
      text: string;
      rating?: number;
    }>;
    return (
      <div className="space-y-2">
        {items.map((item, idx) => (
          <div key={idx} className="space-y-1 rounded-lg border p-2">
            <Input
              value={item.name}
              placeholder="الاسم"
              onChange={(e) => {
                const next = [...items];
                next[idx] = { ...item, name: e.target.value };
                set({ items: next });
              }}
            />
            <textarea
              className="min-h-16 w-full rounded-md border px-3 py-2 text-sm"
              value={item.text}
              placeholder="الرأي"
              onChange={(e) => {
                const next = [...items];
                next[idx] = { ...item, text: e.target.value };
                set({ items: next });
              }}
            />
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={1}
                max={5}
                className="w-20"
                value={item.rating ?? 5}
                onChange={(e) => {
                  const next = [...items];
                  next[idx] = { ...item, rating: Number(e.target.value) || 5 };
                  set({ items: next });
                }}
              />
              <Button
                size="sm"
                variant="ghost"
                className="text-destructive"
                onClick={() => set({ items: items.filter((_, i) => i !== idx) })}
              >
                حذف
              </Button>
            </div>
          </div>
        ))}
        <Button
          size="sm"
          variant="outline"
          className="w-full"
          onClick={() => set({ items: [...items, { name: 'عميل', text: 'رأي جديد', rating: 5 }] })}
        >
          <Plus className="me-1 h-3.5 w-3.5" /> إضافة رأي
        </Button>
      </div>
    );
  }

  if (block.type === 'faq' || block.type === 'accordion') {
    const items = (Array.isArray(p.items) ? p.items : []) as Array<{ q: string; a: string }>;
    return (
      <div className="space-y-2">
        {items.map((item, idx) => (
          <div key={idx} className="space-y-1 rounded-lg border p-2">
            <Input
              value={item.q}
              placeholder="السؤال"
              onChange={(e) => {
                const next = [...items];
                next[idx] = { ...item, q: e.target.value };
                set({ items: next });
              }}
            />
            <textarea
              className="min-h-16 w-full rounded-md border px-3 py-2 text-sm"
              value={item.a}
              placeholder="الجواب"
              onChange={(e) => {
                const next = [...items];
                next[idx] = { ...item, a: e.target.value };
                set({ items: next });
              }}
            />
            <Button
              size="sm"
              variant="ghost"
              className="text-destructive"
              onClick={() => set({ items: items.filter((_, i) => i !== idx) })}
            >
              حذف
            </Button>
          </div>
        ))}
        <Button
          size="sm"
          variant="outline"
          className="w-full"
          onClick={() => set({ items: [...items, { q: 'سؤال جديد؟', a: 'الجواب هنا' }] })}
        >
          <Plus className="me-1 h-3.5 w-3.5" /> إضافة سؤال
        </Button>
      </div>
    );
  }

  if (block.type === 'tabs') {
    const tabs = (Array.isArray(p.tabs) ? p.tabs : []) as Array<{ label: string; content: string }>;
    return (
      <div className="space-y-2">
        {tabs.map((tab, idx) => (
          <div key={idx} className="space-y-1 rounded-lg border p-2">
            <Input
              value={tab.label}
              placeholder="عنوان التبويب"
              onChange={(e) => {
                const next = [...tabs];
                next[idx] = { ...tab, label: e.target.value };
                set({ tabs: next });
              }}
            />
            <textarea
              className="min-h-16 w-full rounded-md border px-3 py-2 text-sm"
              value={tab.content}
              placeholder="المحتوى"
              onChange={(e) => {
                const next = [...tabs];
                next[idx] = { ...tab, content: e.target.value };
                set({ tabs: next });
              }}
            />
            <Button
              size="sm"
              variant="ghost"
              className="text-destructive"
              onClick={() => set({ tabs: tabs.filter((_, i) => i !== idx) })}
            >
              حذف
            </Button>
          </div>
        ))}
        <Button
          size="sm"
          variant="outline"
          className="w-full"
          onClick={() => set({ tabs: [...tabs, { label: 'تبويب', content: 'محتوى' }] })}
        >
          <Plus className="me-1 h-3.5 w-3.5" /> إضافة تبويب
        </Button>
      </div>
    );
  }

  if (block.type === 'comparison_table') {
    const headers = (Array.isArray(p.headers) ? p.headers : []) as string[];
    const rows = (Array.isArray(p.rows) ? p.rows : []) as string[][];
    return (
      <div className="space-y-2">
        <div className="space-y-1">
          <Label>العناوين (مفصولة بـ |)</Label>
          <Input
            value={headers.join(' | ')}
            onChange={(e) =>
              set({
                headers: e.target.value.split('|').map((s) => s.trim()).filter(Boolean),
              })
            }
          />
        </div>
        <div className="space-y-1">
          <Label>الصفوف (سطر لكل صف، خلايا بـ |)</Label>
          <textarea
            className="min-h-28 w-full rounded-md border px-3 py-2 text-sm"
            value={rows.map((r) => r.join(' | ')).join('\n')}
            onChange={(e) =>
              set({
                rows: e.target.value
                  .split('\n')
                  .map((line) => line.split('|').map((s) => s.trim()))
                  .filter((r) => r.some(Boolean)),
              })
            }
          />
        </div>
      </div>
    );
  }

  if (block.type === 'image') {
    return (
      <div className="space-y-2">
        <ImagePicker
          label="صورة القسم"
          value={String(p.src || '')}
          uploading={uploading}
          onUpload={async (file) => {
            const url = await onUpload(file);
            if (url) set({ src: url });
          }}
          onUrlChange={(url) => set({ src: url })}
        />
        <div className="space-y-1">
          <Label>النص البديل</Label>
          <Input value={String(p.alt || '')} onChange={(e) => set({ alt: e.target.value })} />
        </div>
        <ImageSizeControls
          title="قياسات الصورة"
          showAlign
          values={{
            width: String(p.width || '100%'),
            height: String(p.height || '240px'),
            objectFit: String(p.objectFit || 'cover'),
            borderRadius: String(p.borderRadius || '16px'),
            align: String(p.align || 'center'),
            maxWidth: String(p.maxWidth || '100%'),
          }}
          onChange={(patch) => set(patch)}
        />
      </div>
    );
  }

  if (block.type === 'before_after') {
    return (
      <div className="space-y-3">
        <ImagePicker
          label="صورة قبل"
          value={String(p.before || '')}
          uploading={uploading}
          onUpload={async (file) => {
            const url = await onUpload(file);
            if (url) set({ before: url });
          }}
          onUrlChange={(url) => set({ before: url })}
        />
        <ImagePicker
          label="صورة بعد"
          value={String(p.after || '')}
          uploading={uploading}
          onUpload={async (file) => {
            const url = await onUpload(file);
            if (url) set({ after: url });
          }}
          onUrlChange={(url) => set({ after: url })}
        />
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label>تسمية قبل</Label>
            <Input value={String(p.labelBefore || '')} onChange={(e) => set({ labelBefore: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label>تسمية بعد</Label>
            <Input value={String(p.labelAfter || '')} onChange={(e) => set({ labelAfter: e.target.value })} />
          </div>
        </div>
        <ImageSizeControls
          title="قياسات قبل/بعد"
          values={{
            height: String(p.imageHeight || '140px'),
            objectFit: String(p.objectFit || 'cover'),
            borderRadius: String(p.borderRadius || '12px'),
          }}
          fields={['height', 'objectFit', 'borderRadius']}
          onChange={(patch) =>
            set({
              ...(patch.height != null ? { imageHeight: patch.height } : {}),
              ...(patch.objectFit != null ? { objectFit: patch.objectFit } : {}),
              ...(patch.borderRadius != null ? { borderRadius: patch.borderRadius } : {}),
            })
          }
        />
      </div>
    );
  }

  if (block.type === 'gallery' || block.type === 'carousel') {
    const images = (Array.isArray(p.images) ? p.images : []) as string[];
    const moveImage = (from: number, to: number) => {
      if (to < 0 || to >= images.length) return;
      const next = [...images];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item!);
      set({ images: next });
    };
    return (
      <div className="space-y-2">
        <Label>معرض الصور</Label>
        <ImagePicker
          label="إضافة صورة"
          value=""
          uploading={uploading}
          onUpload={async (file) => {
            const url = await onUpload(file);
            if (!url) return;
            set({ images: [...images, url] });
          }}
          onUrlChange={(url) => {
            if (!url.trim()) return;
            set({ images: [...images, url.trim()] });
          }}
        />
        <div className="space-y-2">
          {images.map((src, i) => (
            <div key={`${src}-${i}`} className="flex items-center gap-2 rounded-lg border bg-muted/20 p-2">
              {src ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={src} alt="" className="h-12 w-12 shrink-0 rounded-md border object-cover" />
              ) : (
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md border bg-white text-[10px] text-muted-foreground">
                  صورة {i + 1}
                </div>
              )}
              <div className="min-w-0 flex-1 truncate text-[11px] text-muted-foreground" dir="ltr">
                {src || `صورة ${i + 1}`}
              </div>
              <div className="flex shrink-0 gap-1">
                <button
                  type="button"
                  title="يسار / أعلى"
                  disabled={i === 0}
                  className="rounded border bg-white p-1 disabled:opacity-30"
                  onClick={() => moveImage(i, i - 1)}
                >
                  <ChevronUp className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  title="يمين / أسفل"
                  disabled={i >= images.length - 1}
                  className="rounded border bg-white p-1 disabled:opacity-30"
                  onClick={() => moveImage(i, i + 1)}
                >
                  <ChevronDown className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  title="تكرار الصورة"
                  className="rounded border bg-white p-1"
                  onClick={() => {
                    const next = [...images];
                    next.splice(i + 1, 0, src);
                    set({ images: next });
                  }}
                >
                  <CopyPlus className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  title="حذف الصورة"
                  className="rounded border border-red-200 bg-white p-1 text-red-600"
                  onClick={() => set({ images: images.filter((_, idx) => idx !== i) })}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
        <ImageSizeControls
          title="قياسات المعرض"
          values={{
            height: String(p.imageHeight || '140px'),
            objectFit: String(p.objectFit || 'cover'),
            borderRadius: String(p.borderRadius || '12px'),
            columns: String(p.columns || 2),
          }}
          fields={['height', 'objectFit', 'borderRadius', 'columns']}
          onChange={(patch) =>
            set({
              ...(patch.height != null ? { imageHeight: patch.height } : {}),
              ...(patch.objectFit != null ? { objectFit: patch.objectFit } : {}),
              ...(patch.borderRadius != null ? { borderRadius: patch.borderRadius } : {}),
              ...(patch.columns != null ? { columns: Number(patch.columns) || 2 } : {}),
            })
          }
        />
      </div>
    );
  }

  if (block.type === 'video' || block.type === 'tiktok_video' || block.type === 'youtube_video') {
    return (
      <div className="space-y-1">
        <Label>رابط الفيديو / Embed</Label>
        <Input value={String(p.url || '')} onChange={(e) => set({ url: e.target.value })} />
      </div>
    );
  }

  if (block.type === 'banner') {
    return (
      <div className="space-y-2">
        {commonText}
        <ImagePicker
          label="صورة الخلفية (اختياري)"
          value={String(p.src || '')}
          uploading={uploading}
          onUpload={async (file) => {
            const url = await onUpload(file);
            if (url) set({ src: url });
          }}
          onUrlChange={(url) => set({ src: url })}
        />
      </div>
    );
  }

  if (Array.isArray(p.items) && (p.items.length === 0 || typeof p.items[0] === 'string')) {
    return (
      <div className="space-y-2">
        {commonText}
        <div className="space-y-1">
          <Label>العناصر (سطر لكل عنصر)</Label>
          <textarea
            className="min-h-28 w-full rounded-md border px-3 py-2 text-sm"
            value={(p.items as string[]).join('\n')}
            onChange={(e) => set({ items: e.target.value.split('\n').filter(Boolean) })}
          />
        </div>
      </div>
    );
  }

  if (block.type === 'multi_choice') {
    const choices = (Array.isArray(p.choices) ? p.choices : []) as InstantFormColorChoice[];
    const synthetic: InstantFormField = {
      id: block.id,
      type: 'multiselect',
      label: String(p.title || 'اختيارات متعددة'),
      required: Boolean(p.required),
      allowMultiple: p.allowMultiple !== false,
      choices,
      options: choices.map((c) => c.label).filter(Boolean),
    };
    return (
      <div className="space-y-3 rounded-xl border border-violet-100 bg-violet-50/40 p-2.5">
        <p className="text-xs font-semibold text-violet-900">إعداد الاختيارات المتعددة</p>
        <div className="space-y-1">
          <Label>العنوان</Label>
          <Input value={String(p.title || '')} onChange={(e) => set({ title: e.target.value })} />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={Boolean(p.required)}
            onChange={(e) => set({ required: e.target.checked })}
          />
          إجباري
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={p.showQuantity !== false}
            onChange={(e) => set({ showQuantity: e.target.checked })}
          />
          إظهار عدد القطع تحت كل اختيار
        </label>
        <ColorChoicesEditor
          field={synthetic}
          variant="choices"
          uploading={uploading}
          onUpload={onUpload}
          onChange={(patch) => {
            set({
              ...(patch.choices !== undefined ? { choices: patch.choices } : {}),
              ...(patch.allowMultiple !== undefined ? { allowMultiple: patch.allowMultiple } : {}),
            });
          }}
        />
      </div>
    );
  }

  if (block.type === 'form') {
    return (
      <div className="space-y-2">
        <div className="space-y-1">
          <Label>عنوان النموذج</Label>
          <Input value={String(p.title || '')} onChange={(e) => set({ title: e.target.value })} />
        </div>
      </div>
    );
  }

  if (block.type === 'product_card') {
    return (
      <div className="space-y-3 rounded-xl border border-emerald-100 bg-emerald-50/40 p-2.5">
        <p className="text-xs font-semibold text-emerald-900">تعديل بطاقة المنتج</p>
        <div className="space-y-1">
          <Label>اسم المنتج</Label>
          <Input
            value={product?.name || ''}
            onChange={(e) => onChangeProduct({ name: e.target.value })}
          />
        </div>
        <div className="space-y-1">
          <Label>وصف المنتج</Label>
          <textarea
            className="min-h-28 w-full rounded-md border bg-background px-3 py-2 text-sm"
            value={product?.description || ''}
            placeholder="اكتب وصف المنتج هنا…"
            onChange={(e) => onChangeProduct({ description: e.target.value })}
          />
        </div>
        <div className="space-y-1">
          <Label>الشارة</Label>
          <Input
            value={product?.badge || ''}
            placeholder="مثل: عرض خاص"
            onChange={(e) => onChangeProduct({ badge: e.target.value })}
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label>السعر</Label>
            <Input
              type="text"
              inputMode="numeric"
              dir="ltr"
              lang="en"
              className="text-start"
              placeholder="15000"
              value={moneyInputValue(product?.price)}
              onChange={(e) => {
                const parsed = parseMoneyInput(e.target.value);
                onChangeProduct({ price: parsed == null ? undefined : parsed });
              }}
            />
          </div>
          <div className="space-y-1">
            <Label>السعر السابق</Label>
            <Input
              type="text"
              inputMode="numeric"
              dir="ltr"
              lang="en"
              className="text-start"
              placeholder="25000"
              value={moneyInputValue(product?.compareAtPrice)}
              onChange={(e) => {
                const parsed = parseMoneyInput(e.target.value);
                onChangeProduct({ compareAtPrice: parsed == null ? undefined : parsed });
              }}
            />
          </div>
        </div>
        <ImagePicker
          label="صورة المنتج"
          value={(product?.images && product.images[0]) || ''}
          uploading={uploading}
          onUpload={async (file) => {
            const url = await onUpload(file);
            if (!url) return;
            onChangeProduct({ images: [url, ...(product?.images?.slice(1) || [])] });
          }}
          onUrlChange={(url) =>
            onChangeProduct({
              images: url ? [url, ...(product?.images?.slice(1) || [])] : [],
            })
          }
        />
      </div>
    );
  }

  if (block.type === 'divider') {
    return <p className="text-xs text-muted-foreground">لا خصائص إضافية لهذا العنصر.</p>;
  }

  return <div className="space-y-2">{commonText}</div>;
}

function ImagePicker({
  label = 'الصورة',
  value,
  uploading,
  onUpload,
  onUrlChange,
}: {
  label?: string;
  value: string;
  uploading: boolean;
  onUpload: (file: File) => Promise<void>;
  onUrlChange: (url: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div className="space-y-2 rounded-xl border bg-muted/20 p-2.5">
      <Label>{label}</Label>
      {value ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={value} alt="" className="h-28 w-full rounded-lg border object-cover" />
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
        >
          {uploading ? (
            <Loader2 className="me-1 h-3.5 w-3.5 animate-spin" />
          ) : (
            <ImagePlus className="me-1 h-3.5 w-3.5" />
          )}
          رفع من الجهاز
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void onUpload(file);
            e.target.value = '';
          }}
        />
      </div>
      <Input
        value={value}
        onChange={(e) => onUrlChange(e.target.value)}
        placeholder="أو الصق رابط صورة (اختياري)"
      />
    </div>
  );
}

type ImageSizePatch = {
  width?: string;
  height?: string;
  objectFit?: string;
  borderRadius?: string;
  align?: string;
  maxWidth?: string;
  columns?: string;
};

function ImageSizeControls({
  title,
  values,
  onChange,
  showAlign,
  fields,
}: {
  title: string;
  values: ImageSizePatch;
  onChange: (patch: ImageSizePatch) => void;
  showAlign?: boolean;
  fields?: Array<keyof ImageSizePatch>;
}) {
  const enabled = new Set(
    fields ||
      (['width', 'height', 'objectFit', 'borderRadius', ...(showAlign ? (['align'] as const) : [])] as Array<
        keyof ImageSizePatch
      >),
  );

  return (
    <div className="space-y-2 rounded-xl border border-violet-100 bg-violet-50/40 p-2.5">
      <p className="text-xs font-semibold text-violet-900">{title}</p>

      {enabled.has('width') ? (
        <div className="space-y-1">
          <Label className="text-xs">العرض</Label>
          <div className="flex flex-wrap gap-1">
            {['100%', '90%', '80%', '70%', '50%'].map((w) => (
              <button
                key={w}
                type="button"
                className={cn(
                  'rounded-md border px-2 py-1 text-[11px]',
                  values.width === w ? 'border-violet-500 bg-violet-100' : 'bg-background hover:bg-muted',
                )}
                onClick={() => onChange({ width: w })}
              >
                {w}
              </button>
            ))}
          </div>
          <Input
            value={values.width || ''}
            placeholder="مثال: 320px أو 100%"
            onChange={(e) => onChange({ width: e.target.value })}
          />
        </div>
      ) : null}

      {enabled.has('height') ? (
        <div className="space-y-1">
          <Label className="text-xs">الارتفاع</Label>
          <div className="flex flex-wrap gap-1">
            {['auto', '160px', '200px', '240px', '280px', '320px'].map((h) => (
              <button
                key={h}
                type="button"
                className={cn(
                  'rounded-md border px-2 py-1 text-[11px]',
                  values.height === h ? 'border-violet-500 bg-violet-100' : 'bg-background hover:bg-muted',
                )}
                onClick={() => onChange({ height: h })}
              >
                {h}
              </button>
            ))}
          </div>
          <Input
            value={values.height || ''}
            placeholder="مثال: 240px أو auto"
            onChange={(e) => onChange({ height: e.target.value })}
          />
        </div>
      ) : null}

      {enabled.has('objectFit') ? (
        <div className="space-y-1">
          <Label className="text-xs">ملاءمة الصورة</Label>
          <div className="flex flex-wrap gap-1">
            {[
              { v: 'cover', l: 'تغطية' },
              { v: 'contain', l: 'احتواء' },
              { v: 'fill', l: 'ملء' },
              { v: 'none', l: 'أصلي' },
            ].map((opt) => (
              <button
                key={opt.v}
                type="button"
                className={cn(
                  'rounded-md border px-2 py-1 text-[11px]',
                  values.objectFit === opt.v
                    ? 'border-violet-500 bg-violet-100'
                    : 'bg-background hover:bg-muted',
                )}
                onClick={() => onChange({ objectFit: opt.v })}
              >
                {opt.l}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {enabled.has('borderRadius') ? (
        <div className="space-y-1">
          <Label className="text-xs">الحواف</Label>
          <div className="flex flex-wrap gap-1">
            {['0px', '8px', '12px', '16px', '24px', '999px'].map((r) => (
              <button
                key={r}
                type="button"
                className={cn(
                  'rounded-md border px-2 py-1 text-[11px]',
                  values.borderRadius === r
                    ? 'border-violet-500 bg-violet-100'
                    : 'bg-background hover:bg-muted',
                )}
                onClick={() => onChange({ borderRadius: r })}
              >
                {r === '999px' ? 'دائري' : r}
              </button>
            ))}
          </div>
          <Input
            value={values.borderRadius || ''}
            placeholder="16px"
            onChange={(e) => onChange({ borderRadius: e.target.value })}
          />
        </div>
      ) : null}

      {enabled.has('align') || showAlign ? (
        <div className="space-y-1">
          <Label className="text-xs">المحاذاة</Label>
          <div className="flex flex-wrap gap-1">
            {[
              { v: 'start', l: 'بداية' },
              { v: 'center', l: 'وسط' },
              { v: 'end', l: 'نهاية' },
            ].map((opt) => (
              <button
                key={opt.v}
                type="button"
                className={cn(
                  'rounded-md border px-2 py-1 text-[11px]',
                  values.align === opt.v
                    ? 'border-violet-500 bg-violet-100'
                    : 'bg-background hover:bg-muted',
                )}
                onClick={() => onChange({ align: opt.v })}
              >
                {opt.l}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {enabled.has('columns') ? (
        <div className="space-y-1">
          <Label className="text-xs">عدد الأعمدة</Label>
          <div className="flex flex-wrap gap-1">
            {['1', '2', '3', '4'].map((c) => (
              <button
                key={c}
                type="button"
                className={cn(
                  'rounded-md border px-2 py-1 text-[11px]',
                  String(values.columns) === c
                    ? 'border-violet-500 bg-violet-100'
                    : 'bg-background hover:bg-muted',
                )}
                onClick={() => onChange({ columns: c })}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {enabled.has('maxWidth') ? (
        <div className="space-y-1">
          <Label className="text-xs">أقصى عرض</Label>
          <Input
            value={values.maxWidth || ''}
            placeholder="100% أو 420px"
            onChange={(e) => onChange({ maxWidth: e.target.value })}
          />
        </div>
      ) : null}
    </div>
  );
}

function normalizeColorChoices(field: InstantFormField): InstantFormColorChoice[] {
  if (field.choices?.length) return field.choices;
  if (field.options?.length) {
    return field.options.map((label) => ({ id: createColorChoiceId(), label }));
  }
  return [];
}

function ColorChoicesEditor({
  field,
  uploading,
  onUpload,
  onChange,
  variant = 'color',
}: {
  field: InstantFormField;
  uploading: boolean;
  onUpload: (file: File) => Promise<string | null>;
  onChange: (patch: Partial<InstantFormField>) => void;
  variant?: 'color' | 'choices';
}) {
  const choices = normalizeColorChoices(field);
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const isColor = variant === 'color';

  function setChoices(next: InstantFormColorChoice[]) {
    onChange({
      choices: next,
      options: next.map((c) => c.label).filter(Boolean),
      allowMultiple: field.allowMultiple !== false,
    });
  }

  function updateChoice(id: string, patch: Partial<InstantFormColorChoice>) {
    setChoices(choices.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }

  return (
    <div className="space-y-2 rounded-xl border border-violet-100 bg-violet-50/50 p-2.5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold text-violet-900">
          {isColor ? 'ألوان المنتج (صور / أسماء)' : 'الاختيارات (صور / نصوص) — اختيار متعدد'}
        </p>
        <label className="flex items-center gap-1.5 text-[11px] text-violet-800">
          <input
            type="checkbox"
            checked={field.allowMultiple !== false}
            onChange={(e) =>
              onChange({
                allowMultiple: e.target.checked,
                choices,
                options: choices.map((c) => c.label),
              })
            }
          />
          اختيار متعدد
        </label>
      </div>

      {choices.length === 0 ? (
        <p className="text-[11px] text-muted-foreground">
          {isColor
            ? 'لا توجد ألوان بعد — أضف لوناً بالاسم أو بصورة.'
            : 'لا توجد اختيارات بعد — أضف خياراً بالاسم أو بصورة.'}
        </p>
      ) : null}

      {isColor ? (
        <div className="space-y-1.5 rounded-lg border border-violet-200/80 bg-white p-2">
          <label className="flex items-center gap-1.5 text-[11px] font-medium text-violet-900">
            <input
              type="checkbox"
              checked={field.withSizes !== false}
              onChange={(e) =>
                onChange({
                  withSizes: e.target.checked,
                  sizeOptions: field.sizeOptions?.length
                    ? field.sizeOptions
                    : ['S', 'M', 'L', 'XL', 'XXL'],
                })
              }
            />
            طلب القياس مع كل لون (حسب العدد)
          </label>
          {field.withSizes !== false ? (
            <>
              <Label className="text-[10px] text-muted-foreground">
                القياسات المتوفرة (سطر لكل قياس) — عند العدد 2 يظهر اختياران للقياس
              </Label>
              <textarea
                className="min-h-16 w-full rounded-md border px-2 py-1.5 text-xs"
                placeholder={'S\nM\nL\nXL\nXXL'}
                value={(field.sizeOptions || []).join('\n')}
                onChange={(e) =>
                  onChange({
                    withSizes: true,
                    sizeOptions: e.target.value
                      .split('\n')
                      .map((s) => s.trim())
                      .filter(Boolean),
                  })
                }
              />
            </>
          ) : null}
        </div>
      ) : null}

      <div className="space-y-2">
        {choices.map((choice, index) => (
          <div key={choice.id} className="space-y-1.5 rounded-lg border bg-background p-2">
            <div className="flex items-start gap-2">
              <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg border bg-muted">
                {choice.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={choice.imageUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div
                    className="flex h-full w-full items-center justify-center text-[10px] text-muted-foreground"
                    style={{ background: choice.hex || undefined }}
                  >
                    {!choice.hex ? index + 1 : null}
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1 space-y-1">
                <Input
                  value={choice.label}
                  placeholder={isColor ? 'اسم اللون (مثل: أسود)' : 'اسم الخيار'}
                  className="h-8 text-xs"
                  onChange={(e) => updateChoice(choice.id, { label: e.target.value })}
                />
                <div className="flex flex-wrap items-center gap-1">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 text-[11px]"
                    disabled={uploading}
                    onClick={() => fileRefs.current[choice.id]?.click()}
                  >
                    {uploading ? (
                      <Loader2 className="me-1 h-3 w-3 animate-spin" />
                    ) : (
                      <Upload className="me-1 h-3 w-3" />
                    )}
                    {isColor ? 'صورة اللون' : 'صورة الخيار'}
                  </Button>
                  <input
                    ref={(el) => {
                      fileRefs.current[choice.id] = el;
                    }}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      e.target.value = '';
                      if (!file) return;
                      void onUpload(file).then((url) => {
                        if (url) updateChoice(choice.id, { imageUrl: url });
                      });
                    }}
                  />
                  {isColor ? (
                    <Input
                      type="color"
                      className="h-7 w-10 cursor-pointer p-0.5"
                      value={choice.hex || '#94a3b8'}
                      title="لون ثابت بدون صورة"
                      onChange={(e) => updateChoice(choice.id, { hex: e.target.value })}
                    />
                  ) : null}
                  {choice.imageUrl ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-7 text-[11px] text-muted-foreground"
                      onClick={() => updateChoice(choice.id, { imageUrl: '' })}
                    >
                      إزالة الصورة
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="ms-auto h-7 text-destructive"
                    onClick={() => setChoices(choices.filter((c) => c.id !== choice.id))}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <Button
        type="button"
        size="sm"
        variant="outline"
        className="w-full border-dashed border-violet-300 text-violet-800"
        onClick={() =>
          setChoices([
            ...choices,
            isColor
              ? { id: createColorChoiceId(), label: `لون ${choices.length + 1}`, hex: '#94a3b8' }
              : { id: createColorChoiceId(), label: `خيار ${choices.length + 1}` },
          ])
        }
      >
        <Plus className="me-1 h-3.5 w-3.5" />
        {isColor ? 'إضافة لون' : 'إضافة خيار'}
      </Button>
    </div>
  );
}
