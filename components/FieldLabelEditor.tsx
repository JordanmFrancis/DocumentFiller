'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Pencil, Check, X } from 'lucide-react';
import { PDFField } from '@/types/pdf';

interface FieldLabelEditorProps {
  field: PDFField;
  onLabelChange: (fieldName: string, newLabel: string) => void;
}

export default function FieldLabelEditor({ field, onLabelChange }: FieldLabelEditorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedLabel, setEditedLabel] = useState(field.label || field.name);

  useEffect(() => {
    if (!isEditing) {
      setEditedLabel(field.label || field.name);
    }
  }, [field.label, field.name, isEditing]);

  const handleSave = () => {
    if (editedLabel.trim()) {
      onLabelChange(field.name, editedLabel.trim());
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
      <div className="flex items-center gap-2 flex-1">
        <input
          type="text"
          value={editedLabel}
          onChange={(e) => setEditedLabel(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSave();
            if (e.key === 'Escape') handleCancel();
          }}
          className="input py-1 px-2 text-[13px] flex-1"
          autoFocus
        />
        <motion.button
          whileHover={{ scale: 1.06 }}
          whileTap={{ scale: 0.94 }}
          onClick={handleSave}
          className="p-1 rounded-md text-accent hover:bg-accent-tint"
          title="Save"
        >
          <Check className="w-3.5 h-3.5" strokeWidth={2.4} />
        </motion.button>
        <motion.button
          whileHover={{ scale: 1.06 }}
          whileTap={{ scale: 0.94 }}
          onClick={handleCancel}
          className="p-1 rounded-md text-ink-faint hover:text-ink hover:bg-paper-edge"
          title="Cancel"
        >
          <X className="w-3.5 h-3.5" strokeWidth={2.4} />
        </motion.button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 group flex-1">
      <span className="field-label !mb-0 !text-ink">
        {field.label || field.name}
      </span>
      <button
        onClick={() => setIsEditing(true)}
        className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-ink-faint hover:text-ink hover:bg-paper-edge transition-opacity"
        title="Edit label"
      >
        <Pencil className="w-3 h-3" />
      </button>
    </div>
  );
}
