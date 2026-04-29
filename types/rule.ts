// types/rule.ts
export type ConditionOp = 'eq' | 'neq' | 'contains' | 'gt' | 'lt';

export interface RuleCondition {
  fieldName: string;
  op: ConditionOp;
  value: string | boolean | number;
}

export interface ConditionGroup {
  connector: 'AND' | 'OR';
  conditions: (RuleCondition | ConditionGroup)[];
}

export interface RuleAction {
  type: 'set' | 'clear';
  fieldName: string;
  value?: string | boolean | number;
}

export interface Rule {
  id: string;
  name?: string;
  conditionGroup: ConditionGroup;
  actions: RuleAction[];
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  toolCalls?: Array<{
    tool: 'add_rule' | 'edit_rule' | 'delete_rule' | 'list_rules';
    args: Record<string, any>;
    result?: { ok: boolean; ruleId?: string; error?: string };
  }>;
  createdAt: number; // unix ms — Firestore Timestamps don't survive client-side equality checks well
}

// Type guard for distinguishing leaf conditions from sub-groups in a group's `conditions` array.
export function isConditionGroup(
  c: RuleCondition | ConditionGroup
): c is ConditionGroup {
  return (c as ConditionGroup).connector !== undefined;
}
