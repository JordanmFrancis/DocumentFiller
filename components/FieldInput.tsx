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
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-2"
    >

      {field.type === 'text' && (
        <motion.input
          whileFocus={{ scale: 1.01 }}
          type="text"
          value={value || field.defaultValue || ''}
          onChange={handleChange}
          className="w-full px-4 py-3 bg-gray-700/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
          placeholder={`Enter ${field.name.toLowerCase()}`}
        />
      )}

      {field.type === 'date' && (
        <motion.input
          whileFocus={{ scale: 1.01 }}
          type="date"
          value={value || field.defaultValue || ''}
          onChange={handleChange}
          className="w-full px-4 py-3 bg-gray-700/50 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
        />
      )}

      {field.type === 'number' && (
        <motion.input
          whileFocus={{ scale: 1.01 }}
          type="number"
          value={value || field.defaultValue || ''}
          onChange={handleChange}
          className="w-full px-4 py-3 bg-gray-700/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
          placeholder={`Enter ${field.name.toLowerCase()}`}
        />
      )}

      {field.type === 'checkbox' && (
        <motion.label
          whileHover={{ scale: 1.02 }}
          className="flex items-center gap-3 cursor-pointer"
        >
          <input
            type="checkbox"
            checked={value ?? field.defaultValue ?? false}
            onChange={handleChange}
            className="w-5 h-5 rounded border-gray-600 bg-gray-700 text-primary focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-gray-800"
          />
          <span className="text-gray-300">Check to enable</span>
        </motion.label>
      )}

      {(field.type === 'radio' || field.type === 'dropdown') && field.options && (
        <motion.select
          whileFocus={{ scale: 1.01 }}
          value={value || field.defaultValue || ''}
          onChange={handleChange}
          className="w-full px-4 py-3 bg-gray-700/50 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
        >
          <option value="">Select an option</option>
          {field.options.map((option) => (
            <option key={option} value={option} className="bg-gray-800">
              {option}
            </option>
          ))}
        </motion.select>
      )}

      {error && (
        <motion.p
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          className="text-sm text-red-400"
        >
          {error}
        </motion.p>
      )}
    </motion.div>
  );
}
