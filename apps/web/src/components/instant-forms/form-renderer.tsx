'use client';

import { useEffect, useMemo, useState, type CSSProperties, type FormEvent, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import type {
  InstantFormBlock,
  InstantFormColorChoice,
  InstantFormDocument,
  InstantFormField,
  InstantFormStyle,
} from '@/lib/instant-forms/document';
import {
  IRAQI_PHONE_ERROR,
  IRAQ_GOVERNORATES,
  isValidIraqiPhone,
  normalizeIraqiPhone,
} from '@/lib/instant-forms/document';

function styleToCss(style?: InstantFormStyle): CSSProperties {
  if (!style) return {};
  return {
    backgroundColor: style.backgroundColor,
    backgroundImage: style.backgroundImage
      ? style.gradient
        ? style.gradient
        : `url(${style.backgroundImage})`
      : style.gradient,
    color: style.color,
    fontSize: style.fontSize,
    fontWeight: style.fontWeight as CSSProperties['fontWeight'],
    fontFamily: style.fontFamily,
    textAlign: style.textAlign,
    padding: style.padding,
    margin: style.margin,
    borderRadius: style.borderRadius,
    border: style.border,
    boxShadow: style.boxShadow,
    width: style.width,
    height: style.height,
    maxWidth: style.maxWidth,
    maxHeight: style.maxHeight,
    objectFit: style.objectFit,
    objectPosition: style.objectPosition,
    aspectRatio: style.aspectRatio,
    opacity: style.opacity,
  };
}

function imageFrameStyle(p: Record<string, unknown>): CSSProperties {
  return {
    width: String(p.width || '100%'),
    maxWidth: String(p.maxWidth || '100%'),
    height: p.height && String(p.height) !== 'auto' ? String(p.height) : 'auto',
    maxHeight: p.maxHeight ? String(p.maxHeight) : undefined,
    aspectRatio: p.aspectRatio ? String(p.aspectRatio) : undefined,
    borderRadius: String(p.borderRadius || '16px'),
    overflow: 'hidden',
    display: 'block',
  };
}

function imageMediaStyle(p: Record<string, unknown>): CSSProperties {
  return {
    width: '100%',
    height: '100%',
    objectFit: (String(p.objectFit || 'cover') as CSSProperties['objectFit']) || 'cover',
    objectPosition: p.objectPosition ? String(p.objectPosition) : 'center',
    display: 'block',
  };
}

function Countdown({ endsAt }: { endsAt?: string }) {
  const [left, setLeft] = useState({ d: 0, h: 0, m: 0, s: 0 });
  useEffect(() => {
    const tick = () => {
      const end = endsAt ? new Date(endsAt).getTime() : Date.now();
      const diff = Math.max(0, end - Date.now());
      setLeft({
        d: Math.floor(diff / 86_400_000),
        h: Math.floor((diff % 86_400_000) / 3_600_000),
        m: Math.floor((diff % 3_600_000) / 60_000),
        s: Math.floor((diff % 60_000) / 1000),
      });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [endsAt]);
  return (
    <div className="flex justify-center gap-2 text-center">
      {[
        ['يوم', left.d],
        ['ساعة', left.h],
        ['دقيقة', left.m],
        ['ثانية', left.s],
      ].map(([label, value]) => (
        <div key={String(label)} className="min-w-14 rounded-xl bg-slate-900 px-2 py-2 text-white">
          <div className="text-lg font-bold tabular-nums">{String(value).padStart(2, '0')}</div>
          <div className="text-[10px] opacity-80">{label}</div>
        </div>
      ))}
    </div>
  );
}

type FormMode = 'preview' | 'live';

function resolveColorChoices(
  field: InstantFormField,
  productColors?: string[],
): InstantFormColorChoice[] {
  if (field.choices?.length) return field.choices;
  if (field.options?.length) {
    return field.options.map((label, i) => ({ id: `${field.id}_opt_${i}`, label }));
  }
  if (productColors?.length) {
    return productColors.map((label, i) => ({ id: `${field.id}_prod_${i}`, label }));
  }
  return [];
}

function resolveLocationOptions(field: InstantFormField): string[] {
  if (field.type === 'size') return field.options || [];
  if (field.type !== 'city' && field.type !== 'governorate') {
    return field.options || [];
  }
  const opts = (field.options || []).map((o) => o.trim()).filter(Boolean);
  // Always offer the full governorates list unless merchant set a custom long list.
  if (opts.length >= IRAQ_GOVERNORATES.length) return opts;
  return IRAQ_GOVERNORATES;
}

type ChoiceQty = { id?: string; label: string; qty: number; sizes?: string[] };

function choiceKey(choice: InstantFormColorChoice) {
  return choice.id || choice.label;
}

function resizeUnitSizes(sizes: string[] | undefined, qty: number): string[] {
  const cur = Array.isArray(sizes) ? sizes.map((s) => String(s || '')) : [];
  if (cur.length === qty) return cur;
  if (cur.length > qty) return cur.slice(0, qty);
  return [...cur, ...Array.from({ length: qty - cur.length }, () => '')];
}

function parseChoiceQtyValue(value: unknown): ChoiceQty[] {
  if (value == null || value === '') return [];
  if (Array.isArray(value)) {
    const items: ChoiceQty[] = [];
    for (const item of value) {
      if (typeof item === 'string' && item.trim()) {
        items.push({ label: item.trim(), qty: 1, sizes: [''] });
        continue;
      }
      if (item && typeof item === 'object' && 'label' in item) {
        const label = String((item as { label: unknown }).label || '').trim();
        if (!label) continue;
        const qty = Math.max(1, Number((item as { qty?: unknown }).qty) || 1);
        const id =
          'id' in item && (item as { id?: unknown }).id != null
            ? String((item as { id: unknown }).id)
            : undefined;
        const rawSizes = (item as { sizes?: unknown }).sizes;
        const sizes = Array.isArray(rawSizes)
          ? resizeUnitSizes(
              rawSizes.map((s) => String(s ?? '')),
              qty,
            )
          : resizeUnitSizes([], qty);
        items.push({ id, label, qty, sizes });
      }
    }
    return items;
  }
  if (typeof value === 'string' && value.trim()) {
    return [{ label: value.trim(), qty: 1, sizes: [''] }];
  }
  return [];
}

function isChoiceSelected(
  selectedKeys: string[],
  selectedLabels: string[],
  choice: InstantFormColorChoice,
) {
  const key = choiceKey(choice);
  return selectedKeys.includes(key) || selectedLabels.includes(choice.label);
}

function ColorSwatchPicker({
  field,
  choices,
  value,
  mode,
  onChange,
  emptyHint = 'أضف اختيارات من إعدادات الحقل',
  withQuantity = false,
  sizeOptions = [],
}: {
  field: InstantFormField;
  choices: InstantFormColorChoice[];
  value: unknown;
  mode: FormMode;
  onChange: (v: unknown) => void;
  emptyHint?: string;
  withQuantity?: boolean;
  sizeOptions?: string[];
}) {
  const multi = field.allowMultiple !== false;
  // Allow tapping choices in builder preview so merchants can verify multi-select works.
  const interactive = true;
  const sizesEnabled = withQuantity && sizeOptions.length > 0 && field.withSizes !== false;
  const qtyItems = withQuantity ? parseChoiceQtyValue(value) : [];
  const selectedLabels = withQuantity
    ? qtyItems.map((x) => x.label)
    : multi
      ? Array.isArray(value)
        ? (value as unknown[]).map((item) =>
            typeof item === 'string'
              ? item
              : item && typeof item === 'object' && 'label' in item
                ? String((item as { label: unknown }).label)
                : String(item),
          )
        : value
          ? [String(value)]
          : []
      : value
        ? [
            typeof value === 'string'
              ? value
              : value && typeof value === 'object' && 'label' in value
                ? String((value as { label: unknown }).label)
                : String(value),
          ]
        : [];
  const selectedKeys = withQuantity
    ? qtyItems.map((x) => x.id || x.label)
    : Array.isArray(value)
      ? (value as unknown[]).map((item) => {
          if (typeof item === 'string') return item;
          if (item && typeof item === 'object') {
            const id = 'id' in item ? String((item as { id?: unknown }).id || '') : '';
            const label = 'label' in item ? String((item as { label?: unknown }).label || '') : '';
            return id || label;
          }
          return String(item);
        })
      : selectedLabels;

  function matchItem(choice: InstantFormColorChoice, x: ChoiceQty) {
    const key = choiceKey(choice);
    return (x.id && x.id === choice.id) || x.label === choice.label || x.id === key;
  }

  function qtyOf(choice: InstantFormColorChoice) {
    return qtyItems.find((x) => matchItem(choice, x))?.qty ?? 1;
  }

  function sizesOf(choice: InstantFormColorChoice) {
    const item = qtyItems.find((x) => matchItem(choice, x));
    return resizeUnitSizes(item?.sizes, item?.qty ?? 1);
  }

  function toggle(choice: InstantFormColorChoice) {
    if (!interactive) return;
    const key = choiceKey(choice);
    const active = isChoiceSelected(selectedKeys, selectedLabels, choice);

    if (withQuantity) {
      if (active) {
        const next = qtyItems.filter((x) => !matchItem(choice, x));
        onChange(multi ? next : next[0] ? [next[0]] : []);
      } else if (multi) {
        onChange([
          ...qtyItems,
          {
            id: choice.id,
            label: choice.label,
            qty: 1,
            sizes: sizesEnabled ? [''] : undefined,
          },
        ]);
      } else {
        onChange([
          {
            id: choice.id,
            label: choice.label,
            qty: 1,
            sizes: sizesEnabled ? [''] : undefined,
          },
        ]);
      }
      return;
    }

    if (multi) {
      const current = Array.isArray(value)
        ? (value as unknown[]).map((item) => {
            if (typeof item === 'string') return { id: item, label: item };
            if (item && typeof item === 'object' && 'label' in item) {
              return {
                id: String((item as { id?: unknown }).id || (item as { label: unknown }).label),
                label: String((item as { label: unknown }).label),
              };
            }
            return { id: String(item), label: String(item) };
          })
        : [];
      if (active) {
        onChange(
          current
            .filter((x) => x.id !== key && x.label !== choice.label)
            .map((x) => x.label),
        );
      } else {
        onChange([...current.map((x) => x.label), choice.label]);
      }
    } else {
      onChange(active ? '' : choice.label);
    }
  }

  function setQty(choice: InstantFormColorChoice, nextQty: number) {
    if (!interactive) return;
    if (nextQty < 1) {
      onChange(qtyItems.filter((x) => !matchItem(choice, x)));
      return;
    }
    onChange(
      qtyItems.map((x) =>
        matchItem(choice, x)
          ? {
              ...x,
              id: choice.id,
              label: choice.label,
              qty: nextQty,
              sizes: sizesEnabled ? resizeUnitSizes(x.sizes, nextQty) : x.sizes,
            }
          : x,
      ),
    );
  }

  function setUnitSize(choice: InstantFormColorChoice, unitIndex: number, size: string) {
    if (!interactive) return;
    onChange(
      qtyItems.map((x) => {
        if (!matchItem(choice, x)) return x;
        const sizes = resizeUnitSizes(x.sizes, x.qty);
        sizes[unitIndex] = size;
        return { ...x, id: choice.id, label: choice.label, sizes };
      }),
    );
  }

  if (!choices.length) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-center text-xs text-slate-400">
        {emptyHint}
      </div>
    );
  }

  const hasImages = choices.some((c) => c.imageUrl);
  const selectedChoices = choices.filter((c) => isChoiceSelected(selectedKeys, selectedLabels, c));

  return (
    <div className="space-y-3">
      <div className={cn('grid gap-2', hasImages ? 'grid-cols-3' : 'grid-cols-2 sm:grid-cols-3')}>
        {choices.map((choice) => {
          const active = isChoiceSelected(selectedKeys, selectedLabels, choice);
          return (
            <button
              key={choiceKey(choice)}
              type="button"
              disabled={!interactive}
              onClick={() => toggle(choice)}
              className={cn(
                'group relative w-full overflow-hidden rounded-xl border-2 text-start transition',
                active
                  ? 'border-violet-600 ring-2 ring-violet-500/30'
                  : 'border-slate-200 hover:border-violet-300',
                !interactive && 'cursor-default opacity-90',
              )}
            >
              {choice.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={choice.imageUrl}
                  alt={choice.label}
                  className="aspect-square w-full object-cover"
                  loading="lazy"
                />
              ) : (
                <div
                  className="flex aspect-square items-center justify-center"
                  style={{
                    background:
                      choice.hex || 'linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%)',
                  }}
                >
                  {!choice.hex ? (
                    <span className="px-1 text-center text-xs font-medium text-slate-600">
                      {choice.label}
                    </span>
                  ) : null}
                </div>
              )}
              <div
                className={cn(
                  'flex items-center justify-between gap-1 px-2 py-1.5 text-xs font-medium',
                  active ? 'bg-violet-50 text-violet-800' : 'bg-white text-slate-700',
                )}
              >
                <span className="truncate">{choice.label}</span>
                {active ? <span className="text-[10px] text-violet-600">✓</span> : null}
              </div>
            </button>
          );
        })}
      </div>

      {withQuantity && selectedChoices.length ? (
        <div className="space-y-2 rounded-xl border border-violet-100 bg-violet-50/60 p-2.5">
          <p className="text-[11px] font-semibold text-violet-900">
            {sizesEnabled ? 'العدد والقياس لكل لون' : 'عدد القطع لكل اختيار'}
          </p>
          {selectedChoices.map((choice) => {
            const qty = qtyOf(choice);
            const unitSizes = sizesOf(choice);
            return (
              <div
                key={`qty_${choiceKey(choice)}`}
                className="space-y-2 rounded-lg border bg-white px-2.5 py-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="min-w-0 flex-1 truncate text-xs font-medium text-slate-800">
                    {choice.label}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={!interactive}
                      className="flex h-8 w-8 items-center justify-center rounded-md border text-sm font-bold text-slate-700 disabled:opacity-50"
                      onClick={() => setQty(choice, qty - 1)}
                      aria-label="تقليل"
                    >
                      −
                    </button>
                    <input
                      type="number"
                      min={1}
                      max={999}
                      disabled={!interactive}
                      value={qty}
                      onChange={(e) => {
                        const n = Number(e.target.value);
                        if (!Number.isFinite(n)) return;
                        setQty(choice, Math.min(999, Math.max(1, Math.floor(n))));
                      }}
                      className="h-8 w-12 rounded-md border text-center text-xs font-semibold outline-none"
                    />
                    <button
                      type="button"
                      disabled={!interactive}
                      className="flex h-8 w-8 items-center justify-center rounded-md border text-sm font-bold text-slate-700 disabled:opacity-50"
                      onClick={() => setQty(choice, Math.min(999, qty + 1))}
                      aria-label="زيادة"
                    >
                      +
                    </button>
                  </div>
                </div>

                {sizesEnabled ? (
                  <div className="space-y-1.5 border-t border-slate-100 pt-2">
                    <p className="text-[10px] font-medium text-slate-500">
                      اختر القياس لكل قطعة ({qty})
                    </p>
                    <div className="grid gap-1.5 sm:grid-cols-2">
                      {unitSizes.map((size, unitIndex) => (
                        <label
                          key={`${choiceKey(choice)}_size_${unitIndex}`}
                          className="flex items-center gap-1.5 text-[11px] text-slate-600"
                        >
                          <span className="shrink-0 whitespace-nowrap">قطعة {unitIndex + 1}</span>
                          <select
                            disabled={!interactive}
                            value={size}
                            onChange={(e) => setUnitSize(choice, unitIndex, e.target.value)}
                            className={cn(
                              'h-8 min-w-0 flex-1 rounded-md border bg-white px-2 text-xs outline-none',
                              !size ? 'border-amber-300 text-slate-400' : 'border-slate-200 text-slate-800',
                            )}
                          >
                            <option value="">القياس…</option>
                            {sizeOptions.map((opt) => (
                              <option key={opt} value={opt}>
                                {opt}
                              </option>
                            ))}
                          </select>
                        </label>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}

      {multi ? (
        <p className="text-[11px] text-slate-400">
          {sizesEnabled
            ? `اختر اللون ثم العدد، وسيظهر اختيار قياس لكل قطعة (${sizeOptions.length} قياسات متاحة)`
            : withQuantity
              ? `يمكنك اختيار أكثر من خيار (${choices.length} متاح) ثم تحديد عدد القطع`
              : 'يمكنك اختيار أكثر من خيار'}
        </p>
      ) : null}
    </div>
  );
}

type Props = {
  document: InstantFormDocument;
  mode?: FormMode;
  selectedBlockId?: string | null;
  onSelectBlock?: (id: string) => void;
  onMoveBlockUp?: (id: string) => void;
  onMoveBlockDown?: (id: string) => void;
  onDuplicateBlock?: (id: string) => void;
  onDeleteBlock?: (id: string) => void;
  whatsappNumber?: string | null;
  submitting?: boolean;
  fieldErrors?: Record<string, string>;
  onSubmit?: (answers: Record<string, unknown>) => void | Promise<void>;
};

export function InstantFormRenderer({
  document: doc,
  mode = 'preview',
  selectedBlockId,
  onSelectBlock,
  onMoveBlockUp,
  onMoveBlockDown,
  onDuplicateBlock,
  onDeleteBlock,
  whatsappNumber,
  submitting,
  fieldErrors,
  onSubmit,
}: Props) {
  const fields = useMemo(() => {
    const form = doc.blocks.find((b) => b.type === 'form');
    return ((form?.props.fields as InstantFormField[]) || []).filter((f) => !f.hidden);
  }, [doc.blocks]);

  const [answers, setAnswers] = useState<Record<string, unknown>>(() => {
    const init: Record<string, unknown> = {};
    for (const f of fields) if (f.defaultValue != null) init[f.id] = f.defaultValue;
    return init;
  });
  const [clientErrors, setClientErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    setAnswers((prev) => {
      const next = { ...prev };
      for (const f of fields) {
        if (next[f.id] === undefined && f.defaultValue != null) next[f.id] = f.defaultValue;
      }
      return next;
    });
  }, [fields]);

  const theme = doc.theme;
  const product = doc.product;
  const mergedErrors = { ...clientErrors, ...(fieldErrors || {}) };

  function validateClientAnswers(): Record<string, string> {
    const errors: Record<string, string> = {};
    for (const field of fields) {
      const raw = answers[field.id];
      if (field.type === 'phone' || field.type === 'whatsapp') {
        const digits = normalizeIraqiPhone(raw);
        if (field.required && !digits) {
          errors[field.id] = field.validation?.errorMessage || `${field.label} مطلوب`;
          continue;
        }
        if (digits && !isValidIraqiPhone(digits)) {
          errors[field.id] = field.validation?.errorMessage || IRAQI_PHONE_ERROR;
        }
        continue;
      }
      const value = Array.isArray(raw)
        ? raw.length
          ? '1'
          : ''
        : String(raw ?? '').trim();
      if (field.required && !value) {
        errors[field.id] = field.validation?.errorMessage || `${field.label} مطلوب`;
        continue;
      }
      if (field.type === 'color' && field.withSizes !== false) {
        const sizeOpts =
          field.sizeOptions?.length
            ? field.sizeOptions
            : product?.sizes?.length
              ? product.sizes
              : [];
        if (sizeOpts.length && Array.isArray(raw) && raw.length) {
          const items = parseChoiceQtyValue(raw);
          const missing = items.some(
            (item) =>
              !item.sizes ||
              item.sizes.length < item.qty ||
              item.sizes.slice(0, item.qty).some((s) => !String(s || '').trim()),
          );
          if (missing) {
            errors[field.id] = 'يرجى اختيار القياس لكل قطعة مطلوبة';
          }
        }
      }
    }
    return errors;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (mode !== 'live' || !onSubmit) return;
    const errors = validateClientAnswers();
    if (Object.keys(errors).length) {
      setClientErrors(errors);
      const firstId = Object.keys(errors)[0];
      if (firstId) {
        document.getElementById(`field-${firstId}`)?.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        });
      }
      return;
    }
    setClientErrors({});
    const normalized: Record<string, unknown> = { ...answers };
    for (const field of fields) {
      if (field.type === 'phone' || field.type === 'whatsapp') {
        normalized[field.id] = normalizeIraqiPhone(normalized[field.id]);
      }
    }
    await onSubmit(normalized);
  }

  function renderField(field: InstantFormField) {
    const error = mergedErrors[field.id];
    const common =
      'w-full rounded-xl border bg-white px-3 py-2.5 text-sm outline-none transition focus:ring-2 focus:ring-violet-500/30';
    const border = error ? 'border-red-500' : 'border-slate-200';
    const value = answers[field.id] ?? '';

    const set = (v: unknown) => {
      setAnswers((a) => ({ ...a, [field.id]: v }));
      if (clientErrors[field.id]) {
        setClientErrors((prev) => {
          const next = { ...prev };
          delete next[field.id];
          return next;
        });
      }
    };

    let input: ReactNode;
    switch (field.type) {
      case 'textarea':
      case 'notes':
      case 'address':
        input = (
          <textarea
            className={cn(common, border, 'min-h-24')}
            placeholder={field.placeholder}
            value={String(value)}
            onChange={(e) => set(e.target.value)}
            disabled={mode === 'preview'}
          />
        );
        break;
      case 'select':
      case 'size':
      case 'governorate':
      case 'city': {
        const locationOptions =
          field.type === 'size'
            ? field.options?.length
              ? field.options
              : product?.sizes?.length
                ? product.sizes
                : []
            : resolveLocationOptions(field);
        input = (
          <select
            className={cn(common, border)}
            value={String(value)}
            onChange={(e) => set(e.target.value)}
            disabled={mode === 'preview'}
          >
            <option value="">{field.placeholder || 'اختر...'}</option>
            {locationOptions.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        );
        break;
      }
      case 'color': {
        const colorSizeOptions =
          field.withSizes === false
            ? []
            : field.sizeOptions?.length
              ? field.sizeOptions
              : product?.sizes?.length
                ? product.sizes
                : [];
        input = (
          <ColorSwatchPicker
            field={field}
            choices={resolveColorChoices(field, product?.colors)}
            value={value}
            mode={mode}
            onChange={set}
            withQuantity={field.withQuantity !== false}
            sizeOptions={colorSizeOptions}
            emptyHint="أضف ألوان المنتج من إعدادات الحقل"
          />
        );
        break;
      }
      case 'multiselect':
      case 'checkbox': {
        const choices = resolveColorChoices(field);
        if (choices.length || field.type === 'multiselect') {
          input = (
            <ColorSwatchPicker
              field={{ ...field, allowMultiple: field.allowMultiple !== false }}
              choices={choices}
              value={value}
              mode={mode}
              onChange={set}
              withQuantity={field.type === 'multiselect' && field.withQuantity !== false}
              emptyHint="أضف اختيارات (اسم أو صورة) من إعدادات الحقل"
            />
          );
        } else {
          input = (
            <div className="space-y-2">
              {(field.options || ['خيار 1', 'خيار 2']).map((o) => {
                const arr = Array.isArray(value) ? (value as string[]) : [];
                return (
                  <label key={o} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={arr.includes(o)}
                      onChange={(e) => {
                        set(e.target.checked ? [...arr, o] : arr.filter((x) => x !== o));
                      }}
                      disabled={mode === 'preview'}
                    />
                    {o}
                  </label>
                );
              })}
            </div>
          );
        }
        break;
      }
      case 'radio':
        input = (
          <div className="space-y-2">
            {(field.options || ['خيار 1', 'خيار 2']).map((o) => (
              <label key={o} className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name={field.id}
                  checked={value === o}
                  onChange={() => set(o)}
                  disabled={mode === 'preview'}
                />
                {o}
              </label>
            ))}
          </div>
        );
        break;
      case 'date':
      case 'time':
        input = (
          <input
            type={field.type}
            className={cn(common, border)}
            value={String(value)}
            onChange={(e) => set(e.target.value)}
            disabled={mode === 'preview'}
          />
        );
        break;
      case 'quantity':
        input = (
          <input
            type="number"
            min={1}
            className={cn(common, border)}
            value={String(value || 1)}
            onChange={(e) => set(e.target.value)}
            disabled={mode === 'preview'}
          />
        );
        break;
      case 'phone':
      case 'whatsapp': {
        const digits = normalizeIraqiPhone(value);
        const phoneInvalid = digits.length > 0 && !isValidIraqiPhone(digits);
        input = (
          <div className="space-y-1">
            <input
              type="tel"
              inputMode="numeric"
              autoComplete="tel"
              maxLength={11}
              pattern="07[0-9]{9}"
              className={cn(common, phoneInvalid || error ? 'border-red-500' : border)}
              placeholder={field.placeholder || '07xxxxxxxxx'}
              value={digits}
              onChange={(e) => set(normalizeIraqiPhone(e.target.value))}
              onBlur={() => {
                if (!digits && !field.required) return;
                if (!isValidIraqiPhone(digits)) {
                  setClientErrors((prev) => ({
                    ...prev,
                    [field.id]: field.validation?.errorMessage || IRAQI_PHONE_ERROR,
                  }));
                }
              }}
              disabled={mode === 'preview'}
            />
            <p className="text-[11px] text-slate-400">يجب إدخال 11 رقماً يبدأ بـ 07</p>
          </div>
        );
        break;
      }
      default:
        input = (
          <input
            type={field.type === 'email' ? 'email' : 'text'}
            className={cn(common, border)}
            placeholder={field.placeholder}
            value={String(value)}
            onChange={(e) => set(e.target.value)}
            disabled={mode === 'preview'}
          />
        );
    }

    return (
      <div key={field.id} id={`field-${field.id}`} className="space-y-1.5">
        <label className="text-sm font-medium text-slate-800">
          {field.label}
          {field.required ? <span className="ms-1 text-red-500">*</span> : null}
        </label>
        {input}
        {error ? <p className="text-xs text-red-600">{error}</p> : null}
      </div>
    );
  }

  function renderBlock(block: InstantFormBlock) {
    const p = block.props;
    const selected = selectedBlockId === block.id;
    const showSectionToolbar =
      selected &&
      mode === 'preview' &&
      Boolean(onMoveBlockUp || onMoveBlockDown || onDuplicateBlock || onDeleteBlock);
    const wrap = (child: ReactNode) => (
      <div
        key={block.id}
        role={onSelectBlock ? 'button' : undefined}
        tabIndex={onSelectBlock ? 0 : undefined}
        onClick={(e) => {
          if (!onSelectBlock) return;
          e.stopPropagation();
          onSelectBlock(block.id);
        }}
        className={cn(
          'relative',
          onSelectBlock && 'cursor-pointer rounded-xl',
          selected && 'ring-2 ring-violet-500 ring-offset-2',
        )}
        style={styleToCss(block.style)}
      >
        {showSectionToolbar ? (
          <div
            className="absolute -top-3 start-2 z-20 flex items-center gap-1 rounded-full border border-violet-200 bg-white px-1.5 py-1 shadow-md"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              title="أعلى"
              className="rounded-full px-2 py-0.5 text-[11px] font-medium text-slate-700 hover:bg-slate-100"
              onClick={() => onMoveBlockUp?.(block.id)}
            >
              أعلى
            </button>
            <button
              type="button"
              title="أسفل"
              className="rounded-full px-2 py-0.5 text-[11px] font-medium text-slate-700 hover:bg-slate-100"
              onClick={() => onMoveBlockDown?.(block.id)}
            >
              أسفل
            </button>
            <button
              type="button"
              title="تكرار"
              className="rounded-full px-2 py-0.5 text-[11px] font-medium text-violet-700 hover:bg-violet-50"
              onClick={() => onDuplicateBlock?.(block.id)}
            >
              تكرار
            </button>
            <button
              type="button"
              title="حذف"
              className="rounded-full px-2 py-0.5 text-[11px] font-medium text-red-600 hover:bg-red-50"
              onClick={() => onDeleteBlock?.(block.id)}
            >
              حذف
            </button>
          </div>
        ) : null}
        {child}
      </div>
    );

    switch (block.type) {
      case 'hero':
        return wrap(
          <div className="space-y-2">
            {p.badge ? (
              <span className="inline-block rounded-full bg-white/20 px-3 py-1 text-xs font-semibold">
                {String(p.badge)}
              </span>
            ) : null}
            <h1 className="text-2xl font-bold leading-tight">{String(p.title || '')}</h1>
            <p className="text-sm opacity-90">{String(p.subtitle || '')}</p>
          </div>,
        );
      case 'header':
        return wrap(<div className="py-3 text-center text-lg font-bold">{String(p.title || 'Chatloora')}</div>);
      case 'footer':
        return wrap(
          <div className="border-t border-slate-200 py-4 text-center text-xs text-slate-500">
            {String(p.text || '')}
          </div>,
        );
      case 'heading':
        return wrap(<h2 className="text-xl font-bold text-slate-900">{String(p.text || '')}</h2>);
      case 'subheading':
        return wrap(<h3 className="text-lg font-semibold text-slate-800">{String(p.text || '')}</h3>);
      case 'paragraph':
        return wrap(<p className="text-sm leading-7 text-slate-600">{String(p.text || '')}</p>);
      case 'badge':
        return wrap(
          <span className="inline-flex rounded-full bg-violet-100 px-3 py-1 text-xs font-semibold text-violet-700">
            {String(p.text || '')}
          </span>,
        );
      case 'divider':
        return wrap(<hr className="border-slate-200" />);
      case 'spacer':
        return wrap(<div style={{ height: Number(p.height) || 24 }} />);
      case 'image':
        return wrap(
          <div
            className="flex w-full"
            style={{
              justifyContent:
                String(p.align || 'center') === 'end'
                  ? 'flex-end'
                  : String(p.align || 'center') === 'start'
                    ? 'flex-start'
                    : 'center',
            }}
          >
            {p.src ? (
              <div style={imageFrameStyle(p)}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={String(p.src)}
                  alt={String(p.alt || '')}
                  style={{
                    ...imageMediaStyle(p),
                    height: p.height && String(p.height) !== 'auto' ? '100%' : 'auto',
                  }}
                  loading="lazy"
                />
              </div>
            ) : (
              <div
                className="flex items-center justify-center bg-slate-100 text-sm text-slate-400"
                style={{
                  ...imageFrameStyle(p),
                  height: String(p.height || '160px'),
                  minHeight: '120px',
                }}
              >
                صورة
              </div>
            )}
          </div>,
        );
      case 'gallery':
      case 'carousel': {
        const images = (p.images as string[]) || [];
        const cols = Math.min(4, Math.max(1, Number(p.columns) || 2));
        const cellHeight = String(p.imageHeight || '140px');
        const radius = String(p.borderRadius || '12px');
        const fit = (String(p.objectFit || 'cover') as CSSProperties['objectFit']) || 'cover';
        return wrap(
          <div
            className="grid gap-2"
            style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
          >
            {images.length
              ? images.map((src) => (
                  <div
                    key={src}
                    className="overflow-hidden bg-slate-100"
                    style={{ height: cellHeight, borderRadius: radius }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={src}
                      alt=""
                      className="h-full w-full"
                      style={{ objectFit: fit }}
                      loading="lazy"
                    />
                  </div>
                ))
              : [1, 2].map((i) => (
                  <div
                    key={i}
                    className="flex items-center justify-center bg-slate-100 text-xs text-slate-400"
                    style={{ height: cellHeight, borderRadius: radius }}
                  >
                    صورة {i}
                  </div>
                ))}
          </div>,
        );
      }
      case 'before_after':
        return wrap(
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <div className="text-xs font-medium text-slate-500">{String(p.labelBefore || 'قبل')}</div>
              <div
                className="overflow-hidden bg-slate-100"
                style={{
                  height: String(p.imageHeight || '140px'),
                  borderRadius: String(p.borderRadius || '12px'),
                }}
              >
                {p.before ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={String(p.before)}
                    alt="قبل"
                    className="h-full w-full"
                    style={{
                      objectFit:
                        (String(p.objectFit || 'cover') as CSSProperties['objectFit']) || 'cover',
                    }}
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-xs text-slate-400">قبل</div>
                )}
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-xs font-medium text-slate-500">{String(p.labelAfter || 'بعد')}</div>
              <div
                className="overflow-hidden bg-emerald-50"
                style={{
                  height: String(p.imageHeight || '140px'),
                  borderRadius: String(p.borderRadius || '12px'),
                }}
              >
                {p.after ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={String(p.after)}
                    alt="بعد"
                    className="h-full w-full"
                    style={{
                      objectFit:
                        (String(p.objectFit || 'cover') as CSSProperties['objectFit']) || 'cover',
                    }}
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-xs text-emerald-600">بعد</div>
                )}
              </div>
            </div>
          </div>,
        );
      case 'video':
      case 'youtube_video':
      case 'tiktok_video':
        return wrap(
          p.url ? (
            <div className="aspect-video overflow-hidden rounded-2xl bg-black">
              <iframe
                src={String(p.url)}
                className="h-full w-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                title={block.type}
              />
            </div>
          ) : (
            <div className="flex aspect-video items-center justify-center rounded-2xl bg-slate-900 text-sm text-white/70">
              فيديو
            </div>
          ),
        );
      case 'banner':
        return wrap(
          <div className="rounded-2xl bg-gradient-to-l from-violet-600 to-indigo-600 px-4 py-5 text-center text-white">
            {String(p.text || 'عرض خاص')}
          </div>,
        );
      case 'icons':
        return wrap(
          <div className="flex flex-wrap justify-center gap-3">
            {((p.items as string[]) || []).map((item) => (
              <div key={item} className="rounded-xl bg-white px-3 py-2 text-sm shadow-sm ring-1 ring-slate-100">
                {item}
              </div>
            ))}
          </div>,
        );
      case 'features':
        return wrap(
          <div className="space-y-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
            {p.title ? <h3 className="font-semibold text-slate-900">{String(p.title)}</h3> : null}
            <ul className="space-y-2">
              {((p.items as string[]) || []).map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm text-slate-700">
                  <span className="mt-0.5 text-emerald-500">✓</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>,
        );
      case 'product_card':
        return wrap(
          <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-100">
            <div
              className="flex items-center justify-center bg-gradient-to-br from-violet-100 to-indigo-50 text-violet-400"
              style={{
                width: product?.imageWidth || '100%',
                height: product?.imageHeight || '160px',
                borderRadius: product?.imageBorderRadius || undefined,
                overflow: 'hidden',
                marginInline: 'auto',
              }}
            >
              {product?.images?.[0] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={product.images[0]}
                  alt=""
                  className="h-full w-full"
                  style={{
                    objectFit: product.imageObjectFit || 'cover',
                  }}
                />
              ) : (
                'منتج'
              )}
            </div>
            <div className="space-y-2 p-4">
              {product?.badge ? (
                <span className="inline-block rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                  {product.badge}
                </span>
              ) : null}
              <h3 className="text-lg font-bold text-slate-900">{product?.name || 'المنتج'}</h3>
              {product?.description ? <p className="text-sm text-slate-600">{product.description}</p> : null}
              <div className="flex items-end gap-2">
                {product?.price != null ? (
                  <span className="text-xl font-bold text-violet-700">
                    {product.price.toLocaleString()} {product.currency || 'IQD'}
                  </span>
                ) : null}
                {product?.compareAtPrice != null ? (
                  <span className="text-sm text-slate-400 line-through">
                    {product.compareAtPrice.toLocaleString()}
                  </span>
                ) : null}
              </div>
              {product?.rating != null ? (
                <p className="text-xs text-slate-500">
                  ★ {product.rating} · {product.salesCount ?? 0} مبيعة
                </p>
              ) : null}
            </div>
          </div>,
        );
      case 'comparison_table': {
        const headers = (p.headers as string[]) || [];
        const rows = (p.rows as string[][]) || [];
        return wrap(
          <div className="overflow-x-auto rounded-2xl bg-white ring-1 ring-slate-100">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50">
                  {headers.map((h) => (
                    <th key={h} className="px-3 py-2 text-start font-semibold">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={i} className="border-t border-slate-100">
                    {row.map((cell, j) => (
                      <td key={j} className="px-3 py-2">
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>,
        );
      }
      case 'guarantee':
        return wrap(
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-center">
            <div className="font-semibold text-emerald-800">{String(p.title || 'ضمان')}</div>
            <p className="mt-1 text-sm text-emerald-700">{String(p.text || '')}</p>
          </div>,
        );
      case 'order_counter':
      case 'viewer_counter':
        return wrap(
          <div className="rounded-2xl bg-slate-900 px-4 py-3 text-center text-white">
            <div className="text-2xl font-bold">{String(p.value ?? 0)}</div>
            <div className="text-xs opacity-80">{String(p.label || '')}</div>
          </div>,
        );
      case 'countdown':
      case 'offer_countdown':
        return wrap(
          <div className="space-y-3 rounded-2xl bg-white p-4 text-center shadow-sm ring-1 ring-slate-100">
            <div className="text-sm font-semibold text-slate-800">{String(p.title || '')}</div>
            <Countdown endsAt={p.endsAt as string | undefined} />
          </div>,
        );
      case 'testimonials':
      case 'reviews':
        if (block.type === 'reviews') {
          return wrap(
            <div className="rounded-2xl bg-white p-4 text-center shadow-sm ring-1 ring-slate-100">
              <div className="text-3xl font-bold text-amber-500">★ {String(p.rating ?? 5)}</div>
              <div className="text-sm text-slate-600">
                {String(p.label || 'تقييم')} · {String(p.count ?? 0)} تقييم
              </div>
            </div>,
          );
        }
        return wrap(
          <div className="space-y-3">
            {((p.items as Array<{ name: string; text: string; rating?: number }>) || []).map((item, i) => (
              <div key={i} className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
                <div className="mb-1 text-amber-500">{'★'.repeat(item.rating ?? 5)}</div>
                <p className="text-sm text-slate-700">{item.text}</p>
                <div className="mt-2 text-xs font-semibold text-slate-500">{item.name}</div>
              </div>
            ))}
          </div>,
        );
      case 'faq':
      case 'accordion':
        return wrap(
          <div className="space-y-2">
            {((p.items as Array<{ q: string; a: string }>) || []).map((item, i) => (
              <details key={i} className="rounded-xl bg-white p-3 shadow-sm ring-1 ring-slate-100">
                <summary className="cursor-pointer text-sm font-semibold text-slate-800">{item.q}</summary>
                <p className="mt-2 text-sm text-slate-600">{item.a}</p>
              </details>
            ))}
          </div>,
        );
      case 'tabs':
        return wrap(
          <div className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-100">
            {((p.tabs as Array<{ label: string; content: string }>) || []).map((tab, i) => (
              <div key={i} className="border-b border-slate-100 py-2 last:border-0">
                <div className="text-sm font-semibold">{tab.label}</div>
                <p className="text-sm text-slate-600">{tab.content}</p>
              </div>
            ))}
          </div>,
        );
      case 'google_maps':
      case 'location':
        return wrap(
          <div className="space-y-2 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
            <div className="text-sm font-semibold text-slate-800">{String(p.address || 'الموقع')}</div>
            {p.embedUrl ? (
              <iframe src={String(p.embedUrl)} className="h-40 w-full rounded-xl" title="map" loading="lazy" />
            ) : (
              <div className="flex h-32 items-center justify-center rounded-xl bg-slate-100 text-xs text-slate-400">
                خريطة Google
              </div>
            )}
          </div>,
        );
      case 'button':
        return wrap(
          <a
            href={mode === 'live' ? String(p.href || '#') : undefined}
            className="block rounded-2xl bg-violet-600 px-4 py-3 text-center text-sm font-semibold text-white shadow-md shadow-violet-500/30"
          >
            {String(p.label || 'زر')}
          </a>,
        );
      case 'whatsapp_button': {
        const phone = (whatsappNumber || '').replace(/\D/g, '');
        const msg = encodeURIComponent(String(p.message || ''));
        const href = phone ? `https://wa.me/${phone}?text=${msg}` : '#';
        return wrap(
          <a
            href={mode === 'live' ? href : undefined}
            className="block rounded-2xl bg-[#25D366] px-4 py-3 text-center text-sm font-semibold text-white"
          >
            {String(p.label || 'واتساب')}
          </a>,
        );
      }
      case 'multi_choice': {
        const choices = (Array.isArray(p.choices) ? p.choices : []) as InstantFormColorChoice[];
        const error = fieldErrors?.[block.id];
        const synthetic: InstantFormField = {
          id: block.id,
          type: 'multiselect',
          label: String(p.title || 'اختر ما يناسبك'),
          required: Boolean(p.required),
          allowMultiple: p.allowMultiple !== false,
          withQuantity: p.showQuantity !== false,
          choices,
          options: choices.map((c) => c.label),
        };
        return wrap(
          <div
            id={`field-${block.id}`}
            className="space-y-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100"
          >
            <div className="text-sm font-semibold text-slate-800">
              {synthetic.label}
              {synthetic.required ? <span className="ms-1 text-red-500">*</span> : null}
            </div>
            <ColorSwatchPicker
              field={synthetic}
              choices={choices}
              value={answers[block.id] ?? []}
              mode={mode}
              withQuantity={p.showQuantity !== false}
              onChange={(v) => setAnswers((a) => ({ ...a, [block.id]: v }))}
              emptyHint="أضف اختيارات من إعدادات القسم"
            />
            {error ? <p className="text-xs text-red-600">{error}</p> : null}
          </div>,
        );
      }
      case 'form':
        return wrap(
          <form
            id="form"
            onSubmit={handleSubmit}
            className="space-y-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100"
          >
            {p.title ? <h3 className="text-lg font-bold text-slate-900">{String(p.title)}</h3> : null}
            {((p.fields as InstantFormField[]) || []).filter((f) => !f.hidden).map(renderField)}
            <button
              type="submit"
              disabled={mode === 'preview' || submitting}
              className="w-full rounded-2xl bg-violet-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-violet-500/30 disabled:opacity-60"
              style={{ backgroundColor: theme.primaryColor }}
            >
              {submitting ? 'جاري الإرسال…' : String(p.submitLabel || 'إكمال الحجز')}
            </button>
          </form>,
        );
      default:
        return wrap(
          <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-500">عنصر: {block.type}</div>,
        );
    }
  }

  return (
    <div
      dir={theme.direction || 'rtl'}
      className="min-h-full"
      style={{
        backgroundColor: theme.pageBackground,
        backgroundImage: theme.pageBackgroundImage ? `url(${theme.pageBackgroundImage})` : undefined,
        backgroundSize: 'cover',
        color: theme.textColor,
        fontFamily: theme.fontFamily,
      }}
    >
      <div className="mx-auto space-y-4 px-4 py-6" style={{ maxWidth: theme.maxWidth || '480px' }}>
        {doc.blocks.map(renderBlock)}
      </div>
    </div>
  );
}
