# Template Default Values — Design

**Date:** 2026-04-27
**Status:** Approved, ready for implementation plan
**Owner:** Jordan Francis

## Problem

Document Filler already lets users save a PDF as a reusable template (the `PDFDocument` record in Firestore). When a user re-opens a saved template, the form is empty — every field has to be re-typed, including values that almost never change between fills (name, address, phone, employer, etc.).

We want users to be able to mark specific fields in a template as "always start with this value." On the next open, those fields are pre-filled and ready to go. The user can still edit them per-fill without disturbing the saved default, and can promote a new value to default with a single click.

## Goals

- **Per-template, per-field defaults**, set explicitly by the user.
- **Snapshot semantics**: pinning captures the value at pin-time. Edits override only the current fill — they do not silently overwrite the saved default.
- **Soft promotion**: when the current value diverges from the saved default, surface a one-click "Update default?" affordance so the user can opt in without leaving the form.
- **Visible state**: the user can always tell at a glance which fields have a saved default and which values came from a default vs. were just typed.
- **Auto-save**: pin / unpin / update is persisted immediately. No new "Save defaults" button.

## Non-goals (v1)

- Cross-template / global defaults (e.g., one "Name" value reused across every document).
- Bulk "Manage defaults" panel.
- Default-value history / undo.
- Importing defaults from one template into another.
- Auto-learn ("remember whatever I last typed") — defaults are explicit only.

These are deliberately deferred. The schema chosen below leaves the door open for all of them without re-shaping data.

## Existing-code grounding

Quick map of the touchpoints, current state:

- [`types/pdf.ts`](../../types/pdf.ts) — `PDFField` already has a `defaultValue?` slot, populated from PDF detection (intrinsic PDF defaults) but **not currently wired into the form** as a pre-fill.
- [`lib/firestore/documents.ts`](../../lib/firestore/documents.ts) — `DocumentData` interface; `saveDocument` / `updateDocument` helpers.
- [`app/page.tsx`](../../app/page.tsx) — top-level form state. `setFormValues({})` resets to empty on both fresh upload (line ~174) and document open (line ~317). Auto-persist already exists for label edits (line ~247), serving as the pattern to follow.
- [`components/FormFieldRenderer.tsx`](../../components/FormFieldRenderer.tsx) — renders the form rows. Each row's label area (lines 113–146) already hosts label, completion-check, required-star, and the hover-revealed eye icon — natural home for the pin button.
- [`components/FieldInput.tsx`](../../components/FieldInput.tsx) — per-field input component; small `className` hook needed for the muted-pre-fill styling.

## Approach

A separate map on the document record (`defaultValues: Record<fieldName, value>`), parallel in shape to `formValues`. Field definitions stay structural. User preferences are isolated, atomically updatable, and trivially mergable on load.

Considered alternatives (rejected):

- **Reuse `PDFField.defaultValue` + add a `pinnedDefault` flag** — conflates "the PDF says X" with "the user pinned X" and forces a full `fieldDefinitions` array rewrite on every pin.
- **Add `userDefault` parallel field on `PDFField`** — cleaner than the above, but still couples user preference to field structure and still rewrites the whole array per pin.

## Data model

```ts
// types/pdf.ts
export interface PDFDocument {
  id: string;
  name: string;
  originalPdfUrl: string;
  fieldDefinitions: PDFField[];
  defaultValues?: Record<string, string | boolean | number>;  // NEW
  createdAt: Date;
  updatedAt: Date;
  filledPdfs?: FilledPDF[];
}
```

```ts
// lib/firestore/documents.ts
export interface DocumentData {
  name: string;
  originalPdfUrl: string;
  fieldDefinitions: PDFField[];
  defaultValues?: Record<string, string | boolean | number>;  // NEW
  createdAt: Timestamp;
  updatedAt: Timestamp;
  userId: string;
  filledPdfs?: Array<{                          // existing, unchanged
    id: string;
    downloadUrl: string;
    createdAt: Timestamp;
    formValues: Record<string, any>;
  }>;
}
```

Notes:

