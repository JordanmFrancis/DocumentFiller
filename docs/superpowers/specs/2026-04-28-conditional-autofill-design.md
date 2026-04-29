# Conditional Autofill — Design

**Date:** 2026-04-28
**Status:** Awaiting approval
**Owner:** Jordan Francis

## Problem

Realtors fill out the same handful of contract templates over and over. Within a single contract, choosing one field's value cascades into many others — selecting "Cash" for the financing type implies `loan_amount = $0`, and `lender_name`, `interest_rate`, etc. should be cleared or set to standard values. Across every contract, certain user-level data (full name, license number, brokerage info) repeats verbatim.

Today, Document Filler supports per-template static defaults ([2026-04-27 spec](./2026-04-27-template-default-values-design.md)) but has no way to express:

1. **User-level recurring data** that should pre-fill across every document the user opens.
2. **Conditional logic** within a document — "when field A equals X, set field B to Y."

This design adds both, layered on top of the existing per-template defaults, with two authoring surfaces: a transparent manual rule builder and an LLM chat that drives the same builder via tool-calling.

## Goals (v1)

- **Layered autofill**: user profile defaults → per-template defaults → conditional rules. Each layer can override the previous, and rules can re-fire as triggers change.
- **Manual rule builder UI** that always shows the full rule list — non-negotiable for legal-document audit.
- **LLM chat sidebar** that creates, edits, and explains rules by calling server-side tools (not by emitting JSON the client trusts).
- **Silent rule firing** that respects manual edits — a rule never overwrites a value the user typed.
- **Visible rule effects**: every rule-touched field carries an indicator the user can hover or click to inspect/override.
- **Conflict detection**: when two rules write the same field with different values in one pass, surface a non-blocking warning.
- **Rules persist with the saved blank PDF** (the `PDFDocument` record). Re-opening the same saved doc restores its rules; new uploads start fresh.

## Non-goals (v1)

- Nested condition groups in the UI (the data model supports nesting; the v1 builder ships flat).
- History-inferred rule suggestions ("I noticed you always do X — make it a rule?").
- Cross-document rule reuse / named rule templates / semantic field matching across documents.
- Fuzzy or semantic profile matching — v1 matches profile entries to fields by exact case-insensitive label.
- Multiple user profiles (personal vs brokerage assistant).
- Always-on chat assistant during form fill — chat lives only in the rule editor.
- Rule undo/redo history beyond the immediate Undo button on the most recent LLM tool call.
- Test infra rollout (the rule engine is pure and unit-testable, but a `vitest` decision is deferred — see Open Questions).

These are deliberately deferred; the schema and UI shape leave the door open for each without re-shaping data.

## Existing-code grounding

