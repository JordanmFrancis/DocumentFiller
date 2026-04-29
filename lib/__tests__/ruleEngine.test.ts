import { describe, it, expect } from 'vitest';
import { evaluateGroup } from '../ruleEngine';
import { ConditionGroup } from '@/types/rule';
import { PDFField } from '@/types/pdf';

const FIELDS: PDFField[] = [
  { name: 'financing', label: 'Financing', type: 'dropdown', options: ['Cash', 'Conventional'] },
  { name: 'loan_amount', label: 'Loan Amount', type: 'number' },
  { name: 'is_first_time', label: 'First-Time Buyer', type: 'checkbox' },
  { name: 'state', label: 'State', type: 'text' },
];

describe('evaluateGroup', () => {
  it('matches a single equality condition', () => {
    const group: ConditionGroup = {
      connector: 'AND',
      conditions: [{ fieldName: 'financing', op: 'eq', value: 'Cash' }],
    };
    expect(evaluateGroup(group, { financing: 'Cash' }, FIELDS)).toBe(true);
    expect(evaluateGroup(group, { financing: 'Conventional' }, FIELDS)).toBe(false);
  });
});

describe('evaluateGroup — connectors', () => {
  it('AND requires all conditions to be true', () => {
    const group: ConditionGroup = {
      connector: 'AND',
      conditions: [
        { fieldName: 'financing', op: 'eq', value: 'Cash' },
        { fieldName: 'state', op: 'contains', value: 'CA' },
      ],
    };
    expect(evaluateGroup(group, { financing: 'Cash', state: 'CA' }, FIELDS)).toBe(true);
    expect(evaluateGroup(group, { financing: 'Cash', state: 'NY' }, FIELDS)).toBe(false);
  });

  it('OR fires when any condition is true', () => {
    const group: ConditionGroup = {
      connector: 'OR',
      conditions: [
        { fieldName: 'financing', op: 'eq', value: 'Cash' },
        { fieldName: 'is_first_time', op: 'eq', value: true },
      ],
    };
    expect(evaluateGroup(group, { financing: 'Cash', is_first_time: false }, FIELDS)).toBe(true);
    expect(evaluateGroup(group, { financing: 'Conventional', is_first_time: true }, FIELDS)).toBe(true);
    expect(evaluateGroup(group, { financing: 'Conventional', is_first_time: false }, FIELDS)).toBe(false);
  });
});

describe('evaluateGroup — operators', () => {
  it('handles neq', () => {
    const group: ConditionGroup = {
      connector: 'AND',
      conditions: [{ fieldName: 'financing', op: 'neq', value: 'Cash' }],
    };
    expect(evaluateGroup(group, { financing: 'Conventional' }, FIELDS)).toBe(true);
    expect(evaluateGroup(group, { financing: 'Cash' }, FIELDS)).toBe(false);
  });

  it('handles contains case-insensitively', () => {
    const group: ConditionGroup = {
      connector: 'AND',
      conditions: [{ fieldName: 'state', op: 'contains', value: 'ca' }],
    };
    expect(evaluateGroup(group, { state: 'California' }, FIELDS)).toBe(true);
    expect(evaluateGroup(group, { state: 'New York' }, FIELDS)).toBe(false);
  });

  it('handles gt and lt for numbers', () => {
    const gt: ConditionGroup = {
      connector: 'AND',
      conditions: [{ fieldName: 'loan_amount', op: 'gt', value: 100000 }],
    };
    const lt: ConditionGroup = {
      connector: 'AND',
      conditions: [{ fieldName: 'loan_amount', op: 'lt', value: 100000 }],
    };
    expect(evaluateGroup(gt, { loan_amount: 200000 }, FIELDS)).toBe(true);
    expect(evaluateGroup(gt, { loan_amount: 50000 }, FIELDS)).toBe(false);
    expect(evaluateGroup(lt, { loan_amount: 50000 }, FIELDS)).toBe(true);
  });

  it('returns false on type mismatch for gt/lt', () => {
    const group: ConditionGroup = {
      connector: 'AND',
      conditions: [{ fieldName: 'state', op: 'gt', value: 100 }],
    };
    expect(evaluateGroup(group, { state: 'California' }, FIELDS)).toBe(false);
  });
});

describe('evaluateGroup — missing fields', () => {
  it('returns false for a condition referencing a missing field', () => {
    const group: ConditionGroup = {
      connector: 'AND',
      conditions: [{ fieldName: 'does_not_exist', op: 'eq', value: 'x' }],
    };
    expect(evaluateGroup(group, {}, FIELDS)).toBe(false);
  });

  it('AND with missing-field condition can never fire', () => {
    const group: ConditionGroup = {
      connector: 'AND',
      conditions: [
        { fieldName: 'financing', op: 'eq', value: 'Cash' },
        { fieldName: 'does_not_exist', op: 'eq', value: 'x' },
      ],
    };
    expect(evaluateGroup(group, { financing: 'Cash' }, FIELDS)).toBe(false);
  });

  it('OR with one valid condition can still fire despite a missing-field sibling', () => {
    const group: ConditionGroup = {
      connector: 'OR',
      conditions: [
        { fieldName: 'financing', op: 'eq', value: 'Cash' },
        { fieldName: 'does_not_exist', op: 'eq', value: 'x' },
      ],
    };
    expect(evaluateGroup(group, { financing: 'Cash' }, FIELDS)).toBe(true);
  });
});

describe('evaluateGroup — nested groups', () => {
  it('evaluates a sub-group correctly', () => {
    const group: ConditionGroup = {
      connector: 'AND',
      conditions: [
        { fieldName: 'financing', op: 'eq', value: 'Cash' },
        {
          connector: 'OR',
          conditions: [
            { fieldName: 'state', op: 'contains', value: 'CA' },
            { fieldName: 'state', op: 'contains', value: 'NY' },
          ],
        },
      ],
    };
    expect(evaluateGroup(group, { financing: 'Cash', state: 'California' }, FIELDS)).toBe(true);
    expect(evaluateGroup(group, { financing: 'Cash', state: 'Albany, NY' }, FIELDS)).toBe(true);
    expect(evaluateGroup(group, { financing: 'Cash', state: 'Texas' }, FIELDS)).toBe(false);
  });
});

describe('evaluateGroup — empty group', () => {
  it('returns false for a group with zero conditions', () => {
    const group: ConditionGroup = { connector: 'AND', conditions: [] };
    expect(evaluateGroup(group, {}, FIELDS)).toBe(false);
  });
});
