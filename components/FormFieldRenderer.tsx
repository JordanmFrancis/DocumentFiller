'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { PDFField, FormValues } from '@/types/pdf';
import FieldInput from './FieldInput';
import FieldLabelEditor from './FieldLabelEditor';
import { Eye } from 'lucide-react';

interface FormFieldRendererProps {
  fields: PDFField[];
  values: FormValues;
  onChange: (fieldName: string, value: any) => void;
  onLabelChange?: (fieldName: string, newLabel: string) => void;
  onFieldClick?: (fieldName: string) => void;
  errors?: Record<string, string>;
  editableLabels?: boolean;
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

export default function FormFieldRenderer({
  fields,
  values,
  onChange,
  onLabelChange,
  onFieldClick,
  errors,
  editableLabels = true,
}: FormFieldRendererProps) {
  const sortedFields = useMemo(() => sortFieldsByDocumentOrder(fields), [fields]);

  if (sortedFields.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="font-cursive text-xl text-ink-soft">
          no form fields detected in this PDF
        </p>
        <p className="font-marker text-sm text-ink-faint mt-2">
          try the field creator instead
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {sortedFields.map((field, index) => (
        <motion.div
          key={field.name}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.03 }}
          className="group"
        >
          <div className="mb-1.5 flex items-center gap-2">
            {editableLabels && onLabelChange ? (
              <FieldLabelEditor field={field} onLabelChange={onLabelChange} />
            ) : (
              <label className="font-marker text-base text-ink flex-1">
                {field.label || field.name}
              </label>
            )}
            {field.required && (
              <span className="font-marker text-margin-red text-base" title="Required">
                *
              </span>
            )}
            {onFieldClick && field.position && (
              <button
                onClick={() => onFieldClick(field.name)}
                className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-accent-yellow/40 rounded border-[1.5px] border-transparent hover:border-ink"
                title="Show field in PDF"
              >
                <Eye className="w-3.5 h-3.5 text-ink" />
              </button>
            )}
          </div>
          <FieldInput
            field={field}
            value={values[field.name]}
            onChange={(value) => onChange(field.name, value)}
            error={errors?.[field.name]}
          />
        </motion.div>
      ))}
    </div>
  );
}