- **Keyed by `PDFField.name`** — the internal PDF field name. It's immutable; label edits don't disturb defaults.
- **Sparse map**: a missing key means "no default set." Unpinning is `delete map[name]`. No null/sentinel ambiguity.
- **Optional field**: existing documents in Firestore read back as `undefined`. The spread `{...(doc.defaultValues ?? {})}` handles it; no migration script.
- **`PDFField.defaultValue` is left untouched** — it stays as the PDF-intrinsic default from detection. v1 does not pre-fill from it; only user pins pre-fill.

## Load & pre-fill behavior

In [`app/page.tsx`](../../app/page.tsx) `handleDocumentSelect` (and any other place we open a saved template):

```ts
// Was:
setFormValues({});

// Becomes:
setFormValues({ ...(doc.defaultValues ?? {}) });
setUntouchedDefaults(new Set(Object.keys(doc.defaultValues ?? {})));
```

New piece of state:

```ts
const [untouchedDefaults, setUntouchedDefaults] =
  useState<Set<string>>(new Set());
```

This set holds field names whose currently-displayed value came from a saved default and the user hasn't interacted with yet. It drives the muted-text styling (see "Visual treatment" below).

A field name leaves the set on first interaction:

- `handleFormChange(fieldName, value)` → `untouchedDefaults.delete(fieldName)`
- `handleFieldFocus(fieldName)` → `untouchedDefaults.delete(fieldName)`

Once removed, a field is **never re-added in the same session**, even if the user types back to the exact default value. After the first touch, it's "their" value.

### Counter & green-check

The existing `filledFieldCount` calculation ([`app/page.tsx:462`](../../app/page.tsx)) and the green check in [`FormFieldRenderer.tsx:124`](../../components/FormFieldRenderer.tsx) both key off "value is non-empty." Pre-filled defaults satisfy that naturally. **No changes needed**: pre-filled fields count as filled and show the check.

## Pin button — UI & state

The pin lives in the label row of each form field, alongside the existing eye icon ([`FormFieldRenderer.tsx:113–146`](../../components/FormFieldRenderer.tsx)). It is **always visible**.

### Icon

Lucide `Pin`. Two states via `fill-current` vs `fill-none`:

| Visual | When | Tooltip |
|---|---|---|
| Hollow, dim, disabled | No default set, value empty | "Type a value to pin as default" |
| Hollow, hoverable | No default set, value present | "Pin this value as the default" |
| Filled, accent color | Default set | "Remove saved default" |

### Click behavior

- **Hollow + value present** → `defaultValues[name] = currentValue`. Optimistic local update, then `updateDocument(currentDocument.id, { defaultValues: nextDefaults })` fired in the background.
- **Filled (any state)** → `delete defaultValues[name]`. Optimistic local update, then `updateDocument(...)`.
- **Errors during write** → revert local state, `console.warn` (matches the label-edit pattern at [`app/page.tsx:249`](../../app/page.tsx)).

### Unsaved-template gate

If `currentDocument === null` (fresh upload, not yet saved), the pin is **disabled** with tooltip: "Save the template first to pin defaults."

This keeps state management linear: defaults live on a saved document, not in floating session state. The user hits Save, the document is created, pinning works normally from that point on.

### Field-type coverage

All field types support pinning. The pin button is enabled when the field has a "meaningfully present" value:

- `text` / `number` / `date` — non-empty string
- `dropdown` / `radio` — non-empty selection
- `checkbox` — only `true` enables pinning. Pinning `false` would be equivalent to no pin (both produce an unchecked default), so we disallow it.

## Visual treatment of pre-filled values (Q4-B)

Pre-filled values look subtly distinct from values the user just typed, until the field is touched.

- **Mechanism**: `FormFieldRenderer` passes `isPristineDefault` down to `FieldInput` for any field name in `untouchedDefaults`.
- **Styling**: muted text color + slight italic (Tailwind classes only — e.g., `text-ink-faint italic`). No new CSS variables.
- **On touch**: the field name leaves `untouchedDefaults`, the prop flips to `false`, the input snaps to normal styling.
- **Visible scope**: applies to the input text only. The label, pin, check, and other chrome are unchanged.

## Soft "Update default?" prompt (Q2-C)

A small inline button immediately **below** the input (not in the label row, which is already crowded with pin / check / required / eye).

