'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Rule } from '@/types/rule';
import { PDFField } from '@/types/pdf';
import RuleRow from './RuleRow';
import { newRuleId } from '@/lib/firestore/rules';

interface RuleListProps {
  rules: Array<Rule & { _missingFieldRefs?: string[] }>;
  fields: PDFField[];
  conflicts: { fieldName: string; ruleIds: string[] }[];
  onRulesChange: (next: Rule[]) => void;
}

export default function RuleList({ rules, fields, conflicts, onRulesChange }: RuleListProps) {
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const conflictsByRule = new Map<string, string[]>();
  for (const c of conflicts) {
    for (const id of c.ruleIds) {
      const others = c.ruleIds.filter((x) => x !== id);
      conflictsByRule.set(id, [...(conflictsByRule.get(id) || []), ...others]);
    }
  }

  function updateRule(idx: number, next: Rule) {
    const out = [...rules];
    out[idx] = next;
    onRulesChange(out);
  }

  function deleteRule(idx: number) {
    onRulesChange(rules.filter((_, i) => i !== idx));
  }

  function duplicateRule(idx: number) {
    const orig = rules[idx];
    const copy: Rule = {
      ...orig,
      id: newRuleId(),
      name: orig.name ? `${orig.name} (copy)` : undefined,
      conditionGroup: structuredClone(orig.conditionGroup),
      actions: structuredClone(orig.actions),
    };
    const out = [...rules];
    out.splice(idx + 1, 0, copy);
    onRulesChange(out);
  }

  function addRule() {
    const blank: Rule = {
      id: newRuleId(),
      conditionGroup: {
        connector: 'AND',
        conditions: [{ fieldName: '', op: 'eq', value: '' }],
      },
      actions: [{ type: 'set', fieldName: '', value: '' }],
    };
    onRulesChange([...rules, blank]);
  }

  function handleDragStart(e: React.DragEvent, id: string) {
    setDraggingId(id);
    e.dataTransfer.effectAllowed = 'move';
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }

  function handleDrop(e: React.DragEvent, dropIdx: number) {
    e.preventDefault();
    if (!draggingId) return;
    const fromIdx = rules.findIndex((r) => r.id === draggingId);
    if (fromIdx === -1 || fromIdx === dropIdx) return;

    const out = [...rules];
    const [moved] = out.splice(fromIdx, 1);
    out.splice(dropIdx > fromIdx ? dropIdx - 1 : dropIdx, 0, moved);
    onRulesChange(out);
    setDraggingId(null);
  }

  if (rules.length === 0) {
    return (
      <div className="text-center py-12 text-sm text-ink-faint">
        <p className="mb-3">No rules yet.</p>
        <p className="mb-4">Type a sentence in the chat or click below to add one manually.</p>
        <button
          type="button"
          onClick={addRule}
          className="btn btn-ghost btn-sm inline-flex items-center gap-1.5"
        >
          <Plus className="w-4 h-4" />
          Add rule
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {rules.map((rule, idx) => (
        <div
          key={rule.id}
          draggable
          onDragStart={(e) => handleDragStart(e, rule.id)}
          onDragOver={handleDragOver}
          onDrop={(e) => handleDrop(e, idx)}
          className={draggingId === rule.id ? 'opacity-50' : ''}
        >
          <RuleRow
            rule={rule}
            fields={fields}
            conflictsWith={conflictsByRule.get(rule.id)}
            onChange={(next) => updateRule(idx, next)}
            onDelete={() => deleteRule(idx)}
            onDuplicate={() => duplicateRule(idx)}
          />
        </div>
      ))}
      <button
        type="button"
        onClick={addRule}
        className="btn btn-ghost btn-sm inline-flex items-center gap-1.5 mt-1"
      >
        <Plus className="w-4 h-4" />
        Add rule
      </button>
    </div>
  );
}
