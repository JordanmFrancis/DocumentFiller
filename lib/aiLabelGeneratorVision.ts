// Vision-based AI labeler. Renders each PDF page to an image with a red
// numbered overlay drawn on each field's bounding box, then asks GPT-4o-mini
// to identify the label for each numbered field. Much more accurate than
// 2D text-proximity heuristics because the model sees the actual form
// layout — labels above / left / inside, sectioning cues, alignment,
// table grids — same information a human uses.
//
// Mirrors the rendering path in `aiVisualFieldDetector` (uses CDN-loaded
// pdf.js, 1.75x render scale, JPEG quality 0.85). Failures are logged and
// the function returns the input fields unchanged — callers can treat it
// as a best-effort enhancement.

import { PDFField } from '@/types/pdf';

const PDFJS_SRC = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
const PDFJS_WORKER_SRC = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

async function loadPdfJs(): Promise<any> {
  if (typeof window === 'undefined') {
    throw new Error('aiLabelGeneratorVision is client-only');
  }
  const w = window as any;
  if (w.pdfjsLib) return w.pdfjsLib;

  await new Promise<void>((resolve, reject) => {
    if (w.pdfjsLib) return resolve();
    const script = document.createElement('script');
    script.src = PDFJS_SRC;
    script.async = true;
    script.onload = () => {
      const lib = (window as any).pdfjsLib;
      if (!lib) return reject(new Error('PDF.js loaded but pdfjsLib missing'));
      lib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_SRC;
      resolve();
    };
    script.onerror = () => reject(new Error('Failed to load PDF.js from CDN'));
    document.head.appendChild(script);
  });

  return (window as any).pdfjsLib;
}

interface PageOverlayPayload {
  pageNum: number; // 1-based
  image: string; // data URL (JPEG)
  fieldIds: Array<{ fieldName: string; idx: number }>;
}

// Render one page with all of its fields drawn as red numbered boxes.
// Each field gets a globally-unique number (1..N across the whole document)
// so the AI can reference them and we can map back to field names.
async function renderPageWithBoxes(
  pdfjsLib: any,
  pdf: any,
  pageIdx: number, // 0-based
  pageFields: PDFField[],
  startNumber: number, // first global number for this page (1-based)
): Promise<PageOverlayPayload> {
  const page = await pdf.getPage(pageIdx + 1);
  const baseViewport = page.getViewport({ scale: 1 });
  const renderScale = 1.75;
  const renderViewport = page.getViewport({ scale: renderScale });

  const canvas = document.createElement('canvas');
  canvas.width = Math.floor(renderViewport.width);
  canvas.height = Math.floor(renderViewport.height);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get canvas 2d context');

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: ctx, viewport: renderViewport }).promise;

  const fieldIds: Array<{ fieldName: string; idx: number }> = [];

  pageFields.forEach((field, i) => {
    if (!field.position) return;
    const idx = startNumber + i;
    fieldIds.push({ fieldName: field.name, idx });

    // PDF space (top-left origin in our coord system) → image pixel space.
    const px = field.position.x * renderScale;
    const py = field.position.y * renderScale;
    const pw = field.position.width * renderScale;
    const ph = field.position.height * renderScale;

    // Translucent fill + outline so the model can see both the box and
    // the printed content underneath/around it.
    ctx.fillStyle = 'rgba(220, 38, 38, 0.18)';
    ctx.fillRect(px, py, pw, ph);
    ctx.strokeStyle = 'rgba(185, 28, 28, 0.95)';
    ctx.lineWidth = 2;
    ctx.strokeRect(px, py, pw, ph);

    // Number badge — circle at the top-left corner of the box, with the
    // global field number drawn in white. Clamped so it never disappears
    // off the page edge.
    const badgeR = Math.min(14, Math.max(10, ph * 0.45));
    const badgeX = Math.max(badgeR + 2, px);
    const badgeY = Math.max(badgeR + 2, py);
    ctx.fillStyle = 'rgba(185, 28, 28, 0.98)';
    ctx.beginPath();
    ctx.arc(badgeX, badgeY, badgeR, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${Math.round(badgeR * 1.2)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(idx), badgeX, badgeY);
  });

  return {
    pageNum: pageIdx + 1,
    image: canvas.toDataURL('image/jpeg', 0.85),
    fieldIds,
  };
}

function groupFieldsByPage(fields: PDFField[]): Map<number, PDFField[]> {
  const map = new Map<number, PDFField[]>();
  for (const f of fields) {
    if (!f.position) continue;
    const arr = map.get(f.position.page) ?? [];
    arr.push(f);
    map.set(f.position.page, arr);
  }
  return map;
}

/**
 * Returns the input fields with `label` replaced by a vision-derived label
 * wherever the AI produced one. Fields without a position, or fields whose
 * label couldn't be determined, are returned unchanged.
 */
export async function labelFieldsWithVision(
  file: File,
  fields: PDFField[],
): Promise<PDFField[]> {
  if (fields.length === 0) return fields;

  let pdfjsLib: any;
  try {
    pdfjsLib = await loadPdfJs();
  } catch (e) {
    console.warn('Vision labeler: failed to load pdf.js:', e);
    return fields;
  }

  const arrayBuffer = await file.arrayBuffer();
  let pdf: any;
  try {
    pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer), useSystemFonts: true }).promise;
  } catch (e) {
    console.warn('Vision labeler: failed to parse PDF:', e);
    return fields;
  }

  const byPage = groupFieldsByPage(fields);
  const pageOrder = Array.from(byPage.keys()).sort((a, b) => a - b);

  const pages: PageOverlayPayload[] = [];
  let cumulative = 1; // 1-based global numbering
  for (const pageIdx of pageOrder) {
    const pageFields = byPage.get(pageIdx)!;
    try {
      const rendered = await renderPageWithBoxes(pdfjsLib, pdf, pageIdx, pageFields, cumulative);
      pages.push(rendered);
      cumulative += pageFields.length;
    } catch (e) {
      console.warn(`Vision labeler: failed to render page ${pageIdx + 1}:`, e);
    }
  }

  if (pages.length === 0) return fields;

  let response: Response;
  try {
    response = await fetch('/api/label-fields-vision', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pages }),
    });
  } catch (e) {
    console.warn('Vision labeler: request failed:', e);
    return fields;
  }

  if (!response.ok) {
    console.warn('Vision labeler returned non-OK:', response.status);
    return fields;
  }

  const data = await response.json().catch(() => null as any);
  const labelsByName: Record<string, string> | undefined = data?.labels;
  if (!labelsByName) return fields;

  return fields.map((f) => {
    const label = labelsByName[f.name];
    if (label && typeof label === 'string' && label.trim()) {
      return { ...f, label: label.trim() };
    }
    return f;
  });
}
