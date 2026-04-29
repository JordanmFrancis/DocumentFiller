import {
  ConditionGroup,
  RuleCondition,
  isConditionGroup,
} from '@/types/rule';
import { PDFField } from '@/types/pdf';
import { FormValues } from '@/types/pdf';
import { Rule, RuleAction } from '@/types/rule';

function evaluateCondition(
  c: RuleCondition,
  values: FormValues,
  fields: PDFField[]
): boolean {
  // Missing-field check: if the trigger field doesn't exist, condition is false.
  if (!fields.some((f) => f.name === c.fieldName)) return false;

  const lhs = values[c.fieldName];

  switch (c.op) {
    case 'eq':
      return lhs === c.value;
    case 'neq':
      return lhs !== c.value;
    case 'contains':
      if (typeof lhs !== 'string') return false;
      return lhs.toLowerCase().includes(String(c.value).toLowerCase());
    case 'gt':
      return typeof lhs === 'number' && typeof c.value === 'number' && lhs > c.value;
    case 'lt':
      return typeof lhs === 'number' && typeof c.value === 'number' && lhs < c.value;
    default:
      return false;
  }
}

export function evaluateGroup(
  group: ConditionGroup,
  values: FormValues,
  fields: PDFField[]
): boolean {
  if (group.conditions.length === 0) return false; // empty group never fires

  const results = group.conditions.map((c) =>
    isConditionGroup(c)
      ? evaluateGroup(c, values, fields)
      : evaluateCondition(c, values, fields)
  );

  return group.connector === 'AND'
    ? results.every(Boolean)
    : results.some(Boolean);
}

interface ApplyResult {
  newValues: FormValues;
  ruleTouched: Map<string, string>;
  conflicts: { fieldName: string; ruleIds: string[] }[];
}

export function applyRules(
  rules: Rule[],
  baselineValues: FormValues,
  overwritable: Set<string>,
  fields: PDFField[]
): ApplyResult {
  const newValues: FormValues = { ...baselineValues };
  const ruleTouched = new Map<string, string>();
  const writers = new Map<string, Array<{ ruleId: string; value: any }>>();

  for (const rule of rules) {
    const fires = evaluateGroup(rule.conditionGroup, newValues, fields);
    if (!fires) continue;

    for (const action of rule.actions) {
      // Missing-field action: skip silently.
      if (!fields.some((f) => f.name === action.fieldName)) continue;

      // Respect user-edited fields: only write to overwritable ones.
      if (!overwritable.has(action.fieldName)) continue;

      const writeValue = action.type === 'clear' ? '' : action.value;

      // Track every rule that wrote this field this pass — for conflict detection.
      if (!writers.has(action.fieldName)) writers.set(action.fieldName, []);
      writers.get(action.fieldName)!.push({ ruleId: rule.id, value: writeValue });

      // Last-writer-wins.
      newValues[action.fieldName] = writeValue as any;
      ruleTouched.set(action.fieldName, rule.id);
    }
  }

  // Detect conflicts: same field written with at least two distinct values.
  const conflicts: { fieldName: string; ruleIds: string[] }[] = [];
  for (const [fieldName, writes] of writers) {
    const distinctValues = new Set(writes.map((w) => JSON.stringify(w.value)));
    if (distinctValues.size > 1) {
      conflicts.push({
        fieldName,
        ruleIds: writes.map((w) => w.ruleId),
      });
    }
  }

  return { newValues, ruleTouched, conflicts };
}
