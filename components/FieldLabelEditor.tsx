'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Edit2, Check, X } from 'lucide-react';
import { PDFField } from '@/types/pdf';

interface FieldLabelEditorProps {
  field: PDFField;
  onLabelChange: (fieldName: string, newLabel: string) => void;
}

export default function FieldLabelEditor({ field, onLabelChange }: FieldLabelEditorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedLabel, setEditedLabel] = useState(field.label || field.name);

  // Update editedLabel when field.label changes
  useEffect(() => {
    if (!isEditing) {
      setEditedLabel(field.label || field.name);
    }
  }, [field.label, field.name, isEditing]);

  const handleSave = () => {
    if (editedLabel.trim()) {
      onLabelChange(field.name, editedLabel.trim());
      console.log('Label changed:', field.name, '->', editedLabel.trim());
    } else {
      setEditedLabel(field.label || field.name);
    }
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditedLabel(field.label || field.name);
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={editedLabel}
          onChange={(e) => setEditedLabel(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSave();
            if (e.key === 'Escape') handleCancel();
          }}
          className="flex-1 px-2 py-1 text-sm bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:ring-1 focus:ring-primary"
          autoFocus
        />
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={handleSave}
          className="p-1 text-green-400 hover:bg-gray-700 rounded"
        >
          <Check className="w-4 h-4" />
        </motion.button>
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={handleCancel}
          className="p-1 text-red-400 hover:bg-gray-700 rounded"
        >
          <X className="w-4 h-4" />
        </motion.button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 group">
      <span className="text-sm font-medium text-gray-300">
        {field.label || field.name}
      </span>
      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => setIsEditing(true)}
        className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-white transition-opacity"
        title="Edit label"
      >
        <Edit2 className="w-3 h-3" />
      </motion.button>
      {field.name !== (field.label || field.name) && (
        <span className="text-xs text-gray-500" title={`Internal name: ${field.name}`}>
          ({field.name})
        </span>
      )}
    </div>
  );
}