- [`types/pdf.ts`](../../types/pdf.ts) — `PDFField`, `PDFDocument`, `FormValues`. Will gain an optional `rules?: Rule[]` on `PDFDocument`.
- [`lib/firestore/documents.ts`](../../lib/firestore/documents.ts) — `DocumentData`, `saveDocument`, `updateDocument`, `pruneDefaults`. Pattern to mirror for `pruneRules`.
- [`app/page.tsx`](../../app/page.tsx) — top-level form state. Already tracks `untouchedDefaults: Set<string>` (the pattern we'll extend with a sibling `ruleTouched: Set<string>`). `setFormValues` is the single chokepoint where rule re-evaluation hooks in.
- [`components/FormFieldRenderer.tsx`](../../components/FormFieldRenderer.tsx) — per-row rendering. Natural home for the rule-touched indicator.
- [`app/api/label-fields-vision/route.ts`](../../app/api/label-fields-vision/route.ts) and [`lib/aiLabelGeneratorVision.ts`](../../lib/aiLabelGeneratorVision.ts) — existing pattern for server-side AI calls. The new `app/api/rule-chat/route.ts` mirrors their shape.
- [`components/Layout/Header.tsx`](../../components/Layout/Header.tsx) — gains a "Profile" link in the user dropdown.

## User flows

### Flow A — Realtor sets up a Cash purchase rule via chat

1. Opens a saved purchase agreement, clicks the new "Rules" tab.
2. Two-pane editor opens: left is empty rule list with onboarding text, right is chat.
3. Types: *"if financing is cash, set loan amount to 0 and clear lender name."*
4. LLM calls `add_rule` server-side. The rule appears in the left pane: `When financing = Cash → set loan_amount = 0, clear lender_name`. Chat shows confirmation with Undo.
5. Closes the editor and returns to form-fill view.
6. Selects "Cash" in the financing dropdown. `loan_amount` immediately shows `0` with a `✦` icon, `lender_name` clears with the same icon. No modal, no friction.
7. Hovers `loan_amount` → tooltip "Filled by rule: when financing = Cash". Clicks the icon → field becomes a normal manual edit.

### Flow B — Realtor sets up profile defaults

1. From header dropdown → Profile.
2. Sees pre-populated labels (`Full Name`, `License #`, `Brokerage Name`, …) with empty values. Fills them in. Auto-saves.
3. Opens any saved doc. Fields whose labels match profile entries are pre-filled, with the same `untouched` semantics — rules and manual edits both override.

### Flow C — Editing/auditing rules

1. Opens Rules tab. Sees the rule list.
2. Wants to know why a field auto-filled — types in chat: *"why did closing_days fill in?"*
3. LLM calls `list_rules`, finds matches, replies: *"Rule #2 — when financing = Cash, set closing_days = 14. The rule fired because financing is currently 'Cash'."*
4. Drags rule #5 above rule #2 in the manual builder to resolve a conflict warning. Rule order = firing priority.

## Data model

```ts
// types/rule.ts (new)
export type ConditionOp = 'eq' | 'neq' | 'contains' | 'gt' | 'lt';

export interface RuleCondition {
  fieldName: string;        // trigger field; must exist on the document
  op: ConditionOp;
  value: string | boolean | number;
}

export interface ConditionGroup {
  connector: 'AND' | 'OR';
  conditions: (RuleCondition | ConditionGroup)[];   // recursive — supports nesting
}

export interface RuleAction {
  type: 'set' | 'clear';
  fieldName: string;        // target field
  value?: string | boolean | number;  // required when type === 'set'
}

export interface Rule {
  id: string;
  name?: string;            // optional human label, e.g. "Cash purchase fields"
  conditionGroup: ConditionGroup;
  actions: RuleAction[];
}

// types/pdf.ts (extension)
export interface PDFDocument {
  // ...existing fields
  rules?: Rule[];           // ordered; index = firing priority on conflicts
}

// types/user.ts (extension or new module)
export interface UserProfile {
  uid: string;
  defaults: { label: string; value: string | boolean | number }[];
}
```

`ConditionGroup` is recursive to support arbitrary AND/OR nesting. The v1 UI ships a single flat group with a connector toggle. Nesting is forward-compatible without schema migration.

## Layering on document open

`app/page.tsx` document-open flow extends to:

1. Reset `formValues` to empty.
2. Apply `UserProfile.defaults` — for each profile entry, find a `PDFField` whose `label` matches case-insensitively and is empty; write the value. Field stays `untouched`.
3. Apply `PDFDocument.defaultValues` — overrides profile values for the same fields.
4. Run `applyRules(rules, formValues, untouched)` — any rule whose `conditionGroup` evaluates true fires its actions on untouched fields. Track which rule wrote which field in `ruleTouched`.
5. As the user edits, every `setFormValues` call re-runs `applyRules`. See "Re-evaluation" under the rule engine.

## Rule engine

`lib/ruleEngine.ts` is pure (no I/O, no React). Two exported functions:

```ts
evaluateGroup(group: ConditionGroup, values: FormValues): boolean

applyRules(
  rules: Rule[],
  values: FormValues,
  untouched: Set<string>,
): {
  newValues: FormValues;
  ruleTouched: Map<string, string>;   // fieldName -> ruleId that wrote it this pass
  conflicts: { fieldName: string; ruleIds: string[] }[];
}
```

### Firing model

- **Source of truth for "should I overwrite?"**: a field is overwritable if it is in `untouched` (default-seeded but never user-edited) or in the previous pass's `ruleTouched` (rule-written but never user-edited since). User-edited fields are immutable from rules.
- **Re-evaluation**: every change to `formValues` re-runs `applyRules` against the full rule list. With realistic rule counts (<100 per contract), this is well under a frame.
- **On document open**: run `applyRules` once after defaults are seeded so rules fire even when triggers are pre-populated by `defaultValues` or profile.

### Conflict resolution

- Rules iterate top-to-bottom; later writes to the same field win.
- When two rules write the same field with *different* values in the same pass, the function returns the conflict in `conflicts`. The UI surfaces a yellow warning row in the rule builder ("Rule #2 and Rule #5 both write `loan_amount` — rule #5 wins"). Doesn't block.
- Rule order is editable via drag-handle in the builder — the user's lever for resolving conflicts.

### Condition-released values

Scenario: user picks Cash → rule writes `loan_amount = 0`. Then flips to Conventional. Conditions no longer match.

- Rule-touched values get cleared when the rule that wrote them no longer fires. Track `(fieldName → writingRuleId)` in `ruleTouched`. On re-evaluation, fields whose writing rule is no longer firing get cleared (restored to the underlying default value, if any, or empty).
- If the user manually edited the rule-written value before flipping, it's no longer in `ruleTouched` → don't clear.

### Missing-field handling

A rule may reference a `fieldName` that no longer exists on the document (e.g., the field was deleted or renamed in the visual editor).

- **Conditions:** any `RuleCondition` referencing a missing field evaluates to `false`. Rule firing then depends on the connector — an AND group containing a missing-field condition can never be true; an OR group can still be true if another sibling condition is.
- **Actions:** any `RuleAction` referencing a missing field is a no-op (skipped, but the rest of the rule's actions still apply).
- **UI:** missing-field references are flagged in the rule builder (`⚠️ Rule references missing field "X"`). User must fix or delete.
- `pruneRules(fields, rules)` is called whenever `fieldDefinitions` is replaced wholesale (parallel to existing `pruneDefaults`). It does *not* delete rules — it only flags them — because field renames are common during PDF editing and silent rule deletion would destroy the user's work.

### Action-value validation

`RuleAction.value` is typed as optional in the schema but is *required when `type === 'set'`*. This is enforced server-side in the LLM tool route and client-side in the manual builder before save. A `set` action with no value is rejected with a clear error.

## Manual rule builder UI

Lives in the left pane of the new "Rules" tab on a saved document.

```
components/Rules/
├── RuleEditor.tsx          // two-pane container (this section + chat)
├── RuleList.tsx            // ordered list of rules, drag-to-reorder
├── RuleRow.tsx             // collapsed/expanded rule
├── ConditionInput.tsx      // [field][op][value] picker, type-aware
└── ActionInput.tsx         // [set|clear][field][=value] picker
```

### Row layout (collapsed)

```
≡  When financing = Cash    →  set loan_amount = 0, clear lender_name      [⋯]
```

- `≡` = drag handle (rule order = firing priority).
- Plain-English summary generated from the structured data.
- `⋯` menu = expand/edit, duplicate, delete.

### Expanded edit form

- **Conditions block**: `[+ Add condition]`. Each condition row is `[field ▾] [op ▾] [value]`. Fields render by their `label`, not internal `name`. Value input adapts to field type — dropdown for radio/select fields, text for text, date for date. Connector toggle: `All of these (AND) | Any of these (OR)`. Sub-groups (nested) are not exposed in v1; the recursive data model is in place for v2.
- **Actions block**: `[+ Add action]`. Each action is `[Set | Clear] [field ▾] [= value]`. Same field/value pickers.

### On the form-fill view

- Rule-touched fields display a `✦` icon next to the label in [`components/FormFieldRenderer.tsx`](../../components/FormFieldRenderer.tsx). Hover → "Filled by rule: when financing = Cash". Click → toggle back to manual override (removes from `ruleTouched`, treats as user-edited going forward).
- Rules with `conflicts` get a yellow `⚠ Conflicts with Rule #N` badge in the builder.

### Empty state

`"No rules yet. Type a sentence in the chat or click + Add rule."` — bridges new users into the chat.

## LLM chat (translator + audit)

Right pane of the rule editor. Single conversation per document, persisted alongside `rules` so chat history survives reloads.

### Architecture: tool-calling, not parsing

The LLM does not return rule JSON for the client to apply. It calls server-side tools that mutate the rule list. New API route `app/api/rule-chat/route.ts` proxies to the model with a fixed tool surface:

```ts
add_rule({ name?, conditionGroup, actions }): { ruleId }
edit_rule({ ruleId, conditionGroup?, actions?, name? }): { ok }
delete_rule({ ruleId }): { ok }              // requires explicit user confirmation in chat
list_rules(): Rule[]                          // grounds /explain answers
explain_rule({ ruleId }): { plainEnglish }    // optional helper; can be done client-side too
```

### Per-turn context (system prompt)

- The document's `fieldDefinitions` (name, label, type, options) — so the model uses real field names and valid option values.
- The current `rules` array — so it knows what already exists.
- Recent chat messages.

### Why server-side tool calls (not "parse-then-apply" client-side)

- API key stays server-side, matching the existing pattern in [`app/api/label-fields-vision/route.ts`](../../app/api/label-fields-vision/route.ts).
- Tool inputs are validated against a schema before they touch the rule list — bad rules can't slip through.
- Each successful tool result is sent back to the client and the manual builder updates live, so the user sees exactly what the LLM did.

### Confirmation pattern

- `add_rule` and `edit_rule` results render an inline diff in chat: `✓ Added: When financing = Cash, set loan_amount = 0 [Undo]`.
- `delete_rule` always asks for confirmation in chat ("Delete rule #3? Yes / No") before applying. Destructive enough to warrant the click.

### `/explain` flow

- User types "why did loan_amount auto-fill?" or `/explain loan_amount`.
- Model calls `list_rules()`, finds rules whose actions target `loan_amount`, returns plain-English: *"Rule #3 — when financing = Cash, set loan_amount to 0. The rule is currently firing because financing = 'Cash'."*

### Failure / ambiguity

- System prompt instructs the model to ask a clarifying question rather than guess on ambiguous mappings: *"If multiple fields could match, ask the user to pick one. Never guess on legal-document fields."*

## Profile defaults (global)

The user-level recurring-data layer.

### Data shape (recapped from data model)

```ts
UserProfile { uid: string; defaults: { label: string; value: ... }[] }
```

### UI

- New route `app/profile/page.tsx`. Accessed from a "Profile" link added to the existing header dropdown ([`components/Layout/Header.tsx`](../../components/Layout/Header.tsx)).
- Two-column form: `Field label | Value`, plus `+ Add field` and `× Remove`. No grouping.
- **Realtor seed data**: first time the user opens the page, pre-populate the labels (empty values) with: `Full Name`, `License #`, `Brokerage Name`, `Brokerage Address`, `Brokerage Phone`, `Email`. Editable/deletable. Reduces blank-page friction without imposing a fixed schema.

### Matching algorithm (v1)

- On document open, after `defaultValues` are seeded, walk each form field and look up its `label` in the profile's `defaults` (case-insensitive trim match).
- If a match exists *and the field is still empty after defaults*, write the profile value. Field counts as `untouched` so rules and manual edits can both override.
- "Empty" means the form value for that field is `undefined`, `null`, or an empty string. Boolean (checkbox) fields are never "empty" — they're either `true` or `false` — so profile defaults are not applied to checkbox fields.
- No fuzzy matching in v1. Wrong matches on legal documents are worse than no match. Users can rename a profile entry to match a field if needed.

### Update propagation

- Editing a profile value does **not** retroactively rewrite already-filled documents. Profile applies only on document open to empty-after-defaults fields. Consistent with the "respect manual edits" principle.

## Implementation surface

```
+ types/rule.ts                            // Rule, RuleCondition, ConditionGroup, RuleAction
~ types/pdf.ts                             // PDFDocument.rules?: Rule[]
~ types/user.ts                            // UserProfile

+ lib/ruleEngine.ts                        // pure: evaluateGroup, applyRules
+ lib/firestore/rules.ts                   // CRUD for rules + chat history
+ lib/firestore/profile.ts                 // CRUD for UserProfile
~ lib/firestore/documents.ts               // extend DocumentData; add pruneRules sibling

+ app/api/rule-chat/route.ts               // LLM tool-calling endpoint
+ app/profile/page.tsx                     // profile editor route

+ components/Rules/RuleEditor.tsx          // two-pane container
+ components/Rules/RuleList.tsx            // ordered rule rows + drag-reorder
+ components/Rules/RuleRow.tsx             // collapsed/expanded rule
+ components/Rules/ConditionInput.tsx      // [field][op][value] picker, type-aware
+ components/Rules/ActionInput.tsx         // [set|clear][field][=value] picker
+ components/Rules/RuleChat.tsx            // chat pane, streams tool-call results
~ components/FormFieldRenderer.tsx         // ✦ icon + tooltip for rule-touched fields

~ app/page.tsx                             // hook ruleEngine into formValues setter; track ruleTouched
~ components/Layout/Header.tsx             // "Profile" link in user dropdown
```

### Existing patterns to follow

- API route + AI service plumbing: copy [`app/api/label-fields-vision/route.ts`](../../app/api/label-fields-vision/route.ts) and [`lib/aiLabelGeneratorVision.ts`](../../lib/aiLabelGeneratorVision.ts).
- Firestore CRUD: copy [`lib/firestore/documents.ts`](../../lib/firestore/documents.ts) (`removeUndefined`, `Timestamp.now()`, `setDoc` / `updateDoc`).
- Untouched-field tracking: extend the existing `untouchedDefaults: Set<string>` in [`app/page.tsx`](../../app/page.tsx) with a parallel `ruleTouched: Set<string>` consumed by the engine.
- `pruneDefaults` in [`lib/firestore/documents.ts`](../../lib/firestore/documents.ts) — add a sibling `pruneRules` that drops rules referencing missing field names.

### Testability

- `lib/ruleEngine.ts` is pure. Unit tests fit naturally in `lib/__tests__/ruleEngine.test.ts`. The repo currently has no test runner; adding `vitest` is in scope for v1 if we want shipped tests, otherwise a manual test plan covers the engine. See Open Questions.
- `RuleEditor` and `RuleChat` are component-tested by hand for v1.

## Security and validation

- LLM tool inputs are validated server-side (in `app/api/rule-chat/route.ts`) before mutation. A schema validator (probably `zod`) rejects rules that reference non-existent fields, use unsupported operators, or violate type expectations (e.g., a `gt` op on a checkbox field).
- Profile values and rule actions are scoped per user via Firebase Auth — `firestore.rules` updates ensure only the owning user can read/write their profile and document rules.

## Open questions

These don't block the implementation plan; surface them at plan-writing time:

1. **Test runner decision** — add `vitest` for the rule engine tests as part of v1, or defer with a manual test plan? Recommendation: add it; the rule engine genuinely benefits from regression coverage.
2. **Schema validation library** — `zod` is the obvious choice but isn't currently a dep. Acceptable to add?
3. **Chat history retention** — store full conversation transcripts on `PDFDocument`? Cap message count? Recommendation: store last 50 turns per document; older ones are dropped.
4. **Model choice for `rule-chat`** — match what the existing AI labeling routes use, or a smaller/faster model since the tool surface is narrow? Decide at plan time after benchmarking.
5. **Anthropic vs OpenAI** — the existing AI labeling routes pick one provider; the new route should match.
