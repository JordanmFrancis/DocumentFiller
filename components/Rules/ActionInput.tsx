'use client';

import { RuleAction } from '@/types/rule';
import { PDFField } from '@/types/pdf';

interface ActionInputProps {
  action: RuleAction;
  fields: PDFField[];
  onChange: (next: RuleAction) => void;
  onRemove: () => void;
}

export default function ActionInput({ action, fields, onChange, onRemove }: ActionInputProps) {
  const field = fields.find((f) => f.name === action.fieldName);

  function renderValueInput() {
    if (action.type === 'clear') return null;
    if (!field) {
      return (
        <input
          type="text"
          value={String(action.value ?? '')}
          onChange={(e) => onChange({ ...action, value: e.target.value })}
          placeholder="Value"
          className="input flex-1"
        />
      );
    }

    if (field.type === 'checkbox') {
      return (
        <select
          value={String(action.value)}
          onChange={(e) => onChange({ ...action, value: e.target.value === 'true' })}
          className="input"
        >
          <option value="true">checked</option>
          <option value="false">unchecked</option>
        </select>
      );
    }

    if ((field.type === 'dropdown' || field.type === 'radio') && field.options?.length) {
      return (
        <select
          value={String(action.value ?? '')}
          onChange={(e) => onChange({ ...action, value: e.target.value })}
          className="input"
        >
          <option value="">—</option>
          {field.options.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      );
    }

    if (field.type === 'number') {
      return (
        <input
          type="number"
          value={String(action.value ?? '')}
          onChange={(e) => onChange({ ...action, value: Number(e.target.value) })}
          className="input flex-1"
        />
      );
    }

    if (field.type === 'date') {
      return (
        <input
          type="date"
          value={String(action.value ?? '')}
          onChange={(e) => onChange({ ...action, value: e.target.value })}
          className="input flex-1"
        />
      );
    }

    return (
      <input
        type="text"
        value={String(action.value ?? '')}
        onChange={(e) => onChange({ ...action, value: e.target.value })}
        placeholder="Value"
        className="input flex-1"
      />
    );
  }

  return (
    <div className="flex gap-2 items-center">
      <select
        value={action.type}
        onChange={(e) => onChange({ ...action, type: e.target.value as 'set' | 'clear' })}
        className="input"
      >
        <option value="set">Set</option>
        <option value="clear">Clear</option>
      </select>

      <select
        value={action.fieldName}
        onChange={(e) => onChange({ ...action, fieldName: e.target.value })}
        className="input flex-[2]"
      >
        <option value="">Select field…</option>
        {fields.map((f) => (
          <option key={f.name} value={f.name}>
            {f.label || f.name}
          </option>
        ))}
      </select>

      {renderValueInput()}

      <button
        type="button"
        onClick={onRemove}
        className="btn btn-ghost btn-sm"
        aria-label="Remove action"
      >
        ×
      </button>
    </div>
  );
}
