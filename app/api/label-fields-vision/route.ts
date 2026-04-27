import { NextRequest, NextResponse } from 'next/server';

// Vision-based labeling: receive page images with red numbered overlays
// drawn on each field, ask GPT-4o-mini to read the label for each number,
// return a { fieldName: label } mapping.
//
// Each page is processed independently (parallelism limited to 3 to avoid
// rate-limit spikes). Per-page failures are logged and skipped — partial
// success is acceptable; the client falls back to original labels for any
// field we couldn't read.

interface PagePayload {
  pageNum: number;
  image: string; // data URL (JPEG) with field overlays already drawn
  fieldIds: Array<{ fieldName: string; idx: number }>;
}

const SYSTEM_PROMPT = `You read rendered form pages with red numbered boxes drawn on each fillable field, and identify the printed label for each numbered box. You return strictly-formatted JSON only — no prose, no markdown.`;

function userPromptForPage(page: PagePayload): string {
  const numbers = page.fieldIds.map((f) => f.idx).sort((a, b) => a - b);
  return `This image is page ${page.pageNum} of a form document. Each red-outlined box is a fillable field. The number badge on each box is the field's global ID.

Identify the printed label for each numbered field — the descriptive text that tells the user what to enter. Labels usually appear directly above, to the left of, or inside near the box (e.g. "First Name", "Date of Birth", "Address Line 1", "Email", "Signature"). Use only text actually printed on the page — do not invent.

If a single section heading covers several adjacent fields (e.g. "Buyer:" above name/address/phone), include the section context in the label when helpful (e.g. "Buyer Name", "Buyer Address").

Numbered fields on this page: ${numbers.join(', ')}.

Return JSON ONLY mapping each field number (as a string) to its label:
{"1": "First Name", "2": "Date of Birth", ...}

If you genuinely cannot determine a field's label, omit that number from the output (don't guess wildly).`;
}

async function labelOnePage(page: PagePayload, apiKey: string): Promise<Record<string, string>> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: [
            { type: 'text', text: userPromptForPage(page) },
            { type: 'image_url', image_url: { url: page.image, detail: 'high' } },
          ],
        },
      ],
      temperature: 0.1,
      max_tokens: 2000,
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    console.error(`OpenAI vision-label error (page ${page.pageNum}):`, errText.slice(0, 300));
    return {};
  }

  const data = await response.json().catch(() => null);
  const content: string = data?.choices?.[0]?.message?.content || '';
  if (!content) return {};

  let parsed: Record<string, string>;
  try {
    parsed = JSON.parse(content);
  } catch {
    const m = content.match(/\{[\s\S]*\}/);
    if (!m) return {};
    try {
      parsed = JSON.parse(m[0]);
    } catch {
      return {};
    }
  }

  // Map idx (string) → fieldName → label
  const out: Record<string, string> = {};
  for (const { fieldName, idx } of page.fieldIds) {
    const label = parsed[String(idx)];
    if (label && typeof label === 'string' && label.trim()) {
      out[fieldName] = label.trim();
    }
  }
  return out;
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { labels: {}, error: 'OPENAI_API_KEY not configured' },
      { status: 503 }
    );
  }

  let body: { pages?: PagePayload[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!body.pages || !Array.isArray(body.pages) || body.pages.length === 0) {
    return NextResponse.json({ error: 'No pages provided' }, { status: 400 });
  }

  if (body.pages.length > 25) {
    return NextResponse.json(
      { error: 'PDF exceeds 25-page limit for vision labeling' },
      { status: 413 }
    );
  }

  const labels: Record<string, string> = {};

  // Limited parallelism. 3 simultaneous calls keeps us comfortably under
  // gpt-4o-mini's per-minute cap for typical accounts.
  const batchSize = 3;
  for (let i = 0; i < body.pages.length; i += batchSize) {
    const batch = body.pages.slice(i, i + batchSize);
    const results = await Promise.all(batch.map((page) => labelOnePage(page, apiKey)));
    for (const r of results) {
      Object.assign(labels, r);
    }
  }

  return NextResponse.json({ labels });
}
