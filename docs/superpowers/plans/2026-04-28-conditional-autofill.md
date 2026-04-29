# Conditional Autofill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add three layered autofill mechanisms — a global per-user `ProfileDefaults` map, a per-document conditional rule engine, and an LLM chat that authors rules via server-side tool calls — on top of the existing per-template defaults. Driven by a realtor workflow where one selection (e.g., "Cash") cascades into many field values.

**Architecture:** Pure rule engine in `lib/ruleEngine.ts` (no I/O, unit-tested) consumed by `app/page.tsx` on every `formValues` change. Rules live as an optional `rules?: Rule[]` array on the existing `PDFDocument` Firestore record. Profile defaults live in a new `userProfiles/{uid}` collection. Layering on document open: profile defaults → per-document defaults → rule engine. A new "Rules" tab on saved documents hosts a two-pane editor (manual builder left, LLM chat right). The chat calls a server-side endpoint at `/api/rule-chat` that proxies to OpenAI with a fixed tool surface (`add_rule`, `edit_rule`, `delete_rule`, `list_rules`); validated tool calls return as mutations the client applies to local state and persists via the existing Firestore CRUD pattern.

**Tech Stack:** Next.js 14 (App Router), TypeScript (`strict: true`), Firestore (modular SDK), Tailwind, lucide-react, framer-motion. NEW: `vitest` (Phase 3) for the pure engine; `zod` (Phase 5) for tool-input validation. AI provider: OpenAI (matches existing label-fields-vision pattern; `gpt-4o-mini` for chat).

**Spec:** [docs/superpowers/specs/2026-04-28-conditional-autofill-design.md](../specs/2026-04-28-conditional-autofill-design.md)

---

## Verification approach

The repo has no test framework today. The spec recommended adding `vitest` for the rule engine; this plan does that — but **only** for the pure engine module (`lib/ruleEngine.ts`). Component and page changes verify via:

- **`npx tsc --noEmit`** — fast type check (TypeScript `strict` mode)
- **`npm run lint`** — Next.js / ESLint
- **`npm run build`** — full Next.js build at phase boundaries
- **`npm run dev`** — `http://localhost:3000`, manual UI checks
- **`npx vitest run`** — engine tests, after Phase 3

If a test framework was added between the time this plan was written and the time it executes, prefer adding tests for new logic where it's cheap.

---

## File structure

| File | Role | Status |
|---|---|---|
| `types/rule.ts` | Rule, RuleCondition, ConditionGroup, RuleAction types | **Create** |
| `types/pdf.ts` | Add `rules?: Rule[]` to `PDFDocument` | Modify |
| `types/user.ts` | Replace unused `UserProfile` with new `ProfileDefaults` interface | Modify |
| `lib/ruleEngine.ts` | Pure engine — `evaluateGroup`, `applyRules` | **Create** |
| `lib/__tests__/ruleEngine.test.ts` | Vitest specs for the engine | **Create** |
| `lib/firestore/rules.ts` | CRUD for rules + chat history | **Create** |
| `lib/firestore/profile.ts` | CRUD for `ProfileDefaults` | **Create** |
| `lib/firestore/documents.ts` | Extend `DocumentData`; add `pruneRules` helper | Modify |
| `firestore.rules` | Add `userProfiles/{uid}` access rule | Modify |
| `app/api/rule-chat/route.ts` | LLM tool-calling endpoint | **Create** |
| `app/profile/page.tsx` | Profile defaults editor route | **Create** |
| `app/page.tsx` | Hook engine into `formValues` setter; track `ruleTouched`; apply profile on doc open | Modify |
| `components/Layout/Header.tsx` | "Profile" nav link | Modify |
| `components/FormFieldRenderer.tsx` | `✦` indicator + tooltip on rule-touched fields | Modify |
| `components/Rules/RuleEditor.tsx` | Two-pane container + Rules tab toggle | **Create** |
| `components/Rules/RuleList.tsx` | Ordered rule rows + drag-reorder | **Create** |
| `components/Rules/RuleRow.tsx` | One rule (collapsed/expanded states) | **Create** |
| `components/Rules/ConditionInput.tsx` | `[field][op][value]` picker, type-aware | **Create** |
| `components/Rules/ActionInput.tsx` | `[set\|clear][field][=value]` picker | **Create** |
| `components/Rules/RuleChat.tsx` | Right-pane chat with tool-call results | **Create** |
| `components/Rules/ruleSummary.ts` | Pure helper: rule → plain-English string | **Create** |
| `package.json` | Add `vitest` dev dep (Phase 3); add `zod` dep (Phase 5) | Modify |

New files: 14. Modified files: 7. New dependencies: `vitest` (dev), `zod`.

---

## Shipping checkpoints

The plan has three shipping checkpoints — points where the app has gained user-visible value and could be deployed:

- **Ship 1** (after Phase 2): Profile defaults are live. Realtors fill their profile once and see fields auto-populated across every document.
- **Ship 2** (after Phase 4): Conditional rules + manual builder are live. Realtors can author rules by hand; rule engine fires on every field change.
- **Ship 3** (after Phase 5): LLM chat is live. Realtors can author and audit rules in plain English.

Each checkpoint passes the full verification approach (`tsc`, `lint`, `build`, manual sweep) before considering the increment shippable.

---

## Phase 1 — Data foundation

No user-visible changes. Establishes the type system, Firestore extensions, and security rules that all later phases build on.

### Task 1: Create `types/rule.ts`

**Files:**
- Create: `types/rule.ts`

- [ ] **Step 1: Write the new types file.**

```ts
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
```

- [ ] **Step 2: Type check.**

Run: `npx tsc --noEmit`
Expected: zero errors.

- [ ] **Step 3: Commit.**

```bash
git add types/rule.ts
git commit -m "types: add Rule, ConditionGroup, RuleAction, ChatMessage"
```

---

### Task 2: Extend `PDFDocument` with `rules` and `chatHistory`

**Files:**
- Modify: `types/pdf.ts`

- [ ] **Step 1: Add the new optional fields.** Open `types/pdf.ts` and update `PDFDocument`:

```ts
import type { Rule, ChatMessage } from './rule';

// existing PDFFieldType, PDFFieldPosition, PDFField, FilledPDF unchanged

export interface PDFDocument {
  id: string;
  name: string;
  originalPdfUrl: string;
  fieldDefinitions: PDFField[];
  defaultValues?: Record<string, string | boolean | number>;
  rules?: Rule[];                 // NEW — ordered; index = firing priority
  chatHistory?: ChatMessage[];    // NEW — bounded to last 50 turns
  createdAt: Date;
  updatedAt: Date;
  filledPdfs?: FilledPDF[];
}
```

- [ ] **Step 2: Type check.**

Run: `npx tsc --noEmit`
Expected: zero errors. Both new fields are optional and additive.

- [ ] **Step 3: Commit.**

```bash
git add types/pdf.ts
git commit -m "types: add rules and chatHistory to PDFDocument"
```

---

### Task 3: Replace unused `UserProfile` with `ProfileDefaults`

The existing `UserProfile` interface in `types/user.ts` is currently unused (verified via grep — only referenced in the new spec). Replacing it avoids a name collision with the spec's intent.

**Files:**
- Modify: `types/user.ts`

- [ ] **Step 1: Replace the file contents.**

```ts
import { User as FirebaseUser } from 'firebase/auth';

export interface User extends FirebaseUser {
  // Additional user properties can be added here
}

/**
 * Per-user profile values that auto-fill across every document the user opens,
 * matched by case-insensitive field label.
 */
export interface ProfileDefaults {
  uid: string;
  defaults: Array<{
    label: string;
    value: string | boolean | number;
  }>;
  updatedAt: Date;
}
```

- [ ] **Step 2: Type check.**

Run: `npx tsc --noEmit`
Expected: zero errors. Nothing currently imports the old `UserProfile`.

- [ ] **Step 3: Commit.**

```bash
git add types/user.ts
git commit -m "types: replace unused UserProfile with ProfileDefaults"
```

---

### Task 4: Extend `DocumentData` with `rules` and `chatHistory`

**Files:**
- Modify: `lib/firestore/documents.ts`

- [ ] **Step 1: Update imports** at the top of `lib/firestore/documents.ts`:

```ts
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  updateDoc,
  query,
  where,
  orderBy,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { PDFDocument, PDFField } from '@/types/pdf';
import { Rule, ChatMessage } from '@/types/rule';
```

- [ ] **Step 2: Update `DocumentData` interface:**

```ts
export interface DocumentData {
  name: string;
  originalPdfUrl: string;
  fieldDefinitions: PDFField[];
  defaultValues?: Record<string, string | boolean | number>;
  rules?: Rule[];
  chatHistory?: ChatMessage[];
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

- [ ] **Step 3: Type check.**

Run: `npx tsc --noEmit`
Expected: zero errors.

- [ ] **Step 4: Commit.**

```bash
git add lib/firestore/documents.ts
git commit -m "firestore: add rules and chatHistory to DocumentData"
```

---

### Task 5: Add `pruneRules` helper

A pure function that flags-but-does-not-delete rules referencing fields no longer in the document. The spec deliberately rejects auto-deletion: silent loss of rule work would be worse than a stale reference.

**Files:**
- Modify: `lib/firestore/documents.ts`

- [ ] **Step 1: Add the helper at the bottom of `lib/firestore/documents.ts`,** after `pruneDefaults`:

```ts
import { ConditionGroup, isConditionGroup, RuleAction } from '@/types/rule';

/**
 * Returns rules unchanged but with a `_missingFieldRefs?: string[]` annotation
 * on each rule that references field names not present in `fields`. The UI
 * uses this to warn the user. Rules are NEVER deleted by this function —
 * field renames happen during PDF editing and silent rule deletion would
 * destroy the user's work.
 */
export function pruneRules(
  fields: PDFField[],
  rules: Rule[] | undefined
): Array<Rule & { _missingFieldRefs?: string[] }> {
  if (!rules) return [];
  const validNames = new Set(fields.map((f) => f.name));

  function collectGroupRefs(group: ConditionGroup): string[] {
    const out: string[] = [];
    for (const c of group.conditions) {
      if (isConditionGroup(c)) {
        out.push(...collectGroupRefs(c));
      } else {
        out.push(c.fieldName);
      }
    }
    return out;
  }

  return rules.map((rule) => {
    const refs = new Set<string>([
      ...collectGroupRefs(rule.conditionGroup),
      ...rule.actions.map((a: RuleAction) => a.fieldName),
    ]);
    const missing = [...refs].filter((name) => !validNames.has(name));
    return missing.length ? { ...rule, _missingFieldRefs: missing } : rule;
  });
}
```

- [ ] **Step 2: Type check.**

Run: `npx tsc --noEmit`
Expected: zero errors.

- [ ] **Step 3: Commit.**

```bash
git add lib/firestore/documents.ts
git commit -m "firestore: add pruneRules helper (annotates, does not delete)"
```

---

### Task 6: Create `lib/firestore/profile.ts`

CRUD for the new `userProfiles` collection.

**Files:**
- Create: `lib/firestore/profile.ts`

- [ ] **Step 1: Write the file.**

```ts
// lib/firestore/profile.ts
import { doc, getDoc, setDoc, Timestamp } from 'firebase/firestore';
import { db } from '../firebase/config';
import { ProfileDefaults } from '@/types/user';

