'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, Loader2, Undo2, Check, X } from 'lucide-react';
import { Rule, ChatMessage } from '@/types/rule';
import { PDFField } from '@/types/pdf';
import { summarizeRule } from './ruleSummary';
import { newRuleId } from '@/lib/firestore/rules';

interface RuleMutation {
  kind: 'add' | 'edit' | 'delete-pending';
  rule?: Rule;
  ruleId?: string;
  patch?: Partial<Rule>;
}

interface RuleChatProps {
  rules: Rule[];
  fields: PDFField[];
  history: ChatMessage[];
  onApplyMutations: (
    mutations: RuleMutation[],
    appendMessages: ChatMessage[]
  ) => Promise<void>;
}

export default function RuleChat({ rules, fields, history, onApplyMutations }: RuleChatProps) {
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [lastUndo, setLastUndo] = useState<{ before: Rule[]; messageId: string } | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [history]);

  async function send() {
    if (!input.trim() || sending) return;

    const userMsg: ChatMessage = {
      id: newRuleId(),
      role: 'user',
      content: input.trim(),
      createdAt: Date.now(),
    };
    setSending(true);
    setInput('');

    try {
      const res = await fetch('/api/rule-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fields,
          rules,
          history,
          userMessage: userMsg.content,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        const errMsg: ChatMessage = {
          id: newRuleId(),
          role: 'assistant',
          content: `Sorry, that didn't work: ${data.error || res.statusText}`,
          createdAt: Date.now(),
        };
        await onApplyMutations([], [userMsg, errMsg]);
        return;
      }

      // Apply non-destructive mutations immediately. Stash a delete-pending
      // for the user to confirm.
      const muts = (data.mutations || []) as RuleMutation[];
      const safeMuts = muts.filter((m) => m.kind !== 'delete-pending');
      const delMut = muts.find((m) => m.kind === 'delete-pending');

      const before = rules.slice();
      const assistantMsg: ChatMessage = {
        id: newRuleId(),
        role: 'assistant',
        content: data.reply || (safeMuts.length ? 'Done.' : ''),
        createdAt: Date.now(),
        toolCalls: (data.rawToolCalls || []).map((tc: any) => ({
          tool: tc.tool,
          args: tc.args,
          result: tc.error ? { ok: false, error: tc.error } : { ok: true },
        })),
      };

      await onApplyMutations(safeMuts, [userMsg, assistantMsg]);
      if (safeMuts.length > 0) {
        setLastUndo({ before, messageId: assistantMsg.id });
      }
      if (delMut) {
        setPendingDelete(delMut.ruleId!);
      }
    } catch (e: any) {
      const errMsg: ChatMessage = {
        id: newRuleId(),
        role: 'assistant',
        content: `Network error: ${e?.message || 'unknown'}`,
        createdAt: Date.now(),
      };
      await onApplyMutations([], [userMsg, errMsg]);
    } finally {
      setSending(false);
    }
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    await onApplyMutations(
      [{ kind: 'edit', ruleId: pendingDelete, patch: { _delete: true } as any }],
      [
        {
          id: newRuleId(),
          role: 'assistant',
          content: 'Deleted.',
          createdAt: Date.now(),
        },
      ]
    );
    setPendingDelete(null);
  }

  function cancelDelete() {
    setPendingDelete(null);
  }

  async function undoLast() {
    if (!lastUndo) return;
    // Replace the entire rule list with the snapshot taken before the last apply.
    await onApplyMutations(
      [{ kind: 'edit', ruleId: '__replace_all__', patch: { _replaceAll: lastUndo.before } as any }],
      [
        {
          id: newRuleId(),
          role: 'assistant',
          content: 'Reverted last change.',
          createdAt: Date.now(),
        },
      ]
    );
    setLastUndo(null);
  }

  const pendingRule = pendingDelete ? rules.find((r) => r.id === pendingDelete) : null;

  return (
    <div className="flex flex-col h-full">
      <div ref={scrollRef} className="flex-1 overflow-y-auto pb-4 space-y-3">
        {history.length === 0 && (
          <p className="text-xs text-ink-faint italic">
            Try: "if financing is cash, set loan amount to 0 and clear lender name"
          </p>
        )}
        {history.map((msg) => (
          <div key={msg.id} className={msg.role === 'user' ? 'text-right' : 'text-left'}>
            <div
              className={`inline-block px-3 py-2 rounded-lg max-w-[85%] text-sm ${
                msg.role === 'user'
                  ? 'bg-accent text-paper-card'
                  : 'bg-paper-card border border-paper-edge'
              }`}
            >
              {msg.content}
            </div>
            {msg.toolCalls?.map((tc, idx) =>
              tc.result?.ok ? (
                <div
                  key={idx}
                  className="text-xs text-ink-faint mt-1 inline-flex items-center gap-1"
                >
                  <Check className="w-3 h-3" />
                  {tc.tool}
                </div>
              ) : (
                <div key={idx} className="text-xs text-red-600 mt-1">
                  {tc.tool} failed: {tc.result?.error}
                </div>
              )
            )}
          </div>
        ))}
      </div>

      {pendingRule && (
        <div className="mb-2 p-3 border border-amber-300 bg-amber-50 rounded-md text-sm">
          <p className="mb-2">Delete this rule?</p>
          <p className="text-xs text-ink-faint mb-3">{summarizeRule(pendingRule, fields)}</p>
          <div className="flex gap-2">
            <button onClick={confirmDelete} className="btn btn-ghost btn-sm text-red-600">
              <X className="w-3.5 h-3.5 mr-1" />
              Delete
            </button>
            <button onClick={cancelDelete} className="btn btn-ghost btn-sm">
              Cancel
            </button>
          </div>
        </div>
      )}

      {lastUndo && !pendingRule && (
        <button
          onClick={undoLast}
          className="mb-2 self-start text-xs text-accent hover:underline inline-flex items-center gap-1"
        >
          <Undo2 className="w-3 h-3" />
          Undo last change
        </button>
      )}

      <div className="flex gap-2 items-end">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          placeholder="Describe a rule, or ask 'why did X auto-fill?'"
          className="input flex-1 resize-none min-h-[44px] max-h-[120px]"
          rows={1}
          disabled={sending}
        />
        <button
          type="button"
          onClick={send}
          disabled={!input.trim() || sending}
          className="btn btn-primary btn-sm"
          aria-label="Send"
        >
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}
