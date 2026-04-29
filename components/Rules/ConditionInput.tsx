'use client';

import { RuleCondition, ConditionOp } from '@/types/rule';
import { PDFField } from '@/types/pdf';

interface ConditionInputProps {
  condition: RuleCondition;
  fields: PDFField[];
  onChange: (next: RuleCondition) => void;
  onRemove: () => void;
}

const OPS_BY_TYPE: Record<string, ConditionOp[]> = {
  text: ['eq', 'neq', 'contains'],
  date: ['eq', 'neq'],
  number: ['eq', 'neq', 'gt', 'lt'],
  dropdown: ['eq', 'neq'],
  radio: ['eq', 'neq'],
  checkbox: ['eq'],
};

const OP_LABELS: Record<ConditionOp, string> = {
  eq: 'is',
  neq: 'is not',
  contains: 'contains',
  gt: '>',
  lt: '<',
};

export default function ConditionInput({
  condition,
  fields,
  onChange,
  onRemove,
}: ConditionInputProps) {
  const field = fields.find((f) => f.name === condition.fieldName);
  const fieldType = field?.type || 'text';
  const allowedOps = OPS_BY_TYPE[fieldType] || ['eq'];

  // If current op isn't allowed for this field type, snap to first allowed.
  const op: ConditionOp = allowedOps.includes(condition.op) ? condition.op : allowedOps[0];

  function renderValueInput() {
    if (!field) {
      return (
        <input
          type="text"
          value={String(condition.value ?? '')}
          onChange={(e) => onChange({ ...condition, value: e.target.value })}
          placeholder="Value"
          className="input flex-1"
        />
      );
    }

    if (field.type === 'checkbox') {
      return (
        <select
          value={String(condition.value)}
          onChange={(e) => onChange({ ...condition, value: e.target.value === 'true' })}
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
          value={String(condition.value ?? '')}
          onChange={(e) => onChange({ ...condition, value: e.target.value })}
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
          value={String(condition.value ?? '')}
          onChange={(e) => onChange({ ...condition, value: Number(e.target.value) })}
          className="input flex-1"
        />
      );
    }

    if (field.type === 'date') {
      return (
        <input
          type="date"
          value={String(condition.value ?? '')}
          onChange={(e) => onChange({ ...condition, value: e.target.value })}
          className="input flex-1"
        />
      );
    }

    return (
      <input
        type="text"
        value={String(condition.value ?? '')}
        onChange={(e) => onChange({ ...condition, value: e.target.value })}
        placeholder="Value"
        className="input flex-1"
      />
    );
  }

  return (
    <div className="flex gap-2 items-center">
      <select
        value={condition.fieldName}
        onChange={(e) => onChange({ ...condition, fieldName: e.target.value })}
        className="input flex-[2]"
      >
        <option value="">Select field…</option>
        {fields.map((f) => (
          <option key={f.name} value={f.name}>
            {f.label || f.name}
          </option>
        ))}
      </select>

      <select
        value={op}
        onChange={(e) => onChange({ ...condition, op: e.target.value as ConditionOp })}
        className="input"
      >
        {allowedOps.map((o) => (
          <option key={o} value={o}>
            {OP_LABELS[o]}
          </option>
        ))}
      </select>

      {renderValueInput()}

      <button
        type="button"
        onClick={onRemove}
        className="btn btn-ghost btn-sm"
        aria-label="Remove condition"
      >
        ×
      </button>
    </div>
  );
}
