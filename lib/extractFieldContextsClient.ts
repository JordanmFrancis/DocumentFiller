// Client-side per-field text-context extraction for the AI labeler.
//
// Mirrors what `extractFieldContext` does server-side but uses the same
// CDN-loaded pdf.js the rest of the client (annotationFieldDetector,
// PDFPreview, PDFViewerEditor, PDFFieldCreator) already relies on. Doing
// this in the browser avoids the fragile server-side pdfjs-dist worker
// resolution that fails silently on Vercel serverless functions and
// leaves the AI labeler with empty context per field.
//
// Returns a `{ [fieldName]: contextString }` map ready to be JSON-stringified
// and posted to /api/label-fields.

import { PDFField } from '@/types/pdf';

const PDFJS_SRC = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
const PDFJS_WORKER_SRC = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

async function loadPdfJs(): Promise<any> {
  if (typeof window === 'undefined') {
    throw new Error('extractFieldContextsClient is client-only');
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

export async function extractFieldContextsClient(
  file: File,
  fields: PDFField[]
): Promise<Record<string, string>> {
  const contexts: Record<string, string> = {};
  if (fields.length === 0) return contexts;

  let pdfjsLib: any;
  try {
    pdfjsLib = await loadPdfJs();
  } catch (e) {
    console.warn('Failed to load pdf.js for context extraction:', e);
    return contexts;
  }

  const arrayBuffer = await file.arrayBuffer();
  let pdf: any;
  try {
    pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
  } catch (e) {
    console.warn('Failed to parse PDF for context extraction:', e);
    return contexts;
  }

  // Cache page text content per page (0-based) to avoid re-parsing per field.
  const pageTextCache = new Map<number, { items: any[]; height: number }>();
  const radius = 50; // points above/below the field
  const horizPadding = 100; // points left/right of the field

  for (const field of fields) {
    if (!field.position) {
      contexts[field.name] = '';
      continue;
    }

    const pageIdx = field.position.page;
    if (!pageTextCache.has(pageIdx)) {
      try {
        const page = await pdf.getPage(pageIdx + 1);
        const viewport = page.getViewport({ scale: 1 });
        const textContent = await page.getTextContent();
        pageTextCache.set(pageIdx, { items: textContent.items, height: viewport.height });
      } catch (e) {
        console.warn(`Failed to load page ${pageIdx + 1} for context extraction:`, e);
        contexts[field.name] = '';
        continue;
      }
    }

    const cache = pageTextCache.get(pageIdx);
    if (!cache) {
      contexts[field.name] = '';
      continue;
    }
    const { items, height: pageHeight } = cache;

    const { x: fieldX, y: fieldY, width: fieldW, height: fieldH } = field.position;

    const nearby: Array<{ text: string; y: number; x: number }> = [];
    for (const item of items) {
      if (!item || typeof item.str !== 'string' || !item.str.trim()) continue;
      // pdf.js transform is bottom-left origin; we store top-left.
      const itemY = pageHeight - (item.transform?.[5] ?? 0);
      const itemX = item.transform?.[4] ?? 0;
      const isNearby =
        itemY >= fieldY - radius &&
        itemY <= fieldY + fieldH + radius &&
        itemX >= fieldX - horizPadding &&
        itemX <= fieldX + fieldW + horizPadding;
      if (isNearby) nearby.push({ text: item.str.trim(), y: itemY, x: itemX });
    }

    nearby.sort((a, b) => (Math.abs(a.y - b.y) > 5 ? a.y - b.y : a.x - b.x));

    const lines: string[] = [];
    let cur = '';
    let lastY = -1;
    for (const item of nearby) {
      if (lastY === -1 || Math.abs(item.y - lastY) > 5) {
        if (cur) lines.push(cur.trim());
        cur = item.text;
        lastY = item.y;
      } else {
        cur += ' ' + item.text;
      }
    }
    if (cur) lines.push(cur.trim());

    contexts[field.name] = lines.join('\n');
  }

  return contexts;
}
