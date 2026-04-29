import { describe, it, expect } from 'vitest';
import { evaluateGroup } from '../ruleEngine';
import { applyRules } from '../ruleEngine';
import { ConditionGroup } from '@/types/rule';
import { Rule } from '@/types/rule';
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

describe('applyRules — single rule, single action', () => {
  it('writes loan_amount = 0 when financing = Cash', () => {
    const rule: Rule = {
      id: 'r1',
      conditionGroup: {
        connector: 'AND',
        conditions: [{ fieldName: 'financing', op: 'eq', value: 'Cash' }],
      },
      actions: [{ type: 'set', fieldName: 'loan_amount', value: 0 }],
    };
    const result = applyRules(
      [rule],
      { financing: 'Cash' },
      new Set(['financing', 'loan_amount']),
      FIELDS
    );
    expect(result.newValues.loan_amount).toBe(0);
    expect(result.ruleTouched.get('loan_amount')).toBe('r1');
    expect(result.conflicts).toEqual([]);
  });
});

describe('applyRules — respect user edits', () => {
  it('does not overwrite a field outside `overwritable`', () => {
    const rule: Rule = {
      id: 'r1',
      conditionGroup: {
        connector: 'AND',
        conditions: [{ fieldName: 'financing', op: 'eq', value: 'Cash' }],
      },
      actions: [{ type: 'set', fieldName: 'loan_amount', value: 0 }],
    };
    // loan_amount is NOT overwritable — user has typed in it.
    const result = applyRules(
      [rule],
      { financing: 'Cash', loan_amount: 50000 },
      new Set(['financing']),
      FIELDS
    );
    expect(result.newValues.loan_amount).toBe(50000);
    expect(result.ruleTouched.has('loan_amount')).toBe(false);
  });
});

describe('applyRules — clear actions', () => {
  it('writes empty string for type=clear', () => {
    const rule: Rule = {
      id: 'r1',
      conditionGroup: {
        connector: 'AND',
        conditions: [{ fieldName: 'financing', op: 'eq', value: 'Cash' }],
      },
      actions: [{ type: 'clear', fieldName: 'state' }],
    };
    const result = applyRules(
      [rule],
      { financing: 'Cash', state: 'CA' },
      new Set(['financing', 'state']),
      FIELDS
    );
    expect(result.newValues.state).toBe('');
  });
});

describe('applyRules — multiple rules', () => {
  it('cascading: rule 2 sees rule 1 effects when evaluating', () => {
    const r1: Rule = {
      id: 'r1',
      conditionGroup: {
        connector: 'AND',
        conditions: [{ fieldName: 'financing', op: 'eq', value: 'Cash' }],
      },
      actions: [{ type: 'set', fieldName: 'loan_amount', value: 0 }],
    };
    const r2: Rule = {
      id: 'r2',
      conditionGroup: {
        connector: 'AND',
        conditions: [{ fieldName: 'loan_amount', op: 'eq', value: 0 }],
      },
      actions: [{ type: 'clear', fieldName: 'state' }],
    };
    const result = applyRules(
      [r1, r2],
      { financing: 'Cash', loan_amount: 99999, state: 'CA' },
      new Set(['financing', 'loan_amount', 'state']),
      FIELDS
    );
    expect(result.newValues.loan_amount).toBe(0);
    expect(result.newValues.state).toBe('');
    expect(result.ruleTouched.get('loan_amount')).toBe('r1');
    expect(result.ruleTouched.get('state')).toBe('r2');
  });

  it('last-writer-wins on same target with same value: no conflict', () => {
    const r1: Rule = {
      id: 'r1',
      conditionGroup: { connector: 'AND', conditions: [{ fieldName: 'financing', op: 'eq', value: 'Cash' }] },
      actions: [{ type: 'set', fieldName: 'loan_amount', value: 0 }],
    };
    const r2: Rule = {
      id: 'r2',
      conditionGroup: { connector: 'AND', conditions: [{ fieldName: 'financing', op: 'eq', value: 'Cash' }] },
      actions: [{ type: 'set', fieldName: 'loan_amount', value: 0 }],
    };
    const result = applyRules(
      [r1, r2],
      { financing: 'Cash' },
      new Set(['financing', 'loan_amount']),
      FIELDS
    );
    expect(result.conflicts).toEqual([]);
    expect(result.ruleTouched.get('loan_amount')).toBe('r2'); // last-writer
  });

  it('detects conflict when two rules write same field with different values', () => {
    const r1: Rule = {
      id: 'r1',
      conditionGroup: { connector: 'AND', conditions: [{ fieldName: 'financing', op: 'eq', value: 'Cash' }] },
      actions: [{ type: 'set', fieldName: 'loan_amount', value: 0 }],
    };
    const r2: Rule = {
      id: 'r2',
      conditionGroup: { connector: 'AND', conditions: [{ fieldName: 'financing', op: 'eq', value: 'Cash' }] },
      actions: [{ type: 'set', fieldName: 'loan_amount', value: 100 }],
    };
    const result = applyRules(
      [r1, r2],
      { financing: 'Cash' },
      new Set(['financing', 'loan_amount']),
      FIELDS
    );
    expect(result.conflicts).toEqual([
      { fieldName: 'loan_amount', ruleIds: ['r1', 'r2'] },
    ]);
    expect(result.newValues.loan_amount).toBe(100); // last write still wins
  });
});

describe('applyRules — condition release (rule no longer fires)', () => {
  it('rule-touched value reverts to baseline when its rule no longer fires', () => {
    const rule: Rule = {
      id: 'r1',
      conditionGroup: { connector: 'AND', conditions: [{ fieldName: 'financing', op: 'eq', value: 'Cash' }] },
      actions: [{ type: 'set', fieldName: 'loan_amount', value: 0 }],
    };
    // Financing flipped to Conventional. Caller passes the baseline (which has loan_amount=undefined).
    // Since the rule doesn't fire, loan_amount stays at baseline.
    const result = applyRules(
      [rule],
      { financing: 'Conventional' }, // no loan_amount in baseline
      new Set(['financing', 'loan_amount']),
      FIELDS
    );
    expect(result.newValues.loan_amount).toBeUndefined();
    expect(result.ruleTouched.has('loan_amount')).toBe(false);
  });
});

describe('applyRules — missing-field actions', () => {
  it('skips action whose target field does not exist', () => {
    const rule: Rule = {
      id: 'r1',
      conditionGroup: { connector: 'AND', conditions: [{ fieldName: 'financing', op: 'eq', value: 'Cash' }] },
      actions: [
        { type: 'set', fieldName: 'does_not_exist', value: 'x' },
        { type: 'set', fieldName: 'loan_amount', value: 0 },
      ],
    };
    const result = applyRules(
      [rule],
      { financing: 'Cash' },
      new Set(['financing', 'loan_amount']),
      FIELDS
    );
    expect(result.newValues.does_not_exist).toBeUndefined();
    expect(result.newValues.loan_amount).toBe(0);
  });
});
