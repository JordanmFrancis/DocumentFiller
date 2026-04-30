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
//
// Provider: Anthropic (Claude Sonnet 4.5). System prompt + fields list use
// prompt caching so multi-turn conversations only pay for them once.
import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import type { Rule, ChatMessage } from '@/types/rule';
import type { PDFField } from '@/types/pdf';

const MODEL = 'claude-sonnet-4-5-20250929';

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

// Anthropic tool format: `name`, `description`, `input_schema` (JSON schema).
const TOOLS: Anthropic.Tool[] = [
  {
    name: 'add_rule',
    description: 'Add a new rule. Returns the new rule ID.',
    input_schema: {
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
  {
    name: 'edit_rule',
    description: 'Edit an existing rule. Pass only the fields you want to change.',
    input_schema: {
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
  {
    name: 'delete_rule',
    description:
      'Request deletion of a rule. The client will confirm with the user before applying.',
    input_schema: {
      type: 'object',
      properties: { ruleId: { type: 'string' } },
      required: ['ruleId'],
    },
  },
  {
    name: 'list_rules',
    description: 'List all current rules. Use this when the user asks about existing rules.',
    input_schema: { type: 'object', properties: {} },
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

function buildFieldsContext(fields: PDFField[]): string {
  const fieldList = fields
    .map((f) => {
      const opts = f.options?.length ? ` options=[${f.options.join(', ')}]` : '';
      return `- ${f.name} (label="${f.label || f.name}", type=${f.type}${opts})`;
    })
    .join('\n');
  return `Document fields:\n${fieldList}`;
}

function buildRulesContext(rules: Rule[]): string {
  if (rules.length === 0) return 'Existing rules: none.';
  const ruleList = rules
    .map((r) => `- ${r.id}: ${r.name || '(unnamed)'} — ${JSON.stringify(r)}`)
    .join('\n');
  return `Existing rules:\n${ruleList}`;
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'ANTHROPIC_API_KEY not configured' },
      { status: 503 }
    );
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

  const client = new Anthropic({ apiKey });

  // System blocks. The first two are cacheable — they stay constant across
  // turns within a single chat session, and the fields list is constant
  // unless the document is edited. Rules change frequently (every add/edit),
  // so it's NOT marked cacheable.
  const systemBlocks: Anthropic.TextBlockParam[] = [
    {
      type: 'text',
      text: SYSTEM_PROMPT,
      cache_control: { type: 'ephemeral' },
    },
    {
      type: 'text',
      text: buildFieldsContext(body.fields),
      cache_control: { type: 'ephemeral' },
    },
    {
      type: 'text',
      text: buildRulesContext(body.rules || []),
    },
  ];

  // History + new user message. Anthropic alternates user/assistant; the
  // chat history we persist is already in that shape.
  const messages: Anthropic.MessageParam[] = [
    ...((body.history || []).map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }))),
    { role: 'user' as const, content: body.userMessage },
  ];

  let response: Anthropic.Message;
  try {
    response = await client.messages.create({
      model: MODEL,
      max_tokens: 1500,
      system: systemBlocks,
      messages,
      tools: TOOLS,
    });
  } catch (e: any) {
    console.error('Anthropic rule-chat error:', e?.message?.slice(0, 300) ?? e);
    return NextResponse.json(
      { error: `Anthropic request failed: ${e?.message ?? 'unknown'}` },
      { status: 502 }
    );
  }

  // Extract text reply and tool uses from the response. Anthropic returns
  // `content` as an array of blocks; tool inputs come pre-parsed.
  let reply = '';
  const toolUses: Array<{ name: string; input: any }> = [];
  for (const block of response.content) {
    if (block.type === 'text') {
      reply += block.text;
    } else if (block.type === 'tool_use') {
      toolUses.push({ name: block.name, input: block.input });
    }
  }

  const mutations: RuleMutation[] = [];
  const rawToolCalls: Array<{ tool: string; args: any; error?: string }> = [];

  for (const tu of toolUses) {
    const name = tu.name;
    const args = tu.input;

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
