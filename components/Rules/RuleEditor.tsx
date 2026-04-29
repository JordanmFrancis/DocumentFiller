'use client';

import { useMemo } from 'react';
import { X } from 'lucide-react';
import { Rule } from '@/types/rule';
import { PDFField, FormValues } from '@/types/pdf';
import { applyRules } from '@/lib/ruleEngine';
import { pruneRules } from '@/lib/firestore/documents';
import RuleList from './RuleList';

interface RuleEditorProps {
  rules: Rule[];
  fields: PDFField[];
  formValues: FormValues;
  onClose: () => void;
  onRulesChange: (next: Rule[]) => void;
}

export default function RuleEditor({
  rules,
  fields,
  formValues,
  onClose,
  onRulesChange,
}: RuleEditorProps) {
  // Annotate rules with missing-field refs for inline warnings.
  const annotatedRules = useMemo(() => pruneRules(fields, rules), [fields, rules]);

  // Compute live conflicts so the user sees them update as they edit rules.
  const conflicts = useMemo(() => {
    const result = applyRules(rules, formValues, new Set(fields.map((f) => f.name)), fields);
    return result.conflicts;
  }, [rules, formValues, fields]);

  return (
    <div className="fixed inset-0 z-50 bg-paper">
      <div className="max-w-[1280px] mx-auto h-full flex flex-col">
        <div className="flex items-center justify-between px-8 py-4 hairline">
          <h2 className="font-serif text-xl text-ink">Rules</h2>
          <button onClick={onClose} className="btn btn-ghost btn-sm" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 grid grid-cols-2 gap-6 px-8 py-6 overflow-hidden">
          <div className="overflow-y-auto pr-2">
            <RuleList
              rules={annotatedRules}
              fields={fields}
              conflicts={conflicts}
              onRulesChange={onRulesChange}
            />
          </div>

          <div className="border-l border-paper-edge pl-6 overflow-y-auto">
            <div className="text-center py-12 text-sm text-ink-faint">
              <p className="mb-2">Plain-English rule chat</p>
              <p className="text-xs">Coming in the next ship.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
