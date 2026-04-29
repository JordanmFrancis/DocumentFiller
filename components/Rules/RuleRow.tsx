'use client';

import { useState } from 'react';
import { GripVertical, MoreHorizontal, Plus, AlertTriangle } from 'lucide-react';
import { Rule, RuleCondition, RuleAction, ConditionOp } from '@/types/rule';
import { PDFField } from '@/types/pdf';
import { summarizeRule } from './ruleSummary';
import ConditionInput from './ConditionInput';
import ActionInput from './ActionInput';

interface RuleRowProps {
  rule: Rule & { _missingFieldRefs?: string[] };
  fields: PDFField[];
  conflictsWith?: string[]; // rule IDs this rule conflicts with
  onChange: (next: Rule) => void;
  onDelete: () => void;
  onDuplicate: () => void;
}

export default function RuleRow({
  rule,
  fields,
  conflictsWith,
  onChange,
  onDelete,
  onDuplicate,
}: RuleRowProps) {
  const [expanded, setExpanded] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const summary = summarizeRule(rule, fields);
  const hasMissing = rule._missingFieldRefs && rule._missingFieldRefs.length > 0;
  const hasConflict = conflictsWith && conflictsWith.length > 0;

  function setConnector(c: 'AND' | 'OR') {
    onChange({
      ...rule,
      conditionGroup: { ...rule.conditionGroup, connector: c },
    });
  }

  function updateCondition(idx: number, next: RuleCondition) {
    const conds = [...rule.conditionGroup.conditions];
    conds[idx] = next;
    onChange({ ...rule, conditionGroup: { ...rule.conditionGroup, conditions: conds } });
  }

  function addCondition() {
    const next: RuleCondition = { fieldName: '', op: 'eq' as ConditionOp, value: '' };
    onChange({
      ...rule,
      conditionGroup: {
        ...rule.conditionGroup,
        conditions: [...rule.conditionGroup.conditions, next],
      },
    });
  }

  function removeCondition(idx: number) {
    const conds = rule.conditionGroup.conditions.filter((_, i) => i !== idx);
    onChange({ ...rule, conditionGroup: { ...rule.conditionGroup, conditions: conds } });
  }

  function updateAction(idx: number, next: RuleAction) {
    const acts = [...rule.actions];
    acts[idx] = next;
    onChange({ ...rule, actions: acts });
  }

  function addAction() {
    const next: RuleAction = { type: 'set', fieldName: '', value: '' };
    onChange({ ...rule, actions: [...rule.actions, next] });
  }

  function removeAction(idx: number) {
    onChange({ ...rule, actions: rule.actions.filter((_, i) => i !== idx) });
  }

  return (
    <div className="border border-paper-edge rounded-md bg-paper-card">
      <div className="flex items-center gap-2 px-3 py-2">
        <GripVertical
          className="w-4 h-4 text-ink-faint shrink-0 cursor-grab"
          aria-label="Drag to reorder"
        />
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex-1 text-left text-sm text-ink hover:text-ink-strong"
        >
          {summary}
        </button>
        {hasMissing && (
          <span
            className="inline-flex items-center gap-1 text-xs text-amber-700 bg-amber-100 px-2 py-0.5 rounded"
            title={`Missing fields: ${rule._missingFieldRefs?.join(', ')}`}
          >
            <AlertTriangle className="w-3 h-3" />
            missing field
          </span>
        )}
        {hasConflict && (
          <span
            className="inline-flex items-center gap-1 text-xs text-amber-700 bg-amber-100 px-2 py-0.5 rounded"
            title={`Conflicts with: ${conflictsWith?.join(', ')}`}
          >
            <AlertTriangle className="w-3 h-3" />
            conflict
          </span>
        )}
        <div className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className="btn btn-ghost btn-sm"
            aria-label="Rule actions"
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-7 z-10 bg-paper-card border border-paper-edge rounded-md shadow-md py-1 min-w-[140px]">
              <button
                onClick={() => {
                  onDuplicate();
                  setMenuOpen(false);
                }}
                className="w-full text-left px-3 py-1.5 text-sm hover:bg-paper-edge"
              >
                Duplicate
              </button>
              <button
                onClick={() => {
                  onDelete();
                  setMenuOpen(false);
                }}
                className="w-full text-left px-3 py-1.5 text-sm hover:bg-paper-edge text-red-600"
              >
                Delete
              </button>
            </div>
          )}
        </div>
      </div>

      {expanded && (
        <div className="px-3 pb-3 pt-1 border-t border-paper-edge space-y-3">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs uppercase tracking-wide text-ink-faint">When</span>
              <select
                value={rule.conditionGroup.connector}
                onChange={(e) => setConnector(e.target.value as 'AND' | 'OR')}
                className="input input-sm"
              >
                <option value="AND">All of</option>
                <option value="OR">Any of</option>
              </select>
              <span className="text-xs text-ink-faint">these are true</span>
            </div>
            <div className="space-y-2">
              {rule.conditionGroup.conditions.map((c, idx) => {
                if ('connector' in c) {
                  return (
                    <div key={idx} className="text-xs text-ink-faint italic px-2">
                      (nested group — edit via JSON; v1 UI ships flat)
                    </div>
                  );
                }
                return (
                  <ConditionInput
                    key={idx}
                    condition={c}
                    fields={fields}
                    onChange={(next) => updateCondition(idx, next)}
                    onRemove={() => removeCondition(idx)}
                  />
                );
              })}
            </div>
            <button
              type="button"
              onClick={addCondition}
              className="mt-2 btn btn-ghost btn-sm flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              Add condition
            </button>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs uppercase tracking-wide text-ink-faint">Then</span>
            </div>
            <div className="space-y-2">
              {rule.actions.map((a, idx) => (
                <ActionInput
                  key={idx}
                  action={a}
                  fields={fields}
                  onChange={(next) => updateAction(idx, next)}
                  onRemove={() => removeAction(idx)}
                />
              ))}
            </div>
            <button
              type="button"
              onClick={addAction}
              className="mt-2 btn btn-ghost btn-sm flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              Add action
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