const PROFILES_COLLECTION = 'userProfiles';

interface ProfileData {
  uid: string;
  defaults: Array<{
    label: string;
    value: string | boolean | number;
  }>;
  updatedAt: Timestamp;
}

const REALTOR_SEED_LABELS = [
  'Full Name',
  'License #',
  'Brokerage Name',
  'Brokerage Address',
  'Brokerage Phone',
  'Email',
];

export async function getProfile(uid: string): Promise<ProfileDefaults> {
  const ref = doc(db, PROFILES_COLLECTION, uid);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    // Seed labels with empty values on first read so the UI has something
    // to render. The seed is NOT written to Firestore until the user saves;
    // a brand-new account doesn't pollute storage with empty rows.
    return {
      uid,
      defaults: REALTOR_SEED_LABELS.map((label) => ({ label, value: '' })),
      updatedAt: new Date(),
    };
  }

  const data = snap.data() as ProfileData;
  return {
    uid: data.uid,
    defaults: data.defaults || [],
    updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : new Date(),
  };
}

export async function saveProfile(profile: ProfileDefaults): Promise<void> {
  const ref = doc(db, PROFILES_COLLECTION, profile.uid);
  // Drop entries with empty label OR empty string value — they're noise.
  const cleaned = profile.defaults.filter(
    (d) =>
      d.label.trim() !== '' &&
      !(typeof d.value === 'string' && d.value.trim() === '')
  );
  const data: ProfileData = {
    uid: profile.uid,
    defaults: cleaned,
    updatedAt: Timestamp.now(),
  };
  await setDoc(ref, data);
}
```

- [ ] **Step 2: Type check.**

Run: `npx tsc --noEmit`
Expected: zero errors.

- [ ] **Step 3: Commit.**

```bash
git add lib/firestore/profile.ts
git commit -m "firestore: add profile CRUD with realtor seed labels"
```

---

### Task 7: Add Firestore security rule for `userProfiles`

**Files:**
- Modify: `firestore.rules`

- [ ] **Step 1: Replace the file contents:**

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Documents collection - users can only access their own documents
    match /documents/{documentId} {
      allow read: if request.auth != null && request.auth.uid == resource.data.userId;
      allow create: if request.auth != null && request.auth.uid == request.resource.data.userId;
      allow update: if request.auth != null && request.auth.uid == resource.data.userId;
      allow delete: if request.auth != null && request.auth.uid == resource.data.userId;
    }

    // User profiles - keyed by uid, only the owning user can read/write.
    match /userProfiles/{uid} {
      allow read: if request.auth != null && request.auth.uid == uid;
      allow write: if request.auth != null && request.auth.uid == uid;
    }
  }
}
```

- [ ] **Step 2: Manual verification.**

These rules deploy via `firebase deploy --only firestore:rules` (out of scope for this plan — the user will deploy after the feature ships). For now, verify the file parses by reading it back.

Run: `cat firestore.rules` (visual check that the file is well-formed).

- [ ] **Step 3: Phase 1 build check.**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 4: Commit.**

```bash
git add firestore.rules
git commit -m "firestore: allow per-uid userProfiles access"
```

---

## Phase 2 — Profile defaults end-to-end (SHIP 1)

Ships the user-level recurring-data layer. Realtors fill their profile once and see matching fields auto-populated.

### Task 8: Build the `/profile` page route

**Files:**
- Create: `app/profile/page.tsx`

- [ ] **Step 1: Write the page.**

```tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, X, Loader2, ArrowLeft } from 'lucide-react';
import { useAuthContext } from '@/components/Auth/AuthProvider';
import Header from '@/components/Layout/Header';
import { getProfile, saveProfile } from '@/lib/firestore/profile';
import { ProfileDefaults } from '@/types/user';

export default function ProfilePage() {
  const { user, loading: authLoading } = useAuthContext();
  const router = useRouter();
  const [profile, setProfile] = useState<ProfileDefaults | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingAt, setSavingAt] = useState<Date | null>(null);

  useEffect(() => {
    if (!authLoading && !user) router.push('/login');
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const p = await getProfile(user.uid);
        setProfile(p);
      } catch (e) {
        console.error('Error loading profile:', e);
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  // Debounced auto-save: 600ms after the last edit.
  useEffect(() => {
    if (!profile || loading) return;
    const handle = setTimeout(async () => {
      try {
        await saveProfile(profile);
        setSavingAt(new Date());
      } catch (e) {
        console.error('Error saving profile:', e);
      }
    }, 600);
    return () => clearTimeout(handle);
  }, [profile, loading]);

  function updateRow(idx: number, patch: Partial<{ label: string; value: string }>) {
    if (!profile) return;
    const next = [...profile.defaults];
    next[idx] = { ...next[idx], ...patch };
    setProfile({ ...profile, defaults: next });
  }

  function removeRow(idx: number) {
    if (!profile) return;
    const next = profile.defaults.filter((_, i) => i !== idx);
    setProfile({ ...profile, defaults: next });
  }

  function addRow() {
    if (!profile) return;
    setProfile({
      ...profile,
      defaults: [...profile.defaults, { label: '', value: '' }],
    });
  }

  if (authLoading || loading || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-ink-faint" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-paper">
      <Header />
      <main className="max-w-[720px] mx-auto px-8 py-10">
        <button
          onClick={() => router.push('/')}
          className="btn btn-ghost btn-sm mb-6 flex items-center gap-1.5"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>
        <h1 className="font-serif text-2xl text-ink mb-2">Your profile</h1>
        <p className="text-sm text-ink-faint mb-8">
          Values you set here pre-fill any document field whose label matches —
          case-insensitive, exact match. You can override per-document at any
          time.
        </p>

        <div className="space-y-2">
          {profile.defaults.map((row, idx) => (
            <div key={idx} className="flex gap-2 items-center">
              <input
                type="text"
                value={row.label}
                onChange={(e) => updateRow(idx, { label: e.target.value })}
                placeholder="Field label (e.g. Full Name)"
                className="input flex-[2]"
              />
              <input
                type="text"
                value={String(row.value ?? '')}
                onChange={(e) => updateRow(idx, { value: e.target.value })}
                placeholder="Value"
                className="input flex-[3]"
              />
              <button
                type="button"
                onClick={() => removeRow(idx)}
                className="btn btn-ghost btn-sm"
                title="Remove"
                aria-label="Remove row"
              >
                <X className="w-4 h-4 text-ink-faint" />
              </button>
            </div>
          ))}
        </div>

        <button
          onClick={addRow}
          className="btn btn-ghost btn-sm mt-3 flex items-center gap-1.5"
        >
          <Plus className="w-4 h-4" />
          Add field
        </button>

        {savingAt && (
          <p className="text-xs text-ink-faint mt-6">
            Auto-saved · {savingAt.toLocaleTimeString()}
          </p>
        )}
      </main>
    </div>
  );
}
```

- [ ] **Step 2: Type check.**

Run: `npx tsc --noEmit`
Expected: zero errors.

- [ ] **Step 3: Commit.**

```bash
git add app/profile/page.tsx
git commit -m "profile: add /profile editor page with debounced auto-save"
```

---

### Task 9: Add "Profile" link to header

The existing header has a `nav` with `documents | trash | account`. The profile is conceptually distinct from "account" (which is presumably for sign-out / billing) — adding it as a fourth nav item would be the cleanest. But the `onNavChange` prop is typed to a specific union, so we'll add a separate button next to the help/logout cluster.

**Files:**
- Modify: `components/Layout/Header.tsx`

- [ ] **Step 1: Update the icon imports** (line 6):

```tsx
import { Search, HelpCircle, LogOut, User as UserIcon } from 'lucide-react';
```

- [ ] **Step 2: Add the router import** if not already imported (it is, on line 5).

- [ ] **Step 3: Add the Profile button.** Find the cluster of buttons in the right side of the header (around lines 82-99 — Help button, Logout button, Avatar). Insert a Profile button before the Logout button:

```tsx
<button
  onClick={() => router.push('/profile')}
  className="btn btn-ghost btn-sm"
  title="Profile defaults"
>
  <UserIcon className="co-ico co-ico-pop w-4 h-4" />
</button>
```

The full button cluster after this change reads (Help → Profile → Logout → Avatar).

- [ ] **Step 4: Type check.**

Run: `npx tsc --noEmit`
Expected: zero errors.

- [ ] **Step 5: Manual UI check.**

Run: `npm run dev`. Sign in. Confirm a person-icon button appears in the header. Click it → routes to `/profile`. The page renders with realtor seed labels (`Full Name`, `License #`, etc.). Type a value in one row → wait ~1s → see "Auto-saved · HH:MM:SS" below. Refresh the page → the value persists.

- [ ] **Step 6: Commit.**

```bash
git add components/Layout/Header.tsx
git commit -m "header: add Profile button linking to /profile"
```

---

### Task 10: Apply profile defaults on document open

**Files:**
- Modify: `app/page.tsx`

- [ ] **Step 1: Add imports.** At the top of `app/page.tsx`, add (alongside the existing firestore imports around line 14):

```tsx
import { getProfile } from '@/lib/firestore/profile';
import { ProfileDefaults } from '@/types/user';
```

- [ ] **Step 2: Add `profileDefaults` state.** In the state declarations near the top of `HomePage` (after `documents` state, around line 41):

```tsx
const [profileDefaults, setProfileDefaults] = useState<ProfileDefaults | null>(null);
```

- [ ] **Step 3: Load profile when user is available.** Find the existing `useEffect` that fires when `user` is set (around line 66). Update it to also load the profile:

```tsx
useEffect(() => {
  if (user) {
    loadDocuments();
    (async () => {
      try {
        const p = await getProfile(user.uid);
        setProfileDefaults(p);
      } catch (e) {
        console.warn('Error loading profile defaults:', e);
        setProfileDefaults({ uid: user.uid, defaults: [], updatedAt: new Date() });
      }
    })();
    const hasSeenOnboarding = localStorage.getItem('hasSeenOnboarding');
    if (!hasSeenOnboarding) {
      setTimeout(() => setShowOnboarding(true), 500);
    }
  }
}, [user]);
```

- [ ] **Step 4: Add a helper for label-matched profile application.** Add this pure helper at the top of `app/page.tsx`, just below the imports (above the `type ViewMode = ...` line):

```tsx
function applyProfileDefaults(
  fields: PDFField[],
  profile: ProfileDefaults | null,
  baseValues: Record<string, string | boolean | number>
): Record<string, string | boolean | number> {
  if (!profile || profile.defaults.length === 0) return baseValues;

  // Build a label → value map for O(1) lookup. Last-write-wins on duplicates.
  const profileMap = new Map<string, string | boolean | number>();
  for (const { label, value } of profile.defaults) {
    profileMap.set(label.trim().toLowerCase(), value);
  }

  const result: Record<string, string | boolean | number> = { ...baseValues };
  for (const field of fields) {
    if (field.type === 'checkbox') continue; // booleans are never "empty"
    const existing = result[field.name];
    const isEmpty =
      existing === undefined ||
      existing === null ||
      (typeof existing === 'string' && existing === '');
    if (!isEmpty) continue;

    const labelKey = (field.label || field.name).trim().toLowerCase();
    const profileValue = profileMap.get(labelKey);
    if (profileValue !== undefined) {
      result[field.name] = profileValue;
    }
  }
  return result;
}
```

