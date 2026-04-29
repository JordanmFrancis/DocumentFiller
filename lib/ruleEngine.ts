import {
  ConditionGroup,
  RuleCondition,
  isConditionGroup,
} from '@/types/rule';
import { PDFField } from '@/types/pdf';
import { FormValues } from '@/types/pdf';

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
