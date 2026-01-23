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

// Sort fields by document order: page, then top-to-bottom, then left-to-right
const sortFieldsByDocumentOrder = (fields: PDFField[]): PDFField[] => {
  return [...fields].sort((a, b) => {
    // First, sort by page number
    const pageA = a.position?.page ?? a.page ?? 0;
    const pageB = b.position?.page ?? b.page ?? 0;
    if (pageA !== pageB) return pageA - pageB;
    
    // Then, sort by Y position (top to bottom)
    // Y is already in top-left origin, so smaller Y = higher on page
    const yA = a.position?.y ?? 0;
    const yB = b.position?.y ?? 0;
    if (Math.abs(yA - yB) > 10) return yA - yB; // Threshold to group fields on same "row"
    
    // Finally, sort by X position (left to right)
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
  // Sort fields by document order
  const sortedFields = useMemo(() => sortFieldsByDocumentOrder(fields), [fields]);

  if (sortedFields.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-400">No form fields detected in this PDF</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {sortedFields.map((field, index) => (
        <motion.div
          key={field.name}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.05 }}
          className="group"
        >
          {editableLabels && onLabelChange ? (
            <div className="mb-2 flex items-center gap-2">
              <FieldLabelEditor
                field={field}
                onLabelChange={onLabelChange}
              />
              {field.required && <span className="text-red-400 text-sm">*</span>}
              {onFieldClick && field.position && (
                <button
                  onClick={() => onFieldClick(field.name)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity ml-2 p-1.5 hover:bg-gray-700 rounded text-gray-400 hover:text-white"
                  title="Show field in PDF"
                >
                  <Eye className="w-4 h-4" />
                </button>
              )}
            </div>
          ) : (
            <div className="mb-2 flex items-center gap-2">
              <label className="block text-sm font-medium text-gray-300 flex-1">
                {field.label || field.name}
                {field.required && <span className="text-red-400 ml-1">*</span>}
              </label>
              {onFieldClick && field.position && (
                <button
                  onClick={() => onFieldClick(field.name)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 hover:bg-gray-700 rounded text-gray-400 hover:text-white"
                  title="Show field in PDF"
                >
                  <Eye className="w-4 h-4" />
                </button>
              )}
            </div>
          )}
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
