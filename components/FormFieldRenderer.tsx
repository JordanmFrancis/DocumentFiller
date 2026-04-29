'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { PDFField, FormValues } from '@/types/pdf';
import type { Rule } from '@/types/rule';
import FieldInput from './FieldInput';
import FieldLabelEditor from './FieldLabelEditor';
import { Eye, Check, Pin, RotateCcw, Sparkles } from 'lucide-react';

interface FormFieldRendererProps {
  fields: PDFField[];
  values: FormValues;
  onChange: (fieldName: string, value: any) => void;
  onLabelChange?: (fieldName: string, newLabel: string) => void;
  // Fired when a field row gains attention — input focus or eye-icon click.
  // The PDFPreview pane uses this to jump pages and highlight the box.
  onFieldFocus?: (fieldName: string) => void;
  // The currently-active field (drives the row highlight in this list).
  activeFieldName?: string | null;
  errors?: Record<string, string>;
  editableLabels?: boolean;
  untouchedDefaults?: Set<string>;
  defaultValues?: Record<string, string | boolean | number>;
  onPin?: (fieldName: string) => void;
  onUnpin?: (fieldName: string) => void;
  onUpdateDefault?: (fieldName: string) => void;
  ruleTouched?: Map<string, string>;
  rulesIndex?: Map<string, Rule>;
  onClearRuleTouched?: (fieldName: string) => void;
}

const sortFieldsByDocumentOrder = (fields: PDFField[]): PDFField[] => {
  return [...fields].sort((a, b) => {
    const pageA = a.position?.page ?? a.page ?? 0;
    const pageB = b.position?.page ?? b.page ?? 0;
    if (pageA !== pageB) return pageA - pageB;
    const yA = a.position?.y ?? 0;
    const yB = b.position?.y ?? 0;
    if (Math.abs(yA - yB) > 10) return yA - yB;
    const xA = a.position?.x ?? 0;
    const xB = b.position?.x ?? 0;
    return xA - xB;
  });
};

// Group fields into rough "sections" by position gaps. The wireframe shows
// e.g. TAXPAYER + ADDRESS as section headings — we infer them by looking
// for vertical gaps between sorted fields.
function groupIntoSections(sorted: PDFField[]): { title?: string; fields: PDFField[] }[] {
  if (sorted.length === 0) return [];
  const sections: { title?: string; fields: PDFField[] }[] = [{ fields: [] }];
  let lastY: number | null = null;
  let lastPage: number | null = null;
  for (const f of sorted) {
    const y = f.position?.y ?? 0;
    const page = f.position?.page ?? f.page ?? 0;
    const gap = lastY === null ? 0 : Math.abs(y - lastY);
    const pageBreak = lastPage !== null && lastPage !== page;
    // 110pt gap or page break starts a new section
    if (sections[sections.length - 1].fields.length > 0 && (gap > 110 || pageBreak)) {
      sections.push({ fields: [] });
    }
    sections[sections.length - 1].fields.push(f);
    lastY = y;
    lastPage = page;
  }
  return sections;
}

function isPinnableValue(field: PDFField, value: any): boolean {
  if (field.type === 'checkbox') return value === true;
  if (value === undefined || value === null) return false;
  if (typeof value === 'string' && value.trim() === '') return false;
  return true;
}

function formatDefaultPreview(field: PDFField, value: any): string {
  if (field.type === 'checkbox') return value ? 'checked' : 'unchecked';
  const str = String(value ?? '');
  const trimmed = str.length > 30 ? `${str.slice(0, 30)}…` : str;
  return `"${trimmed}"`;
}