### Visibility rules

Shown when **all** of:

- Field has a saved default (`defaultValues[name]` exists)
- Current value `formValues[name]` is non-empty
- Current value ≠ saved default

Hidden when:

- User edits back to match the saved default
- User clicks the prompt (default updates, prompt naturally disappears next render)
- User unpins the field
- User clears the field

### Visual

```
┌─────────────────────────────┐
│ Jordan Francis              │  ← input
└─────────────────────────────┘
  ↺ Update default to "Jordan Francis"      ← small accent-text button
```

Lucide `RotateCcw` glyph. Value rendered in the prompt:

- text / number / date → `"value"` in quotes
- dropdown / radio → `"selected option"` in quotes
- checkbox → "checked" / "unchecked" (no quotes)

Long values truncate with ellipsis past ~30 chars.

### Click behavior

`defaultValues[name] = formValues[name]`. Optimistic local update, background `updateDocument`. Same revert-and-warn on failure.

### A11y

Keyboard reachable in the natural Tab order: input → prompt button → next field's pin / input.

## Edge cases & policy

### Field deletion

When a field is removed via [`PDFFieldCreator`](../../components/PDFFieldCreator.tsx) or [`PDFViewerEditor`](../../components/PDFViewerEditor.tsx), its entry in `defaultValues` becomes orphaned.

**Policy:** prune at write time. Centralize in a small helper:

```ts
// lib/firestore/documents.ts (or a colocated util)
export function pruneDefaults(
  fields: PDFField[],
  defaults: Record<string, any> | undefined
): Record<string, any> {
  if (!defaults) return {};
  const validNames = new Set(fields.map((f) => f.name));
  return Object.fromEntries(
    Object.entries(defaults).filter(([name]) => validNames.has(name))
  );
}
```

Call it at every site that updates `fieldDefinitions` so the next persisted state is consistent.

### Field renaming

`PDFField.name` is immutable (the internal PDF field name from pdf-lib). Only `label` is editable. Defaults keyed by `name` are stable across label edits. No special handling.

### Existing documents in Firestore

`defaultValues` is optional. Old documents read back as `undefined`. The load path uses `{...(doc.defaultValues ?? {})}`. No migration script, no backfill.

### Write failures (offline / network)

Auto-save is optimistic and fire-and-forget. On failure: revert local state, `console.warn` (matches the label-edit pattern at [`app/page.tsx:249`](../../app/page.tsx)). A user-visible toast is deferred to v2.

### Filled-PDF history

Each download creates a `FilledPDF` record with a snapshot of `formValues` ([`types/pdf.ts:33`](../../types/pdf.ts)). This is independent of `defaultValues`. They serve different roles (this-fill record vs. template-level preference). No interaction.

### Discoverability

Tooltips on the pin button (varying by state, see table above) handle discovery. No new onboarding step in v1 — the pin icon is small, conventional, and adjacent to the existing eye icon.

## Summary of file changes

| File | Change |
|---|---|
| `types/pdf.ts` | Add `defaultValues?: Record<string, ...>` to `PDFDocument`. |
| `lib/firestore/documents.ts` | Add `defaultValues?` to `DocumentData`. Add `pruneDefaults` helper. |
| `app/page.tsx` | New `untouchedDefaults` state. Update `handleDocumentSelect` to seed `formValues` from `doc.defaultValues`. Update `handleFormChange` and `handleFieldFocus` to remove fields from the set. Wire pin / unpin / soft-prompt updates to `updateDocument`. Call `pruneDefaults` whenever `fieldDefinitions` changes. |
| `components/FormFieldRenderer.tsx` | Add pin button to label row. Pass `isPristineDefault` to `FieldInput`. Render the inline "Update default?" prompt below each input when conditions match. New props for default-related callbacks. |
| `components/FieldInput.tsx` | Accept `isPristineDefault` prop and apply muted/italic class to the input text when true. |

No new dependencies. No new files required (pin icon already available via `lucide-react`).

## Out of scope (revisit later)

- Cross-template / global defaults
- Bulk "Manage defaults" panel
- Default-value history / undo
- Importing defaults across templates
- User-visible toast for write failures
