'use client';

import { useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { Rule, ChatMessage } from '@/types/rule';
import { PDFField, FormValues } from '@/types/pdf';
import { applyRules } from '@/lib/ruleEngine';
import { pruneRules } from '@/lib/firestore/documents';
import { appendChatMessage } from '@/lib/firestore/rules';
import RuleList from './RuleList';
import RuleChat from './RuleChat';

interface RuleEditorProps {
  documentId: string;
  rules: Rule[];
  fields: PDFField[];
  formValues: FormValues;
  chatHistory: ChatMessage[];
  onClose: () => void;
  onRulesChange: (next: Rule[]) => void;
  onChatHistoryChange: (next: ChatMessage[]) => void;
}

export default function RuleEditor({
  documentId,
  rules,
  fields,
  formValues,
  chatHistory,
  onClose,
  onRulesChange,
  onChatHistoryChange,
}: RuleEditorProps) {
  const annotatedRules = useMemo(() => pruneRules(fields, rules), [fields, rules]);
  const conflicts = useMemo(() => {
    const result = applyRules(rules, formValues, new Set(fields.map((f) => f.name)), fields);
    return result.conflicts;
  }, [rules, formValues, fields]);

  async function applyMutationsAndMessages(
    mutations: any[],
    appendMessages: ChatMessage[]
  ) {
    let nextRules = rules;
    for (const m of mutations) {
      if (m.kind === 'add' && m.rule) {
        nextRules = [...nextRules, m.rule];
      } else if (m.kind === 'edit' && m.ruleId === '__replace_all__' && m.patch?._replaceAll) {
        nextRules = m.patch._replaceAll;
      } else if (m.kind === 'edit' && m.ruleId && m.patch?._delete) {
        nextRules = nextRules.filter((r) => r.id !== m.ruleId);
      } else if (m.kind === 'edit' && m.ruleId && m.patch) {
        nextRules = nextRules.map((r) =>
          r.id === m.ruleId ? { ...r, ...m.patch } : r
        );
      }
    }
    if (nextRules !== rules) onRulesChange(nextRules);

    if (appendMessages.length > 0) {
      let history = chatHistory;
      for (const msg of appendMessages) {
        history = await appendChatMessage(documentId, history, msg);
      }
      onChatHistoryChange(history);
    }
  }

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

          <div className="border-l border-paper-edge pl-6 overflow-hidden flex flex-col">
            <RuleChat
              rules={rules}
              fields={fields}
              history={chatHistory}
              onApplyMutations={applyMutationsAndMessages}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