- [ ] **Step 5: Update `handleDocumentSelect` to apply profile defaults before doc defaults.** Find the function (around line 315). Currently it reads:

```tsx
const handleDocumentSelect = async (doc: PDFDocument) => {
  setCurrentDocument(doc);
  setFormValues({ ...(doc.defaultValues ?? {}) });
  setUntouchedDefaults(new Set(Object.keys(doc.defaultValues ?? {})));
  // ...
```

Replace those two `setFormValues` / `setUntouchedDefaults` lines with the layered version. Note: `doc.fieldDefinitions` is the source of fields at this point; the profile must apply against those.

```tsx
const handleDocumentSelect = async (doc: PDFDocument) => {
  setCurrentDocument(doc);
  // Layer: profile (lowest) → doc defaults (overrides profile).
  const withProfile = applyProfileDefaults(
    doc.fieldDefinitions,
    profileDefaults,
    {}
  );
  const layered = { ...withProfile, ...(doc.defaultValues ?? {}) };
  setFormValues(layered);
  setUntouchedDefaults(new Set(Object.keys(layered)));
  // ...rest of the function unchanged
```

- [ ] **Step 6: Type check.**

Run: `npx tsc --noEmit`
Expected: zero errors.

- [ ] **Step 7: Manual end-to-end test.**

Run: `npm run dev`. Sign in. Go to `/profile`, set `Full Name` = `Test User` and `Email` = `test@example.com`. Return to documents. Open a saved document that has at least one field with the label `Full Name` or `Email` (or upload one with such fields). Confirm those fields are pre-filled with the profile values, in the existing muted/italic styling (since they're untouched defaults). Click into them → styling snaps to normal (existing pin behavior).

If the doc has explicit `defaultValues` for one of those fields, the doc default wins (verify by setting a doc default that conflicts).

- [ ] **Step 8: Phase 2 build check.**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 9: Commit.**

```bash
git add app/page.tsx
git commit -m "page: apply ProfileDefaults under doc defaults on open"
```

---

🚢 **SHIP 1** — Profile defaults are live. Stop here for an interim deploy if desired.

---

## Phase 3 — Pure rule engine + tests

No user-visible changes. Adds vitest, builds and tests `lib/ruleEngine.ts`. Phase 4 wires it into the page.

### Task 11: Add `vitest` and configure

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`

- [ ] **Step 1: Install vitest.**

Run:
```bash
npm install --save-dev vitest @vitest/ui
```

Expected: `vitest` and `@vitest/ui` appear under `devDependencies` in `package.json`.

- [ ] **Step 2: Add a `test` script.** Open `package.json` and add a `test` entry to `scripts`:

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

- [ ] **Step 3: Create `vitest.config.ts`** at the repo root:

```ts
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['lib/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
});
```

- [ ] **Step 4: Verify the runner installs cleanly.**

Run: `npx vitest run --version`
Expected: prints a vitest version (e.g. `vitest/X.Y.Z`).

- [ ] **Step 5: Commit.**

```bash
git add package.json package-lock.json vitest.config.ts
git commit -m "test: add vitest for the pure rule engine"
```

---

### Task 12: Implement `evaluateGroup` (TDD)

**Files:**
- Create: `lib/__tests__/ruleEngine.test.ts`
- Create: `lib/ruleEngine.ts`

- [ ] **Step 1: Write the failing test for the simplest equality case.**

Create `lib/__tests__/ruleEngine.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the test — confirm it fails.**

Run: `npx vitest run lib/__tests__/ruleEngine.test.ts`
Expected: FAIL — module not found / `evaluateGroup` not exported.

- [ ] **Step 3: Implement minimal `evaluateGroup` to pass.**

Create `lib/ruleEngine.ts`:

```ts
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
```

- [ ] **Step 4: Run the test — confirm it passes.**

Run: `npx vitest run lib/__tests__/ruleEngine.test.ts`
Expected: 1 passed.

- [ ] **Step 5: Add tests for connectors, missing fields, nested groups, all operators.**

Append to `lib/__tests__/ruleEngine.test.ts`:

```ts
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
    expect(evaluateGroup(group, { financing: 'Cash', state: 'New York' }, FIELDS)).toBe(true);
    expect(evaluateGroup(group, { financing: 'Cash', state: 'Texas' }, FIELDS)).toBe(false);
  });
});

describe('evaluateGroup — empty group', () => {
  it('returns false for a group with zero conditions', () => {
    const group: ConditionGroup = { connector: 'AND', conditions: [] };
    expect(evaluateGroup(group, {}, FIELDS)).toBe(false);
  });
});
```

- [ ] **Step 6: Run all tests.**

Run: `npx vitest run lib/__tests__/ruleEngine.test.ts`
Expected: all tests pass (≥10 cases).

- [ ] **Step 7: Commit.**

```bash
git add lib/ruleEngine.ts lib/__tests__/ruleEngine.test.ts
git commit -m "rule-engine: implement evaluateGroup with full operator coverage"
```

---

### Task 13: Implement `applyRules` (TDD)

The engine takes baseline values + the set of overwritable fields and returns new values plus tracking metadata. Cascading rules see preceding rule effects.

**Files:**
- Modify: `lib/__tests__/ruleEngine.test.ts`
- Modify: `lib/ruleEngine.ts`

- [ ] **Step 1: Write the first failing test for `applyRules`.**

Append to `lib/__tests__/ruleEngine.test.ts`:

```ts
import { applyRules } from '../ruleEngine';
import { Rule } from '@/types/rule';

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
```

- [ ] **Step 2: Run the test — confirm it fails.**

Run: `npx vitest run lib/__tests__/ruleEngine.test.ts`
Expected: FAIL — `applyRules` not exported.

- [ ] **Step 3: Implement `applyRules`.** Append to `lib/ruleEngine.ts`:

```ts
import { Rule, RuleAction } from '@/types/rule';

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
```

- [ ] **Step 4: Run the first test — confirm it passes.**

Run: `npx vitest run lib/__tests__/ruleEngine.test.ts`
Expected: all previous tests + this new one pass.

- [ ] **Step 5: Add tests for the harder cases.**

Append:

```ts
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
```

- [ ] **Step 6: Run the full suite.**

Run: `npx vitest run lib/__tests__/ruleEngine.test.ts`
Expected: all tests pass.

- [ ] **Step 7: Type check.**

Run: `npx tsc --noEmit`
Expected: zero errors.

- [ ] **Step 8: Phase 3 build check.**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 9: Commit.**

```bash
git add lib/ruleEngine.ts lib/__tests__/ruleEngine.test.ts
git commit -m "rule-engine: implement applyRules with conflicts and condition release"
```

---

## Phase 4 — Manual rule builder UI (SHIP 2)

Wires the engine into `app/page.tsx`, builds the Rules tab on saved documents, and adds the visual indicator on rule-touched fields.

### Task 14: Add `lib/firestore/rules.ts`

**Files:**
- Create: `lib/firestore/rules.ts`

- [ ] **Step 1: Write the file.**

```ts
// lib/firestore/rules.ts
//
// CRUD for the rules and chatHistory fields embedded in PDFDocument records.
// Mirrors the existing pattern in lib/firestore/documents.ts (uses updateDoc
// with optimistic local state and revert-on-failure handled at the caller).

import { doc, updateDoc, Timestamp } from 'firebase/firestore';
import { db } from '../firebase/config';
import { Rule, ChatMessage } from '@/types/rule';

const DOCUMENTS_COLLECTION = 'documents';
const MAX_CHAT_TURNS = 50;

export async function saveRules(documentId: string, rules: Rule[]): Promise<void> {
  const ref = doc(db, DOCUMENTS_COLLECTION, documentId);
  await updateDoc(ref, {
    rules,
    updatedAt: Timestamp.now(),
  });
}

export async function appendChatMessage(
  documentId: string,
  history: ChatMessage[],
  message: ChatMessage
): Promise<ChatMessage[]> {
  const next = [...history, message].slice(-MAX_CHAT_TURNS);
  const ref = doc(db, DOCUMENTS_COLLECTION, documentId);
  await updateDoc(ref, {
    chatHistory: next,
    updatedAt: Timestamp.now(),
  });
  return next;
}

export function newRuleId(): string {
  // 12-char base36 — collision-free for realistic per-doc rule counts.
  return Math.random().toString(36).slice(2, 14);
}
```

- [ ] **Step 2: Type check.**

Run: `npx tsc --noEmit`
Expected: zero errors.

- [ ] **Step 3: Commit.**

```bash
git add lib/firestore/rules.ts
git commit -m "firestore: add rules + chat-history CRUD helpers"
```

---

### Task 15: Add `ruleSummary` plain-English helper

Used in collapsed rule rows AND in the LLM chat's confirmation diffs.

**Files:**
- Create: `components/Rules/ruleSummary.ts`

- [ ] **Step 1: Write the file.**

```ts
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
```

- [ ] **Step 2: Type check.**

Run: `npx tsc --noEmit`
Expected: zero errors.

- [ ] **Step 3: Commit.**

```bash
git add components/Rules/ruleSummary.ts
git commit -m "rules: add ruleSummary plain-English helper"
```

---

### Task 16: Build `ConditionInput` component

A single condition row: `[field ▾] [op ▾] [value]`. The value input adapts to the chosen field's type.

**Files:**
- Create: `components/Rules/ConditionInput.tsx`

- [ ] **Step 1: Write the component.**

