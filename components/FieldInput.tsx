'use client';

import { motion } from 'framer-motion';
import { PDFField } from '@/types/pdf';

interface FieldInputProps {
  field: PDFField;
  value: any;
  onChange: (value: any) => void;
  error?: string;
}

export default function FieldInput({ field, value, onChange, error }: FieldInputProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const newValue = field.type === 'checkbox'
      ? (e.target as HTMLInputElement).checked
      : e.target.value;
    onChange(newValue);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-1.5"
    >
      {field.type === 'text' && (
        <input
          type="text"
          value={value || (field.defaultValue as string) || ''}
          onChange={handleChange}
          aria-invalid={!!error}
          className="input"
          placeholder={`Enter ${(field.label || field.name).toLowerCase()}`}
        />
      )}

      {field.type === 'date' && (
        <input
          type="date"
          value={value || (field.defaultValue as string) || ''}
          onChange={handleChange}
          aria-invalid={!!error}
          className="input"
        />
      )}

      {field.type === 'number' && (
        <input
          type="number"
          value={value ?? (field.defaultValue as number) ?? ''}
          onChange={handleChange}
          aria-invalid={!!error}
          className="input"
          placeholder="Enter a number"
        />
      )}

      {field.type === 'checkbox' && (
        <label className="flex items-center gap-2.5 cursor-pointer group select-none">
          <input
            type="checkbox"
            checked={!!(value ?? field.defaultValue ?? false)}
            onChange={handleChange}
            className="checkbox"
          />
          <span className="text-[14px] text-ink-soft group-hover:text-ink transition-colors">
            {value || field.defaultValue ? 'Checked' : 'Click to check'}
          </span>
        </label>
      )}

      {(field.type === 'radio' || field.type === 'dropdown') && field.options && (
        <select
          value={value || (field.defaultValue as string) || ''}
          onChange={handleChange}
          aria-invalid={!!error}
          className="input cursor-pointer"
        >
          <option value="">— Select —</option>
          {field.options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      )}

      {error && (
        <motion.p
          initial={{ opacity: 0, x: -4 }}
          animate={{ opacity: 1, x: 0 }}
          className="text-[12.5px] text-danger"
        >
          {error}
        </motion.p>
      )}
    </motion.div>
  );
}
