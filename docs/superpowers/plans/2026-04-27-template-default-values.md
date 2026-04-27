# Template Default Values Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users pin per-field default values on a saved template (`PDFDocument`) so they pre-fill on next open. Edits override only the current fill; a soft "Update default?" prompt appears inline when current value diverges from the saved default.

**Architecture:** Add a `defaultValues: Record<fieldName, value>` map directly on `PDFDocument` in Firestore — parallel in shape to `formValues`, so a one-line spread seeds the form on load. Track which pre-filled fields the user hasn't touched yet via a `Set<string>` (`untouchedDefaults`) to drive a muted text style until first interaction. Pin / unpin / update-default each writes a single Firestore patch using the existing `updateDocument` pattern with optimistic local state and revert-on-failure (mirrors how label edits already work at [app/page.tsx:247](../../app/page.tsx)).

**Tech Stack:** Next.js 14 (App Router), TypeScript (`strict: true`), Firestore (modular SDK), Tailwind, lucide-react, framer-motion.

**Spec:** [docs/superpowers/specs/2026-04-27-template-default-values-design.md](../specs/2026-04-27-template-default-values-design.md)

---

## Verification approach

The codebase has **no test framework configured** (no Jest / Vitest / Playwright). The spec calls for "no new dependencies." Verification per task therefore relies on:

- **`npx tsc --noEmit`** — fast type check (TypeScript is in `strict` mode)
- **`npm run lint`** — Next.js / ESLint
- **`npm run build`** — full Next.js build (typecheck + bundle); use at phase boundaries
- **`npm run dev`** — `http://localhost:3000`, manual UI check (after auth, the app needs at least one saved document for several tasks)

If you discover a test framework was added between when this plan was written and now, prefer adding tests for new logic. Otherwise rely on the manual checks listed in each task.

## File structure

