import { NextRequest, NextResponse } from 'next/server';
import { PDFField, PDFFieldType } from '@/types/pdf';

// Server endpoint: receive client-rendered PDF pages + dimensions, send to
// OpenAI Vision (gpt-4o-mini) for fillable-field detection, return PDFField[]
// with positions in our top-left origin coordinate system.

interface RenderedPagePayload {
  pageNum: number;
  image: string; // data URL (JPEG)
  pdfWidth: number;
  pdfHeight: number;
}

interface AIFieldBox {
  x: number; // normalized [0,1], top-left origin in image space
  y: number;
  width: number;
  height: number;
  label?: string;
  type?: string;
}

const SYSTEM_PROMPT = `You analyze rendered images of PDF document pages and locate fillable form fields. You return strictly-formatted JSON only — no prose, no markdown fences.`;

function userPromptForPage(pageNum: number, totalPages: number): string {
  return `This image is page ${pageNum} of ${totalPages} of a PDF document.

Identify every place on the page where a user is expected to enter information. Specifically include:
- Empty rectangles or boxes meant for text (e.g., "Name: [        ]")
- Empty underlines after a label (e.g., "Address: ____________")
- Small empty squares for checkboxes (often beside choices like "Yes / No")
- Date or signature lines

EXCLUDE:
- Pre-filled labels and already-printed text
- Decorative borders that span the entire page
- Logos, headings, table grid lines that aren't input cells

For each field, return:
- "x", "y": top-left of the field, as fractions of the image (0–1)
- "width", "height": size as fractions of the image (0–1)
- "label": short, human-friendly label drawn from the closest printed text (e.g., "First Name", "Date of Birth")
- "type": one of "text", "checkbox", "date", "number"

Return JSON ONLY in this exact shape:
{"fields": [{"x":0.12,"y":0.34,"width":0.4,"height":0.025,"label":"First Name","type":"text"}]}

If there are no fillable fields on this page, return {"fields": []}.`;
}

async function detectFieldsForPage(
  page: RenderedPagePayload,
  totalPages: number,
  apiKey: string
): Promise<AIFieldBox[]> {
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
            { type: 'text', text: userPromptForPage(page.pageNum, totalPages) },
            {
              type: 'image_url',
              image_url: {
                url: page.image,
                detail: 'high',
              },
            },
          ],
        },
      ],
      temperature: 0.2,
      max_tokens: 2000,
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error(`OpenAI vision error (page ${page.pageNum}):`, errText);
    return [];
  }

  const data = await response.json();
  const content: string = data.choices?.[0]?.message?.content || '';

  let parsed: { fields?: AIFieldBox[] };
  try {
    parsed = JSON.parse(content);
  } catch {
    // The model occasionally still wraps JSON in fences despite response_format
    const match = content.match(/\{[\s\S]*\}/);
    if (!match) return [];
    try {
      parsed = JSON.parse(match[0]);
    } catch {
      return [];
    }
  }

  return Array.isArray(parsed.fields) ? parsed.fields : [];
}

function normalizeType(t: string | undefined): PDFFieldType {
  switch ((t || '').toLowerCase()) {
    case 'checkbox':
      return 'checkbox';
    case 'date':
      return 'date';
    case 'number':
      return 'number';
    case 'dropdown':
      return 'dropdown';
    case 'radio':
      return 'radio';
    default:
      return 'text';
  }
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'OPENAI_API_KEY not configured. AI vision detection unavailable.' },
      { status: 503 }
    );
  }

  let body: { pages?: RenderedPagePayload[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!body.pages || !Array.isArray(body.pages) || body.pages.length === 0) {
    return NextResponse.json({ error: 'No pages provided' }, { status: 400 });
  }

  // Hard cap to keep accidental cost spikes bounded
  if (body.pages.length > 25) {
    return NextResponse.json(
      { error: 'PDF exceeds 25-page limit for AI vision detection' },
      { status: 413 }
    );
  }

  const totalPages = body.pages.length;
  const allFields: PDFField[] = [];
  const pageCounts: number[] = [];

  // Process pages in parallel with limited concurrency to avoid hammering the API.
  // batchSize 3 is a reasonable balance for gpt-4o-mini's rate limits.
  const batchSize = 3;
  const pageResults: Array<{ page: RenderedPagePayload; boxes: AIFieldBox[] }> = [];

  for (let i = 0; i < body.pages.length; i += batchSize) {
    const batch = body.pages.slice(i, i + batchSize);
    const results = await Promise.all(
      batch.map(async (page) => ({
        page,
        boxes: await detectFieldsForPage(page, totalPages, apiKey),
      }))
    );
    pageResults.push(...results);
  }

  for (const { page, boxes } of pageResults) {
    pageCounts.push(boxes.length);

    boxes.forEach((box, idx) => {
      // Validate normalized bounds — reject anything completely outside [0,1]
      if (
        typeof box.x !== 'number' ||
        typeof box.y !== 'number' ||
        typeof box.width !== 'number' ||
        typeof box.height !== 'number'
      ) {
        return;
      }
      if (box.x < 0 || box.y < 0 || box.x > 1 || box.y > 1) return;
      if (box.width <= 0 || box.height <= 0) return;
      if (box.width > 1 || box.height > 1) return;

      // Convert normalized image coords (top-left origin) → PDF points
      // (top-left origin in our app's coordinate system).
      const pdfX = box.x * page.pdfWidth;
      const pdfY = box.y * page.pdfHeight;
      const pdfW = box.width * page.pdfWidth;
      const pdfH = box.height * page.pdfHeight;

      // Skip absurdly tiny detections (likely model hallucinations)
      if (pdfW < 6 || pdfH < 5) return;

      const type = normalizeType(box.type);
      const fieldName = `aifield_p${page.pageNum}_${idx}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
      const label = (box.label || '').trim() || (type === 'checkbox' ? `Checkbox ${allFields.length + 1}` : `Field ${allFields.length + 1}`);

      allFields.push({
        name: fieldName,
        label,
        type,
        page: page.pageNum - 1,
        position: {
          x: pdfX,
          y: pdfY,
          width: pdfW,
          height: pdfH,
          page: page.pageNum - 1,
        },
      });
    });
  }

  return NextResponse.json({
    fields: allFields,
    pageCounts,
  });
}
