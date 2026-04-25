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
          className="flex-1 px-2 py-1 text-base bg-white border-b-2 border-margin-red font-marker text-ink focus:outline-none"
          autoFocus
        />
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={handleSave}
          className="p-1 rounded border-[1.5px] border-ink bg-accent-mint shadow-rough"
        >
          <Check className="w-3.5 h-3.5 text-ink" strokeWidth={2.5} />
        </motion.button>
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={handleCancel}
          className="p-1 rounded border-[1.5px] border-ink bg-accent-coral/40 shadow-rough"
        >
          <X className="w-3.5 h-3.5 text-ink" strokeWidth={2.5} />
        </motion.button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 group flex-1">
      <span className="font-marker text-base text-ink">
        {field.label || field.name}
      </span>
      <motion.button
        whileHover={{ scale: 1.15, rotate: -8 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => setIsEditing(true)}
        className="opacity-0 group-hover:opacity-100 p-1 text-ink-soft hover:text-ink transition-opacity"
        title="Edit label"
      >
        <Edit2 className="w-3.5 h-3.5" />
      </motion.button>
      {field.name !== (field.label || field.name) && (
        <span
          className="font-typewriter text-[10px] text-ink-faint uppercase tracking-wide"
          title={`Internal name: ${field.name}`}
        >
          ({field.name})
        </span>
      )}
    </div>
  );
}