| File | Role | Status |
|---|---|---|
| `types/pdf.ts` | Shared types | Modify — add `defaultValues?` to `PDFDocument` |
| `lib/firestore/documents.ts` | Firestore CRUD + helpers | Modify — extend `DocumentData`; add `pruneDefaults` helper |
| `app/page.tsx` | Top-level form orchestration | Modify — new state, load logic, pin/unpin/update handlers, prune at editor return sites |
| `components/FormFieldRenderer.tsx` | Renders form rows | Modify — pin button in label row, soft prompt below input, pass `isPristineDefault` to inputs |
| `components/FieldInput.tsx` | Per-field input | Modify — accept `isPristineDefault` prop, apply muted/italic class |
| `components/PDFFieldCreator.tsx` | Field creator modal | **No change** (writes go through `app/page.tsx`'s `handleFieldsCreated`) |
| `components/PDFViewerEditor.tsx` | Field editor modal | **No change** (writes go through `app/page.tsx`'s `onFieldsChange` prop callback) |

No new files. No new dependencies. `Pin` and `RotateCcw` icons are already available in `lucide-react`.

---

## Phase 1 — Data layer

### Task 1: Add `defaultValues` to `PDFDocument` type

**Files:**
- Modify: `types/pdf.ts`

- [ ] **Step 1: Edit `types/pdf.ts`** — add the optional `defaultValues` field to `PDFDocument`.

```ts
export interface PDFDocument {
  id: string;
  name: string;
  originalPdfUrl: string;
  fieldDefinitions: PDFField[];
  defaultValues?: Record<string, string | boolean | number>;
  createdAt: Date;
  updatedAt: Date;
  filledPdfs?: FilledPDF[];
}
```

- [ ] **Step 2: Type check.**

Run: `npx tsc --noEmit`
Expected: zero errors. The new field is optional and additive; nothing else should break.

- [ ] **Step 3: Commit.**

```bash
git add types/pdf.ts
git commit -m "types: add defaultValues map to PDFDocument"
```

---

### Task 2: Add `defaultValues` to Firestore `DocumentData`

**Files:**
- Modify: `lib/firestore/documents.ts`

- [ ] **Step 1: Edit `DocumentData` interface** at the top of `lib/firestore/documents.ts`. Add `defaultValues?` mirroring the type from `PDFDocument`:

```ts
export interface DocumentData {
  name: string;
  originalPdfUrl: string;
  fieldDefinitions: PDFField[];
  defaultValues?: Record<string, string | boolean | number>;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  userId: string;
  filledPdfs?: Array<{
    id: string;
    downloadUrl: string;
    createdAt: Timestamp;
    formValues: Record<string, any>;
  }>;
}
```

(The `filledPdfs` shape is unchanged — listed in full because we touched the interface.)

- [ ] **Step 2: Type check.**

Run: `npx tsc --noEmit`
Expected: zero errors. Existing callers of `saveDocument` / `updateDocument` keep working because the new field is optional.

- [ ] **Step 3: Commit.**

```bash
git add lib/firestore/documents.ts
git commit -m "firestore: add defaultValues to DocumentData"
```

---

### Task 3: Add `pruneDefaults` helper

A small pure function that drops orphaned default entries when their underlying field no longer exists. Centralized here so both call sites (in `app/page.tsx`) use the same logic.

**Files:**
- Modify: `lib/firestore/documents.ts`

- [ ] **Step 1: Add the helper export** at the bottom of `lib/firestore/documents.ts`, after `addFilledPDF`:

```ts
/**
 * Drops entries from a defaults map whose field no longer exists.
 * Use whenever fieldDefinitions is replaced wholesale (e.g. via the
 * field creator or visual editor).
 */
export function pruneDefaults(
  fields: PDFField[],
  defaults: Record<string, string | boolean | number> | undefined
): Record<string, string | boolean | number> {
  if (!defaults) return {};
  const validNames = new Set(fields.map((f) => f.name));
  return Object.fromEntries(
    Object.entries(defaults).filter(([name]) => validNames.has(name))
  );
}
```

- [ ] **Step 2: Type check.**

Run: `npx tsc --noEmit`
Expected: zero errors.

- [ ] **Step 3: Phase 1 build check.**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 4: Commit.**

```bash
git add lib/firestore/documents.ts
git commit -m "firestore: add pruneDefaults helper"
```

---

## Phase 2 — Load & pre-fill behavior

### Task 4: Add `untouchedDefaults` state to the page

This new state tracks fields whose displayed value came from a saved default and the user has not interacted with yet. It will drive the muted text styling in Phase 3.

**Files:**
- Modify: `app/page.tsx`

- [ ] **Step 1: Add the state declaration.** Open `app/page.tsx` and find the existing `useState` block around lines 39-55. Add this line directly after the `formValues` state declaration (currently line 42: `const [formValues, setFormValues] = useState<FormValues>({});`):

```tsx
const [untouchedDefaults, setUntouchedDefaults] = useState<Set<string>>(new Set());
```

- [ ] **Step 2: Type check.**

Run: `npx tsc --noEmit`
Expected: zero errors.

- [ ] **Step 3: Commit.**

```bash
git add app/page.tsx
git commit -m "page: add untouchedDefaults state"
```

---

### Task 5: Seed `formValues` + `untouchedDefaults` on document open

**Files:**
- Modify: `app/page.tsx`

- [ ] **Step 1: Update `handleDocumentSelect`.** Find this function (starts around line 315). Two changes inside it.

(a) At the top of the function (currently `setFormValues({});` at line 317), replace with the seeding logic. The full opening of the function should now read:

```tsx
const handleDocumentSelect = async (doc: PDFDocument) => {
  setCurrentDocument(doc);
  setFormValues({ ...(doc.defaultValues ?? {}) });
  setUntouchedDefaults(new Set(Object.keys(doc.defaultValues ?? {})));
  setViewMode('loading');
  setProcessing(true);
  // ...rest of the function unchanged
```

- [ ] **Step 2: Update `handleFileSelect`.** This handles fresh uploads (not opening a saved doc) — defaults must be reset to empty. Find around line 174 (`setFormValues({});` after the field detection succeeds). Replace that single line with two lines:

```tsx
setFormValues({});
setUntouchedDefaults(new Set());
```

- [ ] **Step 3: Update `handleNewDocument`.** This resets state when navigating back to upload view. Find around line 395 (currently sets `formValues` to `{}`). Replace the single `setFormValues({});` line with:

```tsx
setFormValues({});
setUntouchedDefaults(new Set());
```

Note: there are two other `setFormValues({})` sites in the file (line ~272 in `handleSaveDocument`, and the back-button handler at ~line 668). Both are fine without an `untouchedDefaults` reset — at first-save time the set is already empty, and the back-button path doesn't need a reset because the next `handleDocumentSelect` replaces the set wholesale.

- [ ] **Step 4: Type check.**

Run: `npx tsc --noEmit`
Expected: zero errors.

- [ ] **Step 5: Manual smoke test.**

Run: `npm run dev`. Open the app, sign in, select an existing saved document. The form opens as before (no visual change yet — defaults map is empty for existing docs). Confirm the form behaves normally and the progress counter still tracks fills correctly.

- [ ] **Step 6: Commit.**

```bash
git add app/page.tsx
git commit -m "page: seed formValues from doc.defaultValues on open"
```

---

### Task 6: Drop fields from `untouchedDefaults` on first interaction

**Files:**
- Modify: `app/page.tsx`

- [ ] **Step 1: Update `handleFormChange`** (around line 235). Currently:

```tsx
const handleFormChange = (fieldName: string, value: any) => {
  setFormValues((prev) => ({ ...prev, [fieldName]: value }));
  setAutoSavedAt(new Date());
};
```

Replace with:

```tsx
const handleFormChange = (fieldName: string, value: any) => {
  setFormValues((prev) => ({ ...prev, [fieldName]: value }));
  setUntouchedDefaults((prev) => {
    if (!prev.has(fieldName)) return prev;
    const next = new Set(prev);
    next.delete(fieldName);
    return next;
  });
  setAutoSavedAt(new Date());
};
```

The `if (!prev.has(...)) return prev` guard avoids an unnecessary re-render when the field wasn't pristine to begin with.

- [ ] **Step 2: Update `handleFieldFocus`** (around line 418). Currently:

```tsx
const handleFieldFocus = (fieldName: string) => {
  setActiveFieldName(fieldName);
};
```

Replace with:

```tsx
const handleFieldFocus = (fieldName: string) => {
  setActiveFieldName(fieldName);
  setUntouchedDefaults((prev) => {
    if (!prev.has(fieldName)) return prev;
    const next = new Set(prev);
    next.delete(fieldName);
    return next;
  });
};
```

- [ ] **Step 3: Type check.**

Run: `npx tsc --noEmit`
Expected: zero errors.

- [ ] **Step 4: Commit.**

```bash
git add app/page.tsx
git commit -m "page: drop fields from untouchedDefaults on touch"
```

---

## Phase 3 — Visual treatment for pre-filled values

### Task 7: Add `isPristineDefault` prop to `FieldInput`

**Files:**
- Modify: `components/FieldInput.tsx`

- [ ] **Step 1: Update `FieldInputProps`.** Around line 6:

```tsx
interface FieldInputProps {
  field: PDFField;
  value: any;
  onChange: (value: any) => void;
  onFocus?: () => void;
  error?: string;
  isPristineDefault?: boolean;
}
```

- [ ] **Step 2: Update the function signature.** Around line 14:

```tsx
export default function FieldInput({
  field,
  value,
  onChange,
  onFocus,
  error,
  isPristineDefault,
}: FieldInputProps) {
```

- [ ] **Step 3: Compute the muted class.** Add this single line right after the `handleChange` declaration (around line 20, before the `return`):

```tsx
const pristineClass = isPristineDefault ? 'italic text-ink-faint' : '';
```

- [ ] **Step 4: Apply `pristineClass` to text/date/number/select inputs.** Update the four `className` strings inside the `return`:

  - Line ~35: text input — change `className="input"` to ``className={`input ${pristineClass}`}``
  - Line ~47: date input — same change
  - Line ~58: number input — same change
  - Line ~84: select — change `className="input cursor-pointer"` to ``className={`input cursor-pointer ${pristineClass}`}``

(Checkbox is intentionally skipped — boolean state isn't a "value" you'd want greyed out, and `field.defaultValue` already controls the visual checked state via line 67.)

- [ ] **Step 5: Type check.**

Run: `npx tsc --noEmit`
Expected: zero errors.

- [ ] **Step 6: Commit.**

```bash
git add components/FieldInput.tsx
git commit -m "field-input: accept isPristineDefault prop for muted styling"
```

---

### Task 8: Wire `isPristineDefault` through `FormFieldRenderer`

**Files:**
- Modify: `components/FormFieldRenderer.tsx`
- Modify: `app/page.tsx`

- [ ] **Step 1: Extend `FormFieldRendererProps`** (around line 10 in `FormFieldRenderer.tsx`):

```tsx
interface FormFieldRendererProps {
  fields: PDFField[];
  values: FormValues;
  onChange: (fieldName: string, value: any) => void;
  onLabelChange?: (fieldName: string, newLabel: string) => void;
  onFieldFocus?: (fieldName: string) => void;
  activeFieldName?: string | null;
  errors?: Record<string, string>;
  editableLabels?: boolean;
  untouchedDefaults?: Set<string>;
}
```

- [ ] **Step 2: Destructure the new prop** (around line 62):

```tsx
export default function FormFieldRenderer({
  fields,
  values,
  onChange,
  onLabelChange,
  onFieldFocus,
  activeFieldName,
  errors,
  editableLabels = true,
  untouchedDefaults,
}: FormFieldRendererProps) {
```

- [ ] **Step 3: Pass `isPristineDefault` to `FieldInput`.** Find the `<FieldInput ... />` call inside the row (around line 148). Add the prop:

```tsx
<FieldInput
  field={field}
  value={values[field.name]}
  onChange={(value) => onChange(field.name, value)}
  onFocus={onFieldFocus ? () => onFieldFocus(field.name) : undefined}
  error={errors?.[field.name]}
  isPristineDefault={untouchedDefaults?.has(field.name) ?? false}
/>
```

- [ ] **Step 4: Pass `untouchedDefaults` from `app/page.tsx`.** Find the `<FormFieldRenderer ... />` invocation in the form view (around line 704). Add the new prop:

```tsx
<FormFieldRenderer
  fields={fields}
  values={formValues}
  onChange={handleFormChange}
  onLabelChange={handleLabelChange}
  onFieldFocus={handleFieldFocus}
  activeFieldName={activeFieldName}
  editableLabels={true}
  untouchedDefaults={untouchedDefaults}
/>
```

- [ ] **Step 5: Type check.**

Run: `npx tsc --noEmit`
Expected: zero errors.

- [ ] **Step 6: Phase 3 build check.**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 7: Manual UI smoke test.**

Run: `npm run dev`. Manually patch a saved document in the dev environment to add a `defaultValues` map (via the Firebase console or a one-off script) — e.g. set `defaultValues: { <some-field-name>: "Test Default" }`. Reopen the document in the app. Confirm the field shows "Test Default" in muted/italic styling. Click into the field — it snaps to normal styling.

If you can't easily edit Firestore directly, defer this manual check to Task 10 once the pin button is wired.

- [ ] **Step 8: Commit.**

```bash
git add components/FormFieldRenderer.tsx app/page.tsx
git commit -m "form-renderer: pass isPristineDefault from untouchedDefaults set"
```

---

## Phase 4 — Pin button

### Task 9: Add the pin button UI to `FormFieldRenderer`

This task only adds the visual button and tooltips. Click handlers are wired in Task 10.

**Files:**
- Modify: `components/FormFieldRenderer.tsx`

- [ ] **Step 1: Update icon imports.** At the top of `FormFieldRenderer.tsx` (around line 8):

```tsx
import { Eye, Check, Pin } from 'lucide-react';
```

- [ ] **Step 2: Extend `FormFieldRendererProps`** with the pin-related props:

```tsx
interface FormFieldRendererProps {
  fields: PDFField[];
  values: FormValues;
  onChange: (fieldName: string, value: any) => void;
  onLabelChange?: (fieldName: string, newLabel: string) => void;
  onFieldFocus?: (fieldName: string) => void;
  activeFieldName?: string | null;
  errors?: Record<string, string>;
  editableLabels?: boolean;
  untouchedDefaults?: Set<string>;
  defaultValues?: Record<string, string | boolean | number>;
  onPin?: (fieldName: string) => void;
  onUnpin?: (fieldName: string) => void;
  canPin?: boolean;
}
```

- [ ] **Step 3: Destructure the new props** in the function signature:

```tsx
export default function FormFieldRenderer({
  fields,
  values,
  onChange,
  onLabelChange,
  onFieldFocus,
  activeFieldName,
  errors,
  editableLabels = true,
  untouchedDefaults,
  defaultValues,
  onPin,
  onUnpin,
  canPin = true,
}: FormFieldRendererProps) {
```

- [ ] **Step 4: Add a small helper above the component** (right after `groupIntoSections` function, before the component definition) for the per-field pin enable rule:

```tsx
function isPinnableValue(field: PDFField, value: any): boolean {
  if (field.type === 'checkbox') return value === true;
  if (value === undefined || value === null) return false;
  if (typeof value === 'string' && value.trim() === '') return false;
  return true;
}
```

- [ ] **Step 5: Render the pin button inside the label row.** Inside the `section.fields.map` callback, find the `<div className="mb-1.5 flex items-center gap-2">` block (around line 113). It currently contains: label editor, completion check, required `*`, eye button. Add the pin button between the required `*` span and the eye button — so the order is: `label` → `check` → `required` → **pin** → `eye`.

Insert this block right before the existing `{onFieldFocus && field.position && (...)}` eye-button block:

```tsx
{(onPin || onUnpin) && (() => {
  const hasDefault = defaultValues?.[field.name] !== undefined;
  const fieldValue = values[field.name];
  const canPinNow = canPin && isPinnableValue(field, fieldValue);
  const disabled = !hasDefault && !canPinNow;
  let title: string;
  if (hasDefault) {
    title = 'Remove saved default';
  } else if (!canPin) {
    title = 'Save the template first to pin defaults';
  } else if (!canPinNow) {
    title = 'Type a value to pin as default';
  } else {
    title = 'Pin this value as the default';
  }
  return (
    <button
      type="button"
      onClick={() => {
        if (disabled) return;
        if (hasDefault) onUnpin?.(field.name);
        else onPin?.(field.name);
      }}
      disabled={disabled}
      className={`p-1 rounded transition-all ${
        hasDefault
          ? 'text-accent hover:bg-accent-tint'
          : disabled
          ? 'text-ink-faint opacity-50 cursor-not-allowed'
          : 'text-ink-faint hover:text-ink hover:bg-paper-edge'
      }`}
      title={title}
      aria-label={title}
    >
      <Pin
        className="w-3.5 h-3.5"
        fill={hasDefault ? 'currentColor' : 'none'}
        strokeWidth={1.8}
      />
    </button>
  );
})()}
```

The IIFE keeps the per-row computation local without polluting the outer render with a separate component.

- [ ] **Step 6: Type check.**

Run: `npx tsc --noEmit`
Expected: zero errors.

- [ ] **Step 7: Visual check.**

Run: `npm run dev`. Open a saved document. Confirm:
- A hollow pin icon is now visible on every field row, alongside the eye icon.
- Hovering changes its color subtly.
- Empty fields show the pin in a faded/disabled state with the "Type a value to pin as default" tooltip on hover.
- Filling in a value enables the pin (color shifts to interactive).

Click does nothing yet — that's wired in Task 10.

- [ ] **Step 8: Commit.**

```bash
git add components/FormFieldRenderer.tsx
git commit -m "form-renderer: add pin button with tooltips (no handlers yet)"
```

---

### Task 10: Wire pin / unpin callbacks in `app/page.tsx`

**Files:**
- Modify: `app/page.tsx`

- [ ] **Step 1: Add the pin handler.** In `app/page.tsx`, add this function alongside the other handlers (e.g. directly above `handleFieldsCreated` around line 422):

```tsx
const handlePin = async (fieldName: string) => {
  if (!currentDocument) return;
  const value = formValues[fieldName];
  // isPinnableValue guard happens in the UI; this is a defensive check.
  if (value === undefined || value === null || value === '' || value === false) return;

  const prevDefaults = currentDocument.defaultValues ?? {};
  const nextDefaults = { ...prevDefaults, [fieldName]: value };

  setCurrentDocument({ ...currentDocument, defaultValues: nextDefaults });
  try {
    await updateDocument(currentDocument.id, { defaultValues: nextDefaults });
  } catch (error) {
    console.warn('Error pinning default:', error);
    setCurrentDocument({ ...currentDocument, defaultValues: prevDefaults });
  }
};

const handleUnpin = async (fieldName: string) => {
  if (!currentDocument) return;
  const prevDefaults = currentDocument.defaultValues ?? {};
  const nextDefaults = { ...prevDefaults };
  delete nextDefaults[fieldName];

  setCurrentDocument({ ...currentDocument, defaultValues: nextDefaults });
  try {
    await updateDocument(currentDocument.id, { defaultValues: nextDefaults });
  } catch (error) {
    console.warn('Error unpinning default:', error);
    setCurrentDocument({ ...currentDocument, defaultValues: prevDefaults });
  }
};
```

- [ ] **Step 2: Pass props to `FormFieldRenderer`.** Update the `<FormFieldRenderer />` invocation (around line 704) to include the four new props:

```tsx
<FormFieldRenderer
  fields={fields}
  values={formValues}
  onChange={handleFormChange}
  onLabelChange={handleLabelChange}
  onFieldFocus={handleFieldFocus}
  activeFieldName={activeFieldName}
  editableLabels={true}
  untouchedDefaults={untouchedDefaults}
  defaultValues={currentDocument?.defaultValues}
  onPin={handlePin}
  onUnpin={handleUnpin}
  canPin={!!currentDocument}
/>
```

- [ ] **Step 3: Type check.**

Run: `npx tsc --noEmit`
Expected: zero errors.

- [ ] **Step 4: Manual end-to-end test.**

Run: `npm run dev`. Open a saved document, fill a text field, click the pin → it turns solid accent-colored. Refresh the page (or close and reopen the document from the list). The field should be pre-filled with that value, in muted/italic styling. Click into the field — styling snaps to normal.

Click the filled pin → it returns to hollow. Refresh; the field is no longer pre-filled.

Test the unsaved-template case: from the list view, click "New document," upload a PDF without saving. Confirm pin buttons are disabled with the "Save the template first" tooltip.

- [ ] **Step 5: Commit.**

```bash
git add app/page.tsx
git commit -m "page: wire pin/unpin handlers with optimistic updates"
```

---

## Phase 5 — Soft "Update default?" prompt

### Task 11: Render the inline prompt in `FormFieldRenderer`

**Files:**
- Modify: `components/FormFieldRenderer.tsx`

- [ ] **Step 1: Extend imports** at the top:

```tsx
import { Eye, Check, Pin, RotateCcw } from 'lucide-react';
```

- [ ] **Step 2: Extend props with the update callback:**

```tsx
interface FormFieldRendererProps {
  // ...existing props
  onUpdateDefault?: (fieldName: string) => void;
}
```

And destructure it in the signature alongside the other pin props:

```tsx
onUpdateDefault,
```

- [ ] **Step 3: Add a value-formatting helper above the component** (next to `isPinnableValue`):

```tsx
function formatDefaultPreview(field: PDFField, value: any): string {
  if (field.type === 'checkbox') return value ? 'checked' : 'unchecked';
  const str = String(value ?? '');
  const trimmed = str.length > 30 ? `${str.slice(0, 30)}…` : str;
  return `"${trimmed}"`;
}
```

- [ ] **Step 4: Render the prompt directly after `<FieldInput ... />`** inside the row's enclosing `<div>`. Find the `<FieldInput ... />` block (it now ends with the `isPristineDefault` prop from Task 8). Right after the closing `/>`, add:

```tsx
{onUpdateDefault && defaultValues && (() => {
  const stored = defaultValues[field.name];
  const current = values[field.name];
  if (stored === undefined) return null;
  // Prompt only when current is non-empty and differs from stored.
  if (current === undefined || current === null || current === '') return null;
  if (current === stored) return null;
  return (
    <button
      type="button"
      onClick={() => onUpdateDefault(field.name)}
      className="mt-1.5 inline-flex items-center gap-1 text-[12px] text-accent hover:underline"
    >
      <RotateCcw className="w-3 h-3" />
      Update default to {formatDefaultPreview(field, current)}
    </button>
  );
})()}
```

- [ ] **Step 5: Type check.**

Run: `npx tsc --noEmit`
Expected: zero errors.

- [ ] **Step 6: Commit.**

```bash
git add components/FormFieldRenderer.tsx
git commit -m "form-renderer: render inline 'Update default?' prompt"
```

---

### Task 12: Wire the update-default callback

**Files:**
- Modify: `app/page.tsx`

- [ ] **Step 1: Add `handleUpdateDefault`** alongside `handlePin` / `handleUnpin`:

```tsx
const handleUpdateDefault = async (fieldName: string) => {
  if (!currentDocument) return;
  const value = formValues[fieldName];
  if (value === undefined || value === null || value === '') return;

  const prevDefaults = currentDocument.defaultValues ?? {};
  const nextDefaults = { ...prevDefaults, [fieldName]: value };

  setCurrentDocument({ ...currentDocument, defaultValues: nextDefaults });
  try {
    await updateDocument(currentDocument.id, { defaultValues: nextDefaults });
  } catch (error) {
    console.warn('Error updating default:', error);
    setCurrentDocument({ ...currentDocument, defaultValues: prevDefaults });
  }
};
```

(Functionally similar to `handlePin`. They're kept separate for clarity at the call sites; if you'd rather DRY them up later, that's fine — both set `defaultValues[name] = currentValue`.)

- [ ] **Step 2: Pass the callback to `FormFieldRenderer`:**

```tsx
<FormFieldRenderer
  fields={fields}
  values={formValues}
  onChange={handleFormChange}
  onLabelChange={handleLabelChange}
  onFieldFocus={handleFieldFocus}
  activeFieldName={activeFieldName}
  editableLabels={true}
  untouchedDefaults={untouchedDefaults}
  defaultValues={currentDocument?.defaultValues}
  onPin={handlePin}
  onUnpin={handleUnpin}
  onUpdateDefault={handleUpdateDefault}
  canPin={!!currentDocument}
/>
```

- [ ] **Step 3: Type check.**

Run: `npx tsc --noEmit`
Expected: zero errors.

- [ ] **Step 4: Manual end-to-end test.**

Run: `npm run dev`. Open a saved document with a pinned default (carry over from Task 10). Confirm the pre-filled value loads in muted styling and there is **no** "Update default?" prompt. Click the field, edit the value to something different. The prompt should now appear below the input. Click it — the prompt disappears, the pin stays solid. Refresh the document — the new value is now pre-filled.

Edit the field back to match the saved default → prompt disappears. Clear the field → prompt disappears.

- [ ] **Step 5: Commit.**

```bash
git add app/page.tsx
git commit -m "page: wire handleUpdateDefault for soft prompt"
```

---

## Phase 6 — Field-deletion pruning

### Task 13: Prune orphaned defaults at field-edit return sites

When a user removes a field via the field creator or visual editor, any default keyed to that field becomes orphaned. Prune at the two write sites in `app/page.tsx`.

**Files:**
- Modify: `app/page.tsx`

- [ ] **Step 1: Add the import** at the top of `app/page.tsx`. Find the existing import line for `documents.ts` (around line 15):

```tsx
import { saveDocument, getUserDocuments, deleteDocument, updateDocument, pruneDefaults } from '@/lib/firestore/documents';
```

- [ ] **Step 2: Update `handleFieldsCreated`** (around line 422). Inside the `if (currentDocument && user)` block, replace the `updateDocument(...)` call. The full block becomes:

```tsx
if (currentDocument && user) {
  try {
    const pdfPath = `users/${user.uid}/documents/${currentDocument.id}/original.pdf`;
    await uploadPDF(modifiedFile, pdfPath);
    const prunedDefaults = pruneDefaults(createdFields, currentDocument.defaultValues);
    await updateDocument(currentDocument.id, {
      fieldDefinitions: createdFields,
      defaultValues: prunedDefaults,
    });
    setCurrentDocument({
      ...currentDocument,
      fieldDefinitions: createdFields,
      defaultValues: prunedDefaults,
    });
  } catch (error) {
    console.error('Error saving modified PDF:', error);
  }
}
```

The `setCurrentDocument` keeps local state in sync so the pin button immediately reflects the pruned defaults without requiring a reload.

- [ ] **Step 3: Update the `<PDFViewerEditor onFieldsChange={...} />` callback** (around line 810). Replace the inline arrow with:

```tsx
onFieldsChange={(updatedFields) => {
  setFields(updatedFields);
  if (currentDocument) {
    const prunedDefaults = pruneDefaults(updatedFields, currentDocument.defaultValues);
    setCurrentDocument({
      ...currentDocument,
      fieldDefinitions: updatedFields,
      defaultValues: prunedDefaults,
    });
    updateDocument(currentDocument.id, {
      fieldDefinitions: updatedFields,
      defaultValues: prunedDefaults,
    }).catch((error) => {
      console.error('Error updating document fields:', error);
    });
  }
}}
```

- [ ] **Step 4: Type check.**

Run: `npx tsc --noEmit`
Expected: zero errors.

- [ ] **Step 5: Manual test.**

Run: `npm run dev`. Open a saved document, pin a default on a field, then open the visual editor / field creator and delete that field. Save. Reload the document — the field is gone (expected) and there is no orphaned `defaultValues` entry. (You can confirm via the Firebase console: the deleted field name should not appear under `defaultValues` on the document.)

- [ ] **Step 6: Commit.**

```bash
git add app/page.tsx
git commit -m "page: prune defaults when fieldDefinitions changes"
```

---

## Phase 7 — Final verification

### Task 14: Full-feature manual sweep

**Files:** none.

- [ ] **Step 1: Lint.**

Run: `npm run lint`
Expected: clean (or only pre-existing warnings unrelated to this work).

- [ ] **Step 2: Build.**

Run: `npm run build`
Expected: build succeeds, no TS errors.

- [ ] **Step 3: End-to-end manual flow.**

Run: `npm run dev`. Walk through the entire happy path:

1. Sign in. Upload a fresh PDF, fill some fields, click "Save." Confirm pin buttons that were previously disabled become enabled.
2. Pin two fields with different value types (e.g. one text, one date or dropdown). Confirm both pins go solid.
3. Navigate back to the document list, then re-open the document. Confirm both pinned values pre-fill in muted/italic. Confirm the progress counter (`filledFieldCount/totalFields`) reflects them as filled.
4. Click into one pre-filled field — text snaps to normal styling. Edit the value. Confirm the inline "Update default?" button appears.
5. Click "Update default?". Refresh the doc — the new value pre-fills.
6. Unpin the other field via its solid pin button. Refresh — that field is empty on next open.
7. Open the field editor, delete a field that had a default. Save. Reopen — the field is gone and no orphaned default remains (verify via Firebase console if accessible).
8. Spot-check a checkbox field: pin works only when the box is checked; pinning an unchecked box is disabled.

Note any regression or unexpected behavior; fix and add a small follow-up task if needed.

- [ ] **Step 4: Final commit (if anything was tweaked during the sweep).**

```bash
git status
# If clean, no commit needed.
# Otherwise:
git add -p
git commit -m "polish: <describe fix>"
```

---

## Out of scope (deferred per spec)

These are not in this plan and should not be added without a separate spec/plan cycle:

- Cross-template / global defaults
- Bulk "Manage defaults" panel
- Default-value history / undo
- Importing defaults across templates
- User-visible toast for write failures

---

## Risk notes

- **`removeUndefined` in `saveDocument` ([lib/firestore/documents.ts:35](../../lib/firestore/documents.ts)):** strips `undefined` keys before writing to Firestore. This is fine for our use because we use `updateDocument` (not `saveDocument`) for default writes, and the value being written is always defined. If a future task wants to write defaults via `saveDocument`, double-check this helper handles the new shape.
- **`field.defaultValue` (PDF-intrinsic) is still consulted as a render-time fallback inside `FieldInput` ([components/FieldInput.tsx:31](../../components/FieldInput.tsx) and similar lines).** This is unchanged and intentional — it preserves existing behavior for PDFs whose AcroForm widgets ship with intrinsic defaults. User-pinned `defaultValues` flow through `formValues`, which takes precedence over `field.defaultValue` in those expressions.