```tsx
'use client';

import { RuleCondition, ConditionOp } from '@/types/rule';
import { PDFField } from '@/types/pdf';

interface ConditionInputProps {
  condition: RuleCondition;
  fields: PDFField[];
  onChange: (next: RuleCondition) => void;
  onRemove: () => void;
}

const OPS_BY_TYPE: Record<string, ConditionOp[]> = {
  text: ['eq', 'neq', 'contains'],
  date: ['eq', 'neq'],
  number: ['eq', 'neq', 'gt', 'lt'],
  dropdown: ['eq', 'neq'],
  radio: ['eq', 'neq'],
  checkbox: ['eq'],
};

const OP_LABELS: Record<ConditionOp, string> = {
  eq: 'is',
  neq: 'is not',
  contains: 'contains',
  gt: '>',
  lt: '<',
};

export default function ConditionInput({
  condition,
  fields,
  onChange,
  onRemove,
}: ConditionInputProps) {
  const field = fields.find((f) => f.name === condition.fieldName);
  const fieldType = field?.type || 'text';
  const allowedOps = OPS_BY_TYPE[fieldType] || ['eq'];

  // If current op isn't allowed for this field type, snap to first allowed.
  const op: ConditionOp = allowedOps.includes(condition.op) ? condition.op : allowedOps[0];

  function renderValueInput() {
    if (!field) {
      return (
        <input
          type="text"
          value={String(condition.value ?? '')}
          onChange={(e) => onChange({ ...condition, value: e.target.value })}
          placeholder="Value"
          className="input flex-1"
        />
      );
    }

    if (field.type === 'checkbox') {
      return (
        <select
          value={String(condition.value)}
          onChange={(e) => onChange({ ...condition, value: e.target.value === 'true' })}
          className="input"
        >
          <option value="true">checked</option>
          <option value="false">unchecked</option>
        </select>
      );
    }

    if ((field.type === 'dropdown' || field.type === 'radio') && field.options?.length) {
      return (
        <select
          value={String(condition.value ?? '')}
          onChange={(e) => onChange({ ...condition, value: e.target.value })}
          className="input"
        >
          <option value="">—</option>
          {field.options.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      );
    }

    if (field.type === 'number') {
      return (
        <input
          type="number"
          value={String(condition.value ?? '')}
          onChange={(e) => onChange({ ...condition, value: Number(e.target.value) })}
          className="input flex-1"
        />
      );
    }

    if (field.type === 'date') {
      return (
        <input
          type="date"
          value={String(condition.value ?? '')}
          onChange={(e) => onChange({ ...condition, value: e.target.value })}
          className="input flex-1"
        />
      );
    }

    return (
      <input
        type="text"
        value={String(condition.value ?? '')}
        onChange={(e) => onChange({ ...condition, value: e.target.value })}
        placeholder="Value"
        className="input flex-1"
      />
    );
  }

  return (
    <div className="flex gap-2 items-center">
      <select
        value={condition.fieldName}
        onChange={(e) => onChange({ ...condition, fieldName: e.target.value })}
        className="input flex-[2]"
      >
        <option value="">Select field…</option>
        {fields.map((f) => (
          <option key={f.name} value={f.name}>
            {f.label || f.name}
          </option>
        ))}
      </select>

      <select
        value={op}
        onChange={(e) => onChange({ ...condition, op: e.target.value as ConditionOp })}
        className="input"
      >
        {allowedOps.map((o) => (
          <option key={o} value={o}>
            {OP_LABELS[o]}
          </option>
        ))}
      </select>

      {renderValueInput()}

      <button
        type="button"
        onClick={onRemove}
        className="btn btn-ghost btn-sm"
        aria-label="Remove condition"
      >
        ×
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Type check.**

Run: `npx tsc --noEmit`
Expected: zero errors.

- [ ] **Step 3: Commit.**

```bash
git add components/Rules/ConditionInput.tsx
git commit -m "rules: add ConditionInput component (type-aware value input)"
```

---

### Task 17: Build `ActionInput` component

A single action row: `[set | clear] [field ▾] [= value]` (value hidden when clear).

**Files:**
- Create: `components/Rules/ActionInput.tsx`

- [ ] **Step 1: Write the component.**

```tsx
'use client';

import { RuleAction } from '@/types/rule';
import { PDFField } from '@/types/pdf';

interface ActionInputProps {
  action: RuleAction;
  fields: PDFField[];
  onChange: (next: RuleAction) => void;
  onRemove: () => void;
}

