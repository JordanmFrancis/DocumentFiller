// components/Rules/ruleSummary.ts
import {
  Rule,
  RuleCondition,
  ConditionGroup,
  RuleAction,
  isConditionGroup,
} from '@/types/rule';
import { PDFField } from '@/types/pdf';

function fieldLabel(name: string, fields: PDFField[]): string {
  const f = fields.find((x) => x.name === name);
  return f?.label || name;
}

const OP_TEXT: Record<string, string> = {
  eq: 'is',
  neq: 'is not',
  contains: 'contains',
  gt: 'is greater than',
  lt: 'is less than',
};

function summarizeCondition(c: RuleCondition, fields: PDFField[]): string {
  return `${fieldLabel(c.fieldName, fields)} ${OP_TEXT[c.op] || c.op} ${JSON.stringify(c.value)}`;
}

function summarizeGroup(group: ConditionGroup, fields: PDFField[]): string {
  if (group.conditions.length === 0) return '(no conditions)';
  const parts = group.conditions.map((c) =>
    isConditionGroup(c) ? `(${summarizeGroup(c, fields)})` : summarizeCondition(c, fields)
  );
  return parts.join(group.connector === 'AND' ? ' and ' : ' or ');
}

function summarizeAction(a: RuleAction, fields: PDFField[]): string {
  const label = fieldLabel(a.fieldName, fields);
  return a.type === 'clear' ? `clear ${label}` : `set ${label} = ${JSON.stringify(a.value)}`;
}

export function summarizeRule(rule: Rule, fields: PDFField[]): string {
  const conditions = summarizeGroup(rule.conditionGroup, fields);
  const actions = rule.actions.map((a) => summarizeAction(a, fields)).join(', ');
  return `When ${conditions} → ${actions}`;
}
