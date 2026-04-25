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
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-2"
    >
      {field.type === 'text' && (
        <input
          type="text"
          value={value || (field.defaultValue as string) || ''}
          onChange={handleChange}
          className="input-rough"
          placeholder={`write your ${(field.label || field.name).toLowerCase()}…`}
        />
      )}

      {field.type === 'date' && (
        <input
          type="date"
          value={value || (field.defaultValue as string) || ''}
          onChange={handleChange}
          className="input-rough"
        />
      )}

      {field.type === 'number' && (
        <input
          type="number"
          value={value ?? (field.defaultValue as number) ?? ''}
          onChange={handleChange}
          className="input-rough"
          placeholder={`enter a number…`}
        />
      )}

      {field.type === 'checkbox' && (
        <label className="flex items-center gap-3 cursor-pointer group">
          <input
            type="checkbox"
            checked={!!(value ?? field.defaultValue ?? false)}
            onChange={handleChange}
            className="checkbox-hand"
          />
          <span className="font-cursive text-lg text-ink-soft group-hover:text-ink transition-colors">
            {value || field.defaultValue ? 'yes — checked' : 'tick to enable'}
          </span>
        </label>
      )}

      {(field.type === 'radio' || field.type === 'dropdown') && field.options && (
        <select
          value={value || (field.defaultValue as string) || ''}
          onChange={handleChange}
          className="input-rough cursor-pointer"
        >
          <option value="">— pick one —</option>
          {field.options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      )}

      {error && (
        <motion.p
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          className="font-cursive text-base text-accent-coral pl-1 italic"
        >
          ⚠ {error}
        </motion.p>
      )}
    </motion.div>
  );
}