export default function ActionInput({ action, fields, onChange, onRemove }: ActionInputProps) {
  const field = fields.find((f) => f.name === action.fieldName);

  function renderValueInput() {
    if (action.type === 'clear') return null;
    if (!field) {
      return (
        <input
          type="text"
          value={String(action.value ?? '')}
          onChange={(e) => onChange({ ...action, value: e.target.value })}
          placeholder="Value"
          className="input flex-1"
        />
      );
    }

    if (field.type === 'checkbox') {
      return (
        <select
          value={String(action.value)}
          onChange={(e) => onChange({ ...action, value: e.target.value === 'true' })}
          className="input"
        >
          <option value="true">checked</option>
          <option value="false">unchecked</option>
        </select>
      );
    }

    if ((field.type === 'dropdown' || field.type === 'radio') && field.options?.length) {
      return (
        <select
          value={String(action.value ?? '')}
          onChange={(e) => onChange({ ...action, value: e.target.value })}
          className="input"
        >
          <option value="">—</option>
          {field.options.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      );
    }

    if (field.type === 'number') {
      return (
        <input
          type="number"
          value={String(action.value ?? '')}
          onChange={(e) => onChange({ ...action, value: Number(e.target.value) })}
          className="input flex-1"
        />
      );
    }

    if (field.type === 'date') {
      return (
        <input
          type="date"
          value={String(action.value ?? '')}
          onChange={(e) => onChange({ ...action, value: e.target.value })}
          className="input flex-1"
        />
      );
    }

    return (
      <input
        type="text"
        value={String(action.value ?? '')}
        onChange={(e) => onChange({ ...action, value: e.target.value })}
        placeholder="Value"
        className="input flex-1"
      />
    );
  }

  return (
    <div className="flex gap-2 items-center">
      <select
        value={action.type}
        onChange={(e) => onChange({ ...action, type: e.target.value as 'set' | 'clear' })}
        className="input"
      >
        <option value="set">Set</option>
        <option value="clear">Clear</option>
      </select>

      <select
        value={action.fieldName}
        onChange={(e) => onChange({ ...action, fieldName: e.target.value })}
        className="input flex-[2]"
      >
        <option value="">Select field…</option>
        {fields.map((f) => (
          <option key={f.name} value={f.name}>
            {f.label || f.name}
          </option>
        ))}
      </select>

      {renderValueInput()}

      <button
        type="button"
        onClick={onRemove}
        className="btn btn-ghost btn-sm"
        aria-label="Remove action"
      >
        ×
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Type check.**

Run: `npx tsc --noEmit`
Expected: zero errors.

- [ ] **Step 3: Commit.**

```bash
git add components/Rules/ActionInput.tsx
git commit -m "rules: add ActionInput component"
```

---

### Task 18: Build `RuleRow` component (collapsed/expanded)

**Files:**
- Create: `components/Rules/RuleRow.tsx`

- [ ] **Step 1: Write the component.**

```tsx
'use client';

import { useState } from 'react';
import { GripVertical, MoreHorizontal, Plus, AlertTriangle } from 'lucide-react';
import { Rule, RuleCondition, RuleAction, ConditionOp } from '@/types/rule';
import { PDFField } from '@/types/pdf';
import { summarizeRule } from './ruleSummary';
import ConditionInput from './ConditionInput';
import ActionInput from './ActionInput';

interface RuleRowProps {
  rule: Rule & { _missingFieldRefs?: string[] };
  fields: PDFField[];
  conflictsWith?: string[]; // rule IDs this rule conflicts with
  onChange: (next: Rule) => void;
  onDelete: () => void;
  onDuplicate: () => void;
}

export default function RuleRow({
  rule,
  fields,
  conflictsWith,
  onChange,
  onDelete,
  onDuplicate,
}: RuleRowProps) {
  const [expanded, setExpanded] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const summary = summarizeRule(rule, fields);
  const hasMissing = rule._missingFieldRefs && rule._missingFieldRefs.length > 0;
  const hasConflict = conflictsWith && conflictsWith.length > 0;

  function setConnector(c: 'AND' | 'OR') {
    onChange({
      ...rule,
      conditionGroup: { ...rule.conditionGroup, connector: c },
    });
  }

  function updateCondition(idx: number, next: RuleCondition) {
    const conds = [...rule.conditionGroup.conditions];
    conds[idx] = next;
    onChange({ ...rule, conditionGroup: { ...rule.conditionGroup, conditions: conds } });
  }

  function addCondition() {
    const next: RuleCondition = { fieldName: '', op: 'eq' as ConditionOp, value: '' };
    onChange({
      ...rule,
      conditionGroup: {
        ...rule.conditionGroup,
        conditions: [...rule.conditionGroup.conditions, next],
      },
    });
  }

  function removeCondition(idx: number) {
    const conds = rule.conditionGroup.conditions.filter((_, i) => i !== idx);
    onChange({ ...rule, conditionGroup: { ...rule.conditionGroup, conditions: conds } });
  }

  function updateAction(idx: number, next: RuleAction) {
    const acts = [...rule.actions];
    acts[idx] = next;
    onChange({ ...rule, actions: acts });
  }

  function addAction() {
    const next: RuleAction = { type: 'set', fieldName: '', value: '' };
    onChange({ ...rule, actions: [...rule.actions, next] });
  }

  function removeAction(idx: number) {
    onChange({ ...rule, actions: rule.actions.filter((_, i) => i !== idx) });
  }

  return (
    <div className="border border-paper-edge rounded-md bg-paper-card">
      <div className="flex items-center gap-2 px-3 py-2">
        <GripVertical
          className="w-4 h-4 text-ink-faint shrink-0 cursor-grab"
          aria-label="Drag to reorder"
        />
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex-1 text-left text-sm text-ink hover:text-ink-strong"
        >
          {summary}
        </button>
        {hasMissing && (
          <span
            className="inline-flex items-center gap-1 text-xs text-amber-700 bg-amber-100 px-2 py-0.5 rounded"
            title={`Missing fields: ${rule._missingFieldRefs?.join(', ')}`}
          >
            <AlertTriangle className="w-3 h-3" />
            missing field
          </span>
        )}
        {hasConflict && (
          <span
            className="inline-flex items-center gap-1 text-xs text-amber-700 bg-amber-100 px-2 py-0.5 rounded"
            title={`Conflicts with: ${conflictsWith?.join(', ')}`}
          >
            <AlertTriangle className="w-3 h-3" />
            conflict
          </span>
        )}
        <div className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className="btn btn-ghost btn-sm"
            aria-label="Rule actions"
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-7 z-10 bg-paper-card border border-paper-edge rounded-md shadow-md py-1 min-w-[140px]">
              <button
                onClick={() => {
                  onDuplicate();
                  setMenuOpen(false);
                }}
                className="w-full text-left px-3 py-1.5 text-sm hover:bg-paper-edge"
              >
                Duplicate
              </button>
              <button
                onClick={() => {
                  onDelete();
                  setMenuOpen(false);
                }}
                className="w-full text-left px-3 py-1.5 text-sm hover:bg-paper-edge text-red-600"
              >
                Delete
              </button>
            </div>
          )}
        </div>
      </div>

      {expanded && (
        <div className="px-3 pb-3 pt-1 border-t border-paper-edge space-y-3">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs uppercase tracking-wide text-ink-faint">When</span>
              <select
                value={rule.conditionGroup.connector}
                onChange={(e) => setConnector(e.target.value as 'AND' | 'OR')}
                className="input input-sm"
              >
                <option value="AND">All of</option>
                <option value="OR">Any of</option>
              </select>
              <span className="text-xs text-ink-faint">these are true</span>
            </div>
            <div className="space-y-2">
              {rule.conditionGroup.conditions.map((c, idx) => {
                if ('connector' in c) {
                  return (
                    <div key={idx} className="text-xs text-ink-faint italic px-2">
                      (nested group — edit via JSON; v1 UI ships flat)
                    </div>
                  );
                }
                return (
                  <ConditionInput
                    key={idx}
                    condition={c}
                    fields={fields}
                    onChange={(next) => updateCondition(idx, next)}
                    onRemove={() => removeCondition(idx)}
                  />
                );
              })}
            </div>
            <button
              type="button"
              onClick={addCondition}
              className="mt-2 btn btn-ghost btn-sm flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              Add condition
            </button>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs uppercase tracking-wide text-ink-faint">Then</span>
            </div>
            <div className="space-y-2">
              {rule.actions.map((a, idx) => (
                <ActionInput
                  key={idx}
                  action={a}
                  fields={fields}
                  onChange={(next) => updateAction(idx, next)}
                  onRemove={() => removeAction(idx)}
                />
              ))}
            </div>
            <button
              type="button"
              onClick={addAction}
              className="mt-2 btn btn-ghost btn-sm flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              Add action
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Type check.**

Run: `npx tsc --noEmit`
Expected: zero errors.

- [ ] **Step 3: Commit.**

```bash
git add components/Rules/RuleRow.tsx
git commit -m "rules: add RuleRow with collapsed/expanded views"
```

---

### Task 19: Build `RuleList` component (with reorder)

Drag-to-reorder is implemented with native HTML5 DnD — no extra deps.

**Files:**
- Create: `components/Rules/RuleList.tsx`

- [ ] **Step 1: Write the component.**

```tsx
'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Rule } from '@/types/rule';
import { PDFField } from '@/types/pdf';
import RuleRow from './RuleRow';
import { newRuleId } from '@/lib/firestore/rules';

interface RuleListProps {
  rules: Array<Rule & { _missingFieldRefs?: string[] }>;
  fields: PDFField[];
  conflicts: { fieldName: string; ruleIds: string[] }[];
  onRulesChange: (next: Rule[]) => void;
}

export default function RuleList({ rules, fields, conflicts, onRulesChange }: RuleListProps) {
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const conflictsByRule = new Map<string, string[]>();
  for (const c of conflicts) {
    for (const id of c.ruleIds) {
      const others = c.ruleIds.filter((x) => x !== id);
      conflictsByRule.set(id, [...(conflictsByRule.get(id) || []), ...others]);
    }
  }

  function updateRule(idx: number, next: Rule) {
    const out = [...rules];
    out[idx] = next;
    onRulesChange(out);
  }

  function deleteRule(idx: number) {
    onRulesChange(rules.filter((_, i) => i !== idx));
  }

  function duplicateRule(idx: number) {
    const orig = rules[idx];
    const copy: Rule = {
      ...orig,
      id: newRuleId(),
      name: orig.name ? `${orig.name} (copy)` : undefined,
      conditionGroup: structuredClone(orig.conditionGroup),
      actions: structuredClone(orig.actions),
    };
    const out = [...rules];
    out.splice(idx + 1, 0, copy);
    onRulesChange(out);
  }

  function addRule() {
    const blank: Rule = {
      id: newRuleId(),
      conditionGroup: {
        connector: 'AND',
        conditions: [{ fieldName: '', op: 'eq', value: '' }],
      },
      actions: [{ type: 'set', fieldName: '', value: '' }],
    };
    onRulesChange([...rules, blank]);
  }

  function handleDragStart(e: React.DragEvent, id: string) {
    setDraggingId(id);
    e.dataTransfer.effectAllowed = 'move';
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }

  function handleDrop(e: React.DragEvent, dropIdx: number) {
    e.preventDefault();
    if (!draggingId) return;
    const fromIdx = rules.findIndex((r) => r.id === draggingId);
    if (fromIdx === -1 || fromIdx === dropIdx) return;

    const out = [...rules];
    const [moved] = out.splice(fromIdx, 1);
    out.splice(dropIdx > fromIdx ? dropIdx - 1 : dropIdx, 0, moved);
    onRulesChange(out);
    setDraggingId(null);
  }

  if (rules.length === 0) {
    return (
      <div className="text-center py-12 text-sm text-ink-faint">
        <p className="mb-3">No rules yet.</p>
        <p className="mb-4">Type a sentence in the chat or click below to add one manually.</p>
        <button
          type="button"
          onClick={addRule}
          className="btn btn-ghost btn-sm inline-flex items-center gap-1.5"
        >
          <Plus className="w-4 h-4" />
          Add rule
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {rules.map((rule, idx) => (
        <div
          key={rule.id}
          draggable
          onDragStart={(e) => handleDragStart(e, rule.id)}
          onDragOver={handleDragOver}
          onDrop={(e) => handleDrop(e, idx)}
          className={draggingId === rule.id ? 'opacity-50' : ''}
        >
          <RuleRow
            rule={rule}
            fields={fields}
            conflictsWith={conflictsByRule.get(rule.id)}
            onChange={(next) => updateRule(idx, next)}
            onDelete={() => deleteRule(idx)}
            onDuplicate={() => duplicateRule(idx)}
          />
        </div>
      ))}
      <button
        type="button"
        onClick={addRule}
        className="btn btn-ghost btn-sm inline-flex items-center gap-1.5 mt-1"
      >
        <Plus className="w-4 h-4" />
        Add rule
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Type check.**

Run: `npx tsc --noEmit`
Expected: zero errors.

- [ ] **Step 3: Commit.**

```bash
git add components/Rules/RuleList.tsx
git commit -m "rules: add RuleList with drag-to-reorder"
```

---

### Task 20: Build `RuleEditor` two-pane container

The chat pane is a placeholder until Phase 5 — it renders a "Coming soon" panel for now. This lets us ship the manual builder as Ship 2 and add the chat as Ship 3 without restructuring the container.

**Files:**
- Create: `components/Rules/RuleEditor.tsx`

- [ ] **Step 1: Write the component.**

```tsx
'use client';

import { useMemo } from 'react';
import { X } from 'lucide-react';
import { Rule } from '@/types/rule';
import { PDFField, FormValues } from '@/types/pdf';
import { applyRules } from '@/lib/ruleEngine';
import { pruneRules } from '@/lib/firestore/documents';
import RuleList from './RuleList';

interface RuleEditorProps {
  rules: Rule[];
  fields: PDFField[];
  formValues: FormValues;
  onClose: () => void;
  onRulesChange: (next: Rule[]) => void;
}

export default function RuleEditor({
  rules,
  fields,
  formValues,
  onClose,
  onRulesChange,
}: RuleEditorProps) {
  // Annotate rules with missing-field refs for inline warnings.
  const annotatedRules = useMemo(() => pruneRules(fields, rules), [fields, rules]);

  // Compute live conflicts so the user sees them update as they edit rules.
  const conflicts = useMemo(() => {
    const result = applyRules(rules, formValues, new Set(fields.map((f) => f.name)), fields);
    return result.conflicts;
  }, [rules, formValues, fields]);

  return (
    <div className="fixed inset-0 z-50 bg-paper">
      <div className="max-w-[1280px] mx-auto h-full flex flex-col">
        <div className="flex items-center justify-between px-8 py-4 hairline">
          <h2 className="font-serif text-xl text-ink">Rules</h2>
          <button onClick={onClose} className="btn btn-ghost btn-sm" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 grid grid-cols-2 gap-6 px-8 py-6 overflow-hidden">
          <div className="overflow-y-auto pr-2">
            <RuleList
              rules={annotatedRules}
              fields={fields}
              conflicts={conflicts}
              onRulesChange={onRulesChange}
            />
          </div>

          <div className="border-l border-paper-edge pl-6 overflow-y-auto">
            <div className="text-center py-12 text-sm text-ink-faint">
              <p className="mb-2">Plain-English rule chat</p>
              <p className="text-xs">Coming in the next ship.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Type check.**

Run: `npx tsc --noEmit`
Expected: zero errors.

- [ ] **Step 3: Commit.**

```bash
git add components/Rules/RuleEditor.tsx
git commit -m "rules: add RuleEditor two-pane container (chat pane TBD)"
```

---

### Task 21: Wire the rule engine into `app/page.tsx`

This is the largest single task in the plan. Adds `ruleTouched` tracking, baseline computation, engine invocation on every change, and the "Rules" button in the form-fill view that opens the editor.

**Files:**
- Modify: `app/page.tsx`

- [ ] **Step 1: Add imports.** Near the existing imports:

```tsx
import { Rule } from '@/types/rule';
import { applyRules } from '@/lib/ruleEngine';
import { saveRules } from '@/lib/firestore/rules';
import RuleEditor from '@/components/Rules/RuleEditor';
import { Settings2 } from 'lucide-react';
```

- [ ] **Step 2: Add new state declarations** alongside `untouchedDefaults`:

```tsx
const [ruleTouched, setRuleTouched] = useState<Map<string, string>>(new Map());
const [showRuleEditor, setShowRuleEditor] = useState(false);
```

- [ ] **Step 3: Add a baseline-recompute helper.** Place this above the component (next to `applyProfileDefaults` from Task 10):

```tsx
/**
 * Computes the baseline values for the rule engine: profile defaults under
 * doc defaults under user-edited values. Caller passes only the user-edited
 * values; this function layers profile and doc defaults beneath.
 */
function computeBaseline(
  fields: PDFField[],
  profile: ProfileDefaults | null,
  docDefaults: Record<string, string | boolean | number> | undefined,
  userEdited: Record<string, string | boolean | number>
): Record<string, string | boolean | number> {
  const withProfile = applyProfileDefaults(fields, profile, {});
  return { ...withProfile, ...(docDefaults ?? {}), ...userEdited };
}
```

- [ ] **Step 4: Update `handleDocumentSelect`** to seed `ruleTouched` and run the engine after defaults.

Find the function. After the existing `setFormValues(layered)` and `setUntouchedDefaults(...)` lines from Task 10, insert engine application:

```tsx
const handleDocumentSelect = async (doc: PDFDocument) => {
  setCurrentDocument(doc);
  const withProfile = applyProfileDefaults(doc.fieldDefinitions, profileDefaults, {});
  const layered = { ...withProfile, ...(doc.defaultValues ?? {}) };

  // Run the rule engine over the seeded baseline.
  const overwritable = new Set(Object.keys(layered));
  const rulesResult = applyRules(
    doc.rules ?? [],
    layered,
    overwritable,
    doc.fieldDefinitions
  );

  setFormValues(rulesResult.newValues);
  setUntouchedDefaults(new Set(Object.keys(rulesResult.newValues)));
  setRuleTouched(rulesResult.ruleTouched);
  setViewMode('loading');
  setProcessing(true);
  // ...rest of the function unchanged
};
```

- [ ] **Step 5: Reset `ruleTouched` in the other reset sites** that already touch `untouchedDefaults`:

In `handleFileSelect` (after the existing `setUntouchedDefaults(new Set())`):

```tsx
setUntouchedDefaults(new Set());
setRuleTouched(new Map());
```

In `handleNewDocument`:

```tsx
setUntouchedDefaults(new Set());
setRuleTouched(new Map());
```

- [ ] **Step 6: Update `handleFormChange`** to (a) drop the field from `ruleTouched` and (b) re-run the engine with the new baseline.

```tsx
const handleFormChange = (fieldName: string, value: any) => {
  // Compute the new user-edited values map: previous user-edited + this change.
  // A field is "user-edited" if it's NOT in untouchedDefaults AND NOT in ruleTouched.
  const newFormValues = { ...formValues, [fieldName]: value };

  setUntouchedDefaults((prev) => {
    if (!prev.has(fieldName)) return prev;
    const next = new Set(prev);
    next.delete(fieldName);
    return next;
  });
  setRuleTouched((prev) => {
    if (!prev.has(fieldName)) return prev;
    const next = new Map(prev);
    next.delete(fieldName);
    return next;
  });

  // Build the user-edited subset for the new baseline.
  const userEdited: Record<string, string | boolean | number> = {};
  for (const [name, v] of Object.entries(newFormValues)) {
    if (untouchedDefaults.has(name) && name !== fieldName) continue;
    if (ruleTouched.has(name) && name !== fieldName) continue;
    userEdited[name] = v as any;
  }

  const baseline = computeBaseline(
    fields,
    profileDefaults,
    currentDocument?.defaultValues,
    userEdited
  );

  const rules = currentDocument?.rules ?? [];
  // Overwritable = fields the rules are allowed to write: untouchedDefaults
  // (minus the just-edited field) ∪ previous ruleTouched (minus the just-edited field).
  const overwritable = new Set<string>();
  for (const n of untouchedDefaults) if (n !== fieldName) overwritable.add(n);
  for (const n of ruleTouched.keys()) if (n !== fieldName) overwritable.add(n);
  // Also: any field absent from the baseline is overwritable (rules can fill empties).
  for (const f of fields) {
    if (!(f.name in baseline) && f.name !== fieldName) overwritable.add(f.name);
  }

  const result = applyRules(rules, baseline, overwritable, fields);
  setFormValues(result.newValues);
  setRuleTouched(result.ruleTouched);
  setAutoSavedAt(new Date());
};
```

- [ ] **Step 7: Update `handleFieldFocus`** the same way it already drops `untouchedDefaults`, also drop `ruleTouched`:

```tsx
const handleFieldFocus = (fieldName: string) => {
  setActiveFieldName(fieldName);
  setUntouchedDefaults((prev) => {
    if (!prev.has(fieldName)) return prev;
    const next = new Set(prev);
    next.delete(fieldName);
    return next;
  });
  setRuleTouched((prev) => {
    if (!prev.has(fieldName)) return prev;
    const next = new Map(prev);
    next.delete(fieldName);
    return next;
  });
};
```

- [ ] **Step 8: Add a Rules button + the editor mount.** In the form-fill view JSX (find the existing top-bar with the "Save" button — around line 580-650 depending on edits), add a "Rules" button next to it:

```tsx
{currentDocument && (
  <button
    onClick={() => setShowRuleEditor(true)}
    className="btn btn-ghost btn-sm flex items-center gap-1.5"
    title="Edit rules"
  >
    <Settings2 className="w-4 h-4" />
    Rules{currentDocument.rules?.length ? ` (${currentDocument.rules.length})` : ''}
  </button>
)}
```

Render the editor at the end of the page render (just before the final closing tags), conditionally:

```tsx
{showRuleEditor && currentDocument && (
  <RuleEditor
    rules={currentDocument.rules ?? []}
    fields={fields}
    formValues={formValues}
    onClose={() => setShowRuleEditor(false)}
    onRulesChange={async (nextRules) => {
      const prev = currentDocument.rules ?? [];
      setCurrentDocument({ ...currentDocument, rules: nextRules });
      try {
        await saveRules(currentDocument.id, nextRules);
      } catch (e) {
        console.warn('Error saving rules:', e);
        setCurrentDocument({ ...currentDocument, rules: prev });
      }
      // After saving, re-run the engine — rule changes may immediately affect
      // the form-fill view.
      const userEdited: Record<string, string | boolean | number> = {};
      for (const [name, v] of Object.entries(formValues)) {
        if (untouchedDefaults.has(name)) continue;
        if (ruleTouched.has(name)) continue;
        userEdited[name] = v as any;
      }
      const baseline = computeBaseline(
        fields,
        profileDefaults,
        currentDocument.defaultValues,
        userEdited
      );
      const overwritable = new Set<string>([
        ...untouchedDefaults,
        ...ruleTouched.keys(),
        ...fields.filter((f) => !(f.name in baseline)).map((f) => f.name),
      ]);
      const result = applyRules(nextRules, baseline, overwritable, fields);
      setFormValues(result.newValues);
      setRuleTouched(result.ruleTouched);
    }}
  />
)}
```

- [ ] **Step 9: Type check.**

Run: `npx tsc --noEmit`
Expected: zero errors.

- [ ] **Step 10: Manual end-to-end test.**

Run: `npm run dev`. Open a saved document. Click the new "Rules" button — the editor opens (left pane shows the empty state, right pane shows "Coming soon"). Click "Add rule." A new rule row appears. Expand it, set: condition `Financing` `is` `Cash`, action `Set` `Loan Amount` `=` `0`. Close the editor. Back in the form view, change Financing dropdown → Cash. Loan Amount should auto-fill to 0. Change Financing → Conventional. Loan Amount returns to baseline (likely empty unless there was a default).

Edit Loan Amount manually to `50000`. Switch Financing back to Cash. Loan Amount stays at `50000` (user-edited fields are immutable from rules). Refresh the page. Loan Amount stays at `50000` because the saved formValues include that user edit — but wait, `formValues` aren't persisted yet. On reload from list, the document opens fresh and the rule fires anew with Loan Amount = 0. Confirm that behavior matches your expectation. (`formValues` persistence is out of scope for this plan; the `filledPdfs` array stores filled outputs only.)

- [ ] **Step 11: Commit.**

```bash
git add app/page.tsx
git commit -m "page: wire rule engine + Rules editor button into form view"
```

---

### Task 22: Add ✦ indicator to rule-touched fields

**Files:**
- Modify: `components/FormFieldRenderer.tsx`

- [ ] **Step 1: Update icon imports** in `FormFieldRenderer.tsx`:

```tsx
import { Eye, Check, Pin, RotateCcw, Sparkles } from 'lucide-react';
```

- [ ] **Step 2: Extend `FormFieldRendererProps`:**

```tsx
interface FormFieldRendererProps {
  // ...existing props
  ruleTouched?: Map<string, string>;
  rulesIndex?: Map<string, Rule>; // for tooltip text
  onClearRuleTouched?: (fieldName: string) => void;
}
```

Don't forget to import `Rule`:

```tsx
import type { Rule } from '@/types/rule';
```

Destructure them in the function signature:

```tsx
ruleTouched,
rulesIndex,
onClearRuleTouched,
```

- [ ] **Step 3: Render the ✦ icon.** Inside the `section.fields.map` callback, in the same label-row block where the pin button lives (added in the prior plan), insert a sparkles button before the pin button:

```tsx
{ruleTouched?.has(field.name) && (() => {
  const ruleId = ruleTouched.get(field.name);
  const rule = ruleId ? rulesIndex?.get(ruleId) : undefined;
  const ruleSummaryText = rule
    ? `Filled by rule: ${rule.name || ruleId?.slice(0, 6)}`
    : 'Filled by a rule';
  return (
    <button
      type="button"
      onClick={() => onClearRuleTouched?.(field.name)}
      className="p-1 rounded text-accent hover:bg-accent-tint"
      title={`${ruleSummaryText} — click to override manually`}
      aria-label="Override rule-filled value"
    >
      <Sparkles className="w-3.5 h-3.5" strokeWidth={1.8} />
    </button>
  );
})()}
```

- [ ] **Step 4: Pass the new props from `app/page.tsx`.** Find the `<FormFieldRenderer />` invocation. Build a `rulesIndex` derived from `currentDocument.rules`:

```tsx
const rulesIndex = useMemo(() => {
  const m = new Map<string, Rule>();
  for (const r of currentDocument?.rules ?? []) m.set(r.id, r);
  return m;
}, [currentDocument?.rules]);
```

Add the `useMemo` import if missing. Pass to the renderer:

```tsx
<FormFieldRenderer
  // ...existing props
  ruleTouched={ruleTouched}
  rulesIndex={rulesIndex}
  onClearRuleTouched={(fieldName) => {
    setRuleTouched((prev) => {
      const next = new Map(prev);
      next.delete(fieldName);
      return next;
    });
  }}
/>
```

- [ ] **Step 5: Type check.**

Run: `npx tsc --noEmit`
Expected: zero errors.

- [ ] **Step 6: Manual UI test.**

Run: `npm run dev`. Open a doc with a rule that fires (use the one from Task 21). Trigger the rule. Confirm the rule-touched field shows a small sparkle icon next to its label. Hover → tooltip "Filled by rule: …". Click the sparkle → it disappears, and the field value is now treated as user-edited (re-firing the trigger doesn't overwrite).

- [ ] **Step 7: Phase 4 build check.**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 8: Commit.**

```bash
git add components/FormFieldRenderer.tsx app/page.tsx
git commit -m "form-renderer: add ✦ indicator + manual override for rule-touched fields"
```

---

🚢 **SHIP 2** — Manual rule builder is live. Realtors can author rules by hand; engine fires on every field change. Stop here for an interim deploy if desired.

---

## Phase 5 — LLM chat sidebar (SHIP 3)

Replaces the placeholder right pane in `RuleEditor` with a working chat that calls `/api/rule-chat`.

### Task 23: Add `zod` for tool-input validation

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install zod.**

Run:
```bash
npm install zod
```

Expected: `zod` appears under `dependencies` in `package.json`.

- [ ] **Step 2: Type check.**

Run: `npx tsc --noEmit`
Expected: zero errors (installation only).

- [ ] **Step 3: Commit.**

```bash
git add package.json package-lock.json
git commit -m "deps: add zod for LLM tool-input validation"
```

---

### Task 24: Build the `/api/rule-chat` endpoint

OpenAI tool-calling endpoint. Validates tool arguments with zod, returns structured mutations the client applies locally.

**Files:**
- Create: `app/api/rule-chat/route.ts`

- [ ] **Step 1: Write the route.**

```ts
// app/api/rule-chat/route.ts
//
// Server-side LLM proxy for the rule chat. The client sends:
// - The conversation so far.
// - The document's current fieldDefinitions (so the model uses real names).
// - The document's current rules (so the model knows what already exists).
//
// The model can call tools: add_rule, edit_rule, delete_rule, list_rules.
// We validate each tool call's arguments with zod, then return the resulting
// mutations to the client. The client applies them and persists via
// lib/firestore/rules.ts. We do NOT touch Firestore from this route — the
// client owns persistence.
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import type { Rule, ChatMessage } from '@/types/rule';
import type { PDFField } from '@/types/pdf';

const SYSTEM_PROMPT = `You help a realtor configure conditional autofill rules for a PDF form. When the user describes a rule, call add_rule. When they ask to change one, call edit_rule. When they ask to remove one, call delete_rule (the client will confirm with the user before applying). When they ask "why" or "what rules exist", call list_rules and answer in plain English using the result.

CRITICAL CONSTRAINTS:
1. Use ONLY field names from the provided list. Never invent.
2. For dropdown/radio fields, use ONLY values from the field's options array.
3. If multiple fields could match the user's description, ask a clarifying question — do NOT guess. This is a legal document; wrong rules are worse than no rule.
4. Operators allowed: eq, neq, contains, gt, lt. gt/lt are number-only.
5. Action types allowed: set (with a value) or clear (no value).
6. Keep responses brief.`;

const ConditionSchema: z.ZodSchema<any> = z.lazy(() =>
  z.union([
    z.object({
      fieldName: z.string().min(1),
      op: z.enum(['eq', 'neq', 'contains', 'gt', 'lt']),
      value: z.union([z.string(), z.boolean(), z.number()]),
    }),
    z.object({
      connector: z.enum(['AND', 'OR']),
      conditions: z.array(ConditionSchema).min(1),
    }),
  ])
);

const ConditionGroupSchema = z.object({
  connector: z.enum(['AND', 'OR']),
  conditions: z.array(ConditionSchema).min(1),
});

const ActionSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('set'),
    fieldName: z.string().min(1),
    value: z.union([z.string(), z.boolean(), z.number()]),
  }),
  z.object({
    type: z.literal('clear'),
    fieldName: z.string().min(1),
  }),
]);

const AddRuleSchema = z.object({
  name: z.string().optional(),
  conditionGroup: ConditionGroupSchema,
  actions: z.array(ActionSchema).min(1),
});

const EditRuleSchema = z.object({
  ruleId: z.string().min(1),
  name: z.string().optional(),
  conditionGroup: ConditionGroupSchema.optional(),
  actions: z.array(ActionSchema).min(1).optional(),
});

const DeleteRuleSchema = z.object({
  ruleId: z.string().min(1),
});

const TOOLS = [
  {
    type: 'function' as const,
    function: {
      name: 'add_rule',
      description: 'Add a new rule. Returns the new rule ID.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Optional human label.' },
          conditionGroup: {
            type: 'object',
            properties: {
              connector: { type: 'string', enum: ['AND', 'OR'] },
              conditions: { type: 'array' },
            },
            required: ['connector', 'conditions'],
          },
          actions: { type: 'array', minItems: 1 },
        },
        required: ['conditionGroup', 'actions'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'edit_rule',
      description: 'Edit an existing rule. Pass only the fields you want to change.',
      parameters: {
        type: 'object',
        properties: {
          ruleId: { type: 'string' },
          name: { type: 'string' },
          conditionGroup: { type: 'object' },
          actions: { type: 'array' },
        },
        required: ['ruleId'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'delete_rule',
      description:
        'Request deletion of a rule. The client will confirm with the user before applying.',
      parameters: {
        type: 'object',
        properties: { ruleId: { type: 'string' } },
        required: ['ruleId'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'list_rules',
      description: 'List all current rules. Use this when the user asks about existing rules.',
      parameters: { type: 'object', properties: {} },
    },
  },
];

export type RuleMutation =
  | { kind: 'add'; rule: Rule }
  | { kind: 'edit'; ruleId: string; patch: Partial<Rule> }
  | { kind: 'delete-pending'; ruleId: string }; // client confirms before applying

interface ChatRequestBody {
  fields: PDFField[];
  rules: Rule[];
  history: ChatMessage[];
  userMessage: string;
}

interface ChatResponseBody {
  reply: string;
  mutations: RuleMutation[];
  rawToolCalls?: Array<{ tool: string; args: any; error?: string }>;
}

function newRuleIdServer(): string {
  return Math.random().toString(36).slice(2, 14);
}

function buildSystemContext(fields: PDFField[], rules: Rule[]): string {
  const fieldList = fields
    .map((f) => {
      const opts = f.options?.length ? ` options=[${f.options.join(', ')}]` : '';
      return `- ${f.name} (label="${f.label || f.name}", type=${f.type}${opts})`;
    })
    .join('\n');

  const ruleList =
    rules.length === 0
      ? 'No rules yet.'
      : rules
          .map((r) => `- ${r.id}: ${r.name || '(unnamed)'} — ${JSON.stringify(r)}`)
          .join('\n');

  return `Document fields:\n${fieldList}\n\nExisting rules:\n${ruleList}`;
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'OPENAI_API_KEY not configured' }, { status: 503 });
  }

  let body: ChatRequestBody;
  try {
    body = (await request.json()) as ChatRequestBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!body.fields || !Array.isArray(body.fields)) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  }
  if (!body.userMessage || typeof body.userMessage !== 'string') {
    return NextResponse.json({ error: 'Missing userMessage' }, { status: 400 });
  }

  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'system', content: buildSystemContext(body.fields, body.rules || []) },
    ...((body.history || []).map((m) => ({ role: m.role, content: m.content }))),
    { role: 'user', content: body.userMessage },
  ];

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages,
      tools: TOOLS,
      tool_choice: 'auto',
      temperature: 0.1,
      max_tokens: 1500,
    }),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    console.error('OpenAI rule-chat error:', errText.slice(0, 300));
    return NextResponse.json(
      { error: 'OpenAI request failed' },
      { status: 502 }
    );
  }

  const data = await response.json().catch(() => null);
  const choice = data?.choices?.[0];
  const reply: string = choice?.message?.content || '';
  const toolCalls: Array<{ id: string; function: { name: string; arguments: string } }> =
    choice?.message?.tool_calls || [];

  const mutations: RuleMutation[] = [];
  const rawToolCalls: Array<{ tool: string; args: any; error?: string }> = [];

  for (const tc of toolCalls) {
    const name = tc.function.name;
    let args: any;
    try {
      args = JSON.parse(tc.function.arguments);
    } catch (e) {
      rawToolCalls.push({ tool: name, args: tc.function.arguments, error: 'Invalid JSON' });
      continue;
    }

    if (name === 'add_rule') {
      const parsed = AddRuleSchema.safeParse(args);
      if (!parsed.success) {
        rawToolCalls.push({ tool: name, args, error: parsed.error.message });
        continue;
      }
      const fieldNames = new Set(body.fields.map((f) => f.name));
      const refs: string[] = [];
      const collectRefs = (g: any): void => {
        for (const c of g.conditions) {
          if (c.connector) collectRefs(c);
          else refs.push(c.fieldName);
        }
      };
      collectRefs(parsed.data.conditionGroup);
      for (const a of parsed.data.actions) refs.push(a.fieldName);
      const missing = refs.filter((n) => !fieldNames.has(n));
      if (missing.length) {
        rawToolCalls.push({
          tool: name,
          args,
          error: `Unknown fields: ${missing.join(', ')}`,
        });
        continue;
      }
      const rule: Rule = {
        id: newRuleIdServer(),
        name: parsed.data.name,
        conditionGroup: parsed.data.conditionGroup,
        actions: parsed.data.actions,
      };
      mutations.push({ kind: 'add', rule });
      rawToolCalls.push({ tool: name, args });
    } else if (name === 'edit_rule') {
      const parsed = EditRuleSchema.safeParse(args);
      if (!parsed.success) {
        rawToolCalls.push({ tool: name, args, error: parsed.error.message });
        continue;
      }
      mutations.push({
        kind: 'edit',
        ruleId: parsed.data.ruleId,
        patch: {
          ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
          ...(parsed.data.conditionGroup ? { conditionGroup: parsed.data.conditionGroup } : {}),
          ...(parsed.data.actions ? { actions: parsed.data.actions } : {}),
        },
      });
      rawToolCalls.push({ tool: name, args });
    } else if (name === 'delete_rule') {
      const parsed = DeleteRuleSchema.safeParse(args);
      if (!parsed.success) {
        rawToolCalls.push({ tool: name, args, error: parsed.error.message });
        continue;
      }
      mutations.push({ kind: 'delete-pending', ruleId: parsed.data.ruleId });
      rawToolCalls.push({ tool: name, args });
    } else if (name === 'list_rules') {
      // No mutation — the client renders existing rules. The model's text reply
      // contains the explanation; we just record the call.
      rawToolCalls.push({ tool: name, args });
    } else {
      rawToolCalls.push({ tool: name, args, error: `Unknown tool: ${name}` });
    }
  }

  const responseBody: ChatResponseBody = {
    reply: reply.trim(),
    mutations,
    rawToolCalls,
  };
  return NextResponse.json(responseBody);
}
```

- [ ] **Step 2: Type check.**

Run: `npx tsc --noEmit`
Expected: zero errors.

- [ ] **Step 3: Smoke test (no UI yet).**

Run: `npm run dev`. With `OPENAI_API_KEY` set in `.env.local`, hit the endpoint manually:

```bash
curl -X POST http://localhost:3000/api/rule-chat \
  -H 'Content-Type: application/json' \
  -d '{"fields":[{"name":"financing","label":"Financing","type":"dropdown","options":["Cash","Conventional"]},{"name":"loan_amount","label":"Loan Amount","type":"number"}],"rules":[],"history":[],"userMessage":"if financing is cash, set loan amount to 0"}'