export default function FormFieldRenderer({
  fields,
  values,
  onChange,
  onLabelChange,
  onFieldFocus,
  activeFieldName,
  errors,
  editableLabels = true,
  untouchedDefaults,
  defaultValues,
  onPin,
  onUnpin,
  onUpdateDefault,
  ruleTouched,
  rulesIndex,
  onClearRuleTouched,
}: FormFieldRendererProps) {
  const sortedFields = useMemo(() => sortFieldsByDocumentOrder(fields), [fields]);
  const sections = useMemo(() => groupIntoSections(sortedFields), [sortedFields]);

  if (sortedFields.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-ink-soft text-[14px]">No form fields detected in this PDF.</p>
        <p className="text-ink-faint text-[12.5px] mt-1.5">Try the field creator instead.</p>
      </div>
    );
  }

  return (
    <div className="space-y-7">
      {sections.map((section, sectionIdx) => (
        <div key={sectionIdx}>
          {sections.length > 1 && (
            <div className="eyebrow mb-3">
              {section.title || `Section ${sectionIdx + 1}`}
            </div>
          )}
          <div className="space-y-4">
            {section.fields.map((field, index) => {
              const isActive = activeFieldName === field.name;
              const value = values[field.name];
              // A field is "filled" if user has entered a non-empty value.
              // Checkboxes count as filled when checked (true).
              const isFilled =
                value !== undefined && value !== null && value !== '' && value !== false;
              return (
                <div
                  key={field.name}
                  className={`co-enter form-row group transition-colors ${
                    isActive
                      ? '-mx-3 px-3 py-2 bg-accent-tint/60 ring-1 ring-accent-line'
                      : '-mx-3 px-3 py-2'
                  }`}
                  data-field-row={field.name}
                  data-active={isActive}
                  style={{ animationDelay: `${index * 0.03}s` }}
                >
                  <div className="mb-1.5 flex items-center gap-2">
                    {editableLabels && onLabelChange ? (
                      <FieldLabelEditor field={field} onLabelChange={onLabelChange} />
                    ) : (
                      <label className="field-label !mb-0 !text-ink flex-1">
                        {field.label || field.name}
                      </label>
                    )}
                    {/* Completion tick — strokes itself in via co-check-draw the
                        moment isFilled becomes true (key tied to fill state so
                        the path remounts and re-animates each transition). */}
                    {isFilled && (
                      <Check
                        key={`check-${field.name}-${isFilled}`}
                        className="co-field-check"
                        strokeWidth={2.6}
                      />
                    )}
                    {field.required && !isFilled && (
                      <span className="text-danger text-[13px]" title="Required">*</span>
                    )}
                    {ruleTouched?.has(field.name) && (() => {
                      const ruleId = ruleTouched.get(field.name);
                      const rule = ruleId ? rulesIndex?.get(ruleId) : undefined;
                      const ruleSummaryText = rule
                        ? `Filled by rule: ${rule.name || ruleId?.slice(0, 6)}`
                        : 'Filled by a rule';
                      return (
                        <button
                          type="button"
                          onClick={() => onClearRuleTouched?.(field.name)}
                          className="p-1 rounded text-accent hover:bg-accent-tint"
                          title={`${ruleSummaryText} — click to override manually`}
                          aria-label="Override rule-filled value"
                        >
                          <Sparkles className="w-3.5 h-3.5" strokeWidth={1.8} />
                        </button>
                      );
                    })()}
                    {(onPin || onUnpin) && (() => {
                      const hasDefault = defaultValues?.[field.name] !== undefined;
                      const fieldValue = values[field.name];
                      const canPinNow = isPinnableValue(field, fieldValue);
                      const disabled = !hasDefault && !canPinNow;
                      let title: string;
                      if (hasDefault) {
                        title = 'Remove saved default';
                      } else if (!canPinNow) {
                        title = 'Type a value to pin as default';
                      } else {
                        title = 'Pin this value as the default';
                      }
                      return (
                        <button
                          type="button"
                          onClick={() => {
                            if (disabled) return;
                            if (hasDefault) onUnpin?.(field.name);
                            else onPin?.(field.name);
                          }}
                          disabled={disabled}
                          className={`p-1 rounded transition-all ${
                            hasDefault
                              ? 'text-accent hover:bg-accent-tint'
                              : disabled
                              ? 'text-ink-faint opacity-50 cursor-not-allowed'
                              : 'text-ink-faint hover:text-ink hover:bg-paper-edge'
                          }`}
                          title={title}
                          aria-label={title}
                        >
                          <Pin
                            className="w-3.5 h-3.5"
                            fill={hasDefault ? 'currentColor' : 'none'}
                            strokeWidth={1.8}
                          />
                        </button>
                      );
                    })()}
                    {onFieldFocus && field.position && (
                      <button
                        onClick={() => onFieldFocus(field.name)}
                        className={`p-1 rounded transition-all ${
                          isActive
                            ? 'opacity-100 text-accent bg-accent-tint'
                            : 'opacity-0 group-hover:opacity-100 text-ink-faint hover:text-ink hover:bg-paper-edge'
                        }`}
                        title="Show field in PDF"
                      >
                        <Eye className="co-ico co-ico-pop w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  <FieldInput
                    field={field}
                    value={values[field.name]}
                    onChange={(value) => onChange(field.name, value)}
                    onFocus={onFieldFocus ? () => onFieldFocus(field.name) : undefined}
                    error={errors?.[field.name]}
                    isPristineDefault={untouchedDefaults?.has(field.name) ?? false}
                  />
                  {onUpdateDefault && defaultValues && (() => {
                    const stored = defaultValues[field.name];
                    const current = values[field.name];
                    if (stored === undefined) return null;
                    // Prompt only when current is non-empty and differs from stored.
                    if (current === undefined || current === null || current === '') return null;
                    if (current === stored) return null;
                    return (
                      <button
                        type="button"
                        onClick={() => onUpdateDefault(field.name)}
                        className="mt-1.5 inline-flex items-center gap-1 text-[12px] text-accent hover:underline"
                      >
                        <RotateCcw className="w-3 h-3" />
                        Update default to {formatDefaultPreview(field, current)}
                      </button>
                    );
                  })()}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