```

Expected: response includes a `mutations` array with one `{ kind: 'add', rule: {...} }` whose conditionGroup matches financing=Cash and actions sets loan_amount=0. The `reply` text confirms creation.

If `OPENAI_API_KEY` isn't set, the route returns 503 — that's fine for offline development; just verify the 503 is returned cleanly with a clear error message.

- [ ] **Step 4: Commit.**

```bash
git add app/api/rule-chat/route.ts
git commit -m "api: add /rule-chat endpoint with zod-validated tool calls"
```

---

### Task 25: Build `RuleChat` component

**Files:**
- Create: `components/Rules/RuleChat.tsx`

- [ ] **Step 1: Write the component.**

```tsx
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
```

- [ ] **Step 2: Type check.**

Run: `npx tsc --noEmit`
Expected: zero errors.

- [ ] **Step 3: Commit.**

```bash
git add components/Rules/RuleChat.tsx
git commit -m "rules: add RuleChat component (chat UI + delete confirm + undo)"
```

---

### Task 26: Wire `RuleChat` into `RuleEditor`

Replaces the "Coming soon" placeholder with the actual chat. Adds mutation handling that translates `RuleMutation`s into rule list updates.

**Files:**
- Modify: `components/Rules/RuleEditor.tsx`

- [ ] **Step 1: Update imports.**

```tsx
import { useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { Rule, ChatMessage } from '@/types/rule';
import { PDFField, FormValues } from '@/types/pdf';
import { applyRules } from '@/lib/ruleEngine';
import { pruneRules } from '@/lib/firestore/documents';
import { appendChatMessage } from '@/lib/firestore/rules';
import RuleList from './RuleList';
import RuleChat from './RuleChat';
```

- [ ] **Step 2: Extend props.**

```tsx
interface RuleEditorProps {
  documentId: string;
  rules: Rule[];
  fields: PDFField[];
  formValues: FormValues;
  chatHistory: ChatMessage[];
  onClose: () => void;
  onRulesChange: (next: Rule[]) => void;
  onChatHistoryChange: (next: ChatMessage[]) => void;
}
```

- [ ] **Step 3: Replace the right-pane placeholder with `<RuleChat />`.** The full updated component body:

```tsx
export default function RuleEditor({
  documentId,
  rules,
  fields,
  formValues,
  chatHistory,
  onClose,
  onRulesChange,
  onChatHistoryChange,
}: RuleEditorProps) {
  const annotatedRules = useMemo(() => pruneRules(fields, rules), [fields, rules]);
  const conflicts = useMemo(() => {
    const result = applyRules(rules, formValues, new Set(fields.map((f) => f.name)), fields);
    return result.conflicts;
  }, [rules, formValues, fields]);

  async function applyMutationsAndMessages(
    mutations: any[],
    appendMessages: ChatMessage[]
  ) {
    let nextRules = rules;
    for (const m of mutations) {
      if (m.kind === 'add' && m.rule) {
        nextRules = [...nextRules, m.rule];
      } else if (m.kind === 'edit' && m.ruleId === '__replace_all__' && m.patch?._replaceAll) {
        nextRules = m.patch._replaceAll;
      } else if (m.kind === 'edit' && m.ruleId && m.patch?._delete) {
        nextRules = nextRules.filter((r) => r.id !== m.ruleId);
      } else if (m.kind === 'edit' && m.ruleId && m.patch) {
        nextRules = nextRules.map((r) =>
          r.id === m.ruleId ? { ...r, ...m.patch } : r
        );
      }
    }
    if (nextRules !== rules) onRulesChange(nextRules);

    if (appendMessages.length > 0) {
      let history = chatHistory;
      for (const msg of appendMessages) {
        history = await appendChatMessage(documentId, history, msg);
      }
      onChatHistoryChange(history);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-paper">
      <div className="max-w-[1280px] mx-auto h-full flex flex-col">
        <div className="flex items-center justify-between px-8 py-4 hairline">
          <h2 className="font-serif text-xl text-ink">Rules</h2>
          <button onClick={onClose} className="btn btn-ghost btn-sm" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 grid grid-cols-2 gap-6 px-8 py-6 overflow-hidden">
          <div className="overflow-y-auto pr-2">
            <RuleList
              rules={annotatedRules}
              fields={fields}
              conflicts={conflicts}
              onRulesChange={onRulesChange}
            />
          </div>

          <div className="border-l border-paper-edge pl-6 overflow-hidden flex flex-col">
            <RuleChat
              rules={rules}
              fields={fields}
              history={chatHistory}
              onApplyMutations={applyMutationsAndMessages}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Update the call site in `app/page.tsx`.** The editor now needs `documentId`, `chatHistory`, and an `onChatHistoryChange` callback:

```tsx
{showRuleEditor && currentDocument && (
  <RuleEditor
    documentId={currentDocument.id}
    rules={currentDocument.rules ?? []}
    fields={fields}
    formValues={formValues}
    chatHistory={currentDocument.chatHistory ?? []}
    onClose={() => setShowRuleEditor(false)}
    onRulesChange={async (nextRules) => {
      // ...existing handler from Task 21 unchanged
    }}
    onChatHistoryChange={(nextHistory) => {
      setCurrentDocument({ ...currentDocument, chatHistory: nextHistory });
    }}
  />
)}
```

- [ ] **Step 5: Type check.**

Run: `npx tsc --noEmit`
Expected: zero errors.

- [ ] **Step 6: Manual end-to-end test.**

Run: `npm run dev`. Open a saved document, click Rules. The right pane now shows the chat. Type: *"if financing is cash, set loan amount to 0"*. After ~1-2 seconds, the assistant replies with a confirmation, and a new rule appears in the left pane. Close the editor and trigger the rule from the form (set financing = Cash) — the loan_amount field auto-fills with the sparkle icon.

Reopen the editor. Type: *"why does loan_amount auto-fill?"*. The model calls `list_rules` and replies with a plain-English explanation referencing the rule.

Type: *"delete that rule"*. The chat shows a confirmation prompt with the rule summary. Click Delete — the rule disappears from the list.

Type: *"add another rule"* and immediately *"undo"* — the rule disappears (Undo button revealed). The undo flow restores the previous rule list.

- [ ] **Step 7: Phase 5 build check.**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 8: Commit.**

```bash
git add components/Rules/RuleEditor.tsx app/page.tsx
git commit -m "rules: wire RuleChat into editor with mutation/undo/delete-confirm flow"
```

---

🚢 **SHIP 3** — LLM chat is live. Realtors can author and audit rules in plain English. All three feature increments deployed.

---

## Phase 6 — Polish & verification

### Task 27: Wire `pruneRules` into field-edit return sites

When the user removes a field via the field creator or visual editor, rules referencing that field should get the missing-field annotation. Mirrors how Task 13 of the prior plan handled `pruneDefaults`.

**Files:**
- Modify: `app/page.tsx`

- [ ] **Step 1: Add the import.** Update the existing documents import to include `pruneRules`:

```tsx
import {
  saveDocument,
  getUserDocuments,
  deleteDocument,
  updateDocument,
  pruneDefaults,
  pruneRules,
} from '@/lib/firestore/documents';
```

- [ ] **Step 2: Update `handleFieldsCreated`.** Find the existing block where `pruneDefaults` is called (added in the prior plan, around line ~440 depending on edits). Add a parallel `pruneRules` call:

```tsx
if (currentDocument && user) {
  try {
    const pdfPath = `users/${user.uid}/documents/${currentDocument.id}/original.pdf`;
    await uploadPDF(modifiedFile, pdfPath);
    const prunedDefaults = pruneDefaults(createdFields, currentDocument.defaultValues);
    const prunedRules = pruneRules(createdFields, currentDocument.rules);
    // pruneRules returns rules with optional _missingFieldRefs annotations.
    // Strip the annotation before persisting (it's a UI-only artifact).
    const cleanRules = prunedRules.map(({ _missingFieldRefs, ...r }) => r);
    await updateDocument(currentDocument.id, {
      fieldDefinitions: createdFields,
      defaultValues: prunedDefaults,
      rules: cleanRules,
    });
    setCurrentDocument({
      ...currentDocument,
      fieldDefinitions: createdFields,
      defaultValues: prunedDefaults,
      rules: cleanRules,
    });
  } catch (error) {
    console.error('Error saving modified PDF:', error);
  }
}
```

- [ ] **Step 3: Update the `<PDFViewerEditor onFieldsChange={...} />` callback** the same way:

```tsx
onFieldsChange={(updatedFields) => {
  setFields(updatedFields);
  if (currentDocument) {
    const prunedDefaults = pruneDefaults(updatedFields, currentDocument.defaultValues);
    const prunedRules = pruneRules(updatedFields, currentDocument.rules);
    const cleanRules = prunedRules.map(({ _missingFieldRefs, ...r }) => r);
    setCurrentDocument({
      ...currentDocument,
      fieldDefinitions: updatedFields,
      defaultValues: prunedDefaults,
      rules: cleanRules,
    });
    updateDocument(currentDocument.id, {
      fieldDefinitions: updatedFields,
      defaultValues: prunedDefaults,
      rules: cleanRules,
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

Run: `npm run dev`. Open a saved document. Create a rule referencing field `X`. Open the visual editor and delete field `X`. Save. Reopen the Rules editor — the rule for `X` shows a "missing field" warning in the row (since `pruneRules` re-annotates on every render via `pruneRules(fields, rules)` inside `RuleEditor`).

- [ ] **Step 6: Commit.**

```bash
git add app/page.tsx
git commit -m "page: prune rules at field-edit return sites (annotates only)"
```

---

### Task 28: Full-feature manual sweep

**Files:** none.

- [ ] **Step 1: Lint.**

Run: `npm run lint`
Expected: clean (or only pre-existing warnings unrelated to this work).

- [ ] **Step 2: Build.**

Run: `npm run build`
Expected: build succeeds, no TS errors.

- [ ] **Step 3: All tests.**

Run: `npm run test`
Expected: vitest reports all rule engine tests passing.

- [ ] **Step 4: End-to-end manual flow.**

Run: `npm run dev`. Walk through every shipped feature:

**Profile defaults:**
1. From header → Profile. Set `Full Name` and `Email`. Auto-saves.
2. Open a saved doc with matching field labels. Confirm pre-fill (muted/italic). Click into a field — styling snaps to normal.
3. Edit profile → set a different `Full Name`. Reload an existing doc — already-filled formValues for that field are NOT retroactively rewritten unless they're still in untouched state (consistent with spec).

**Manual rule builder:**
4. Open a saved doc, click Rules. Add a manual rule: `When financing = Cash → set loan_amount = 0, clear lender_name`.
5. Close editor. Set financing = Cash on the form. Both `loan_amount` and `lender_name` update with sparkle icons. Hover — tooltip shows the rule reference.
6. Click the sparkle on loan_amount. Type a custom value. Switch financing to Conventional, then back to Cash. loan_amount stays at the user-typed value.
7. Add a second rule that conflicts: `When financing = Cash → set loan_amount = 100`. Both rules show conflict warnings in the editor. Drag rule order — the higher one wins.

**LLM chat:**
8. In Rules editor, type *"if first_time_buyer is checked, clear closing_days"*. The model adds the rule. Trigger it on the form — works.
9. Ask *"why did X auto-fill?"* (replace X with a rule-touched field). The model explains.
10. Ask *"delete the cash rule"*. Confirmation prompt appears. Click Delete. Rule disappears.
11. Hit Undo. Rule reappears.

**Field deletion:**
12. Open visual editor. Delete a field referenced by a rule. Save. Reopen Rules editor — the rule shows a yellow "missing field" warning. The rule is NOT auto-deleted.

**Cross-feature:**
13. Pin a default value (existing template-defaults feature). Then add a rule that targets the same field. Confirm the rule fires and overrides the pinned default — rule-touched takes precedence over pin (because the field is in `untouchedDefaults` initially, becoming `ruleTouched` after the rule fires).

Note any regression. Fix and add a small follow-up task if needed.

- [ ] **Step 5: Final commit (if anything was tweaked during the sweep).**

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

- Nested condition groups in the UI (data model supports them; v1 builder ships flat)
- History-inferred rule suggestions
- Cross-document rule reuse / named rule templates
- Fuzzy or semantic profile matching
- Multiple user profiles
- Always-on chat assistant during form fill
- Rule undo/redo history beyond the immediate Undo button
- Per-user model selection or BYO API key
- Streaming responses in the chat

---

## Risk notes

- **OpenAI tool-call schema drift**: gpt-4o-mini occasionally returns malformed tool arguments (extra keys, wrong types). The zod validation in `app/api/rule-chat/route.ts` rejects these — the user sees a tool-call error inline in the chat and can rephrase. Don't relax validation to "make it work"; the failure mode is intentional.
- **Realtor doc field-name volatility**: PDF documents reuploaded with the same name often have *different* internal field names (e.g., AcroForm regenerated fields named `field1`, `field2`). Rules are keyed by internal field name, so re-uploading effectively breaks rules even if labels are unchanged. Spec calls this out as a v2 problem (semantic matching). For now, the missing-field warning is the only mitigation.
- **Engine performance**: with realistic rule counts (<100/doc), `applyRules` is well under a frame. If a doc accumulates hundreds of rules, the per-keystroke recompute may show. Profile if reports come in; the obvious optimization is incremental evaluation (only re-evaluate rules whose triggers changed).
- **`structuredClone` browser support**: used in `RuleList.duplicateRule`. Universal in modern browsers (Chrome 98+, Safari 15.4+, Firefox 94+). If the user's target audience includes older browsers, swap for `JSON.parse(JSON.stringify(...))`.
- **Chat history retention**: capped at 50 messages by `MAX_CHAT_TURNS` in `lib/firestore/rules.ts:appendChatMessage`. Increase if support reports the cap is too tight.
- **Firestore rules deployment**: the new `userProfiles` rule must be deployed via `firebase deploy --only firestore:rules` before profile defaults work in production. Not something this plan automates.
