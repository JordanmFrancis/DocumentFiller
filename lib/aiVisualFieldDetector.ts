// Client-side AI vision field detector
//
// When both AcroForm extraction (server) and vector-rectangle scanning
// (visualFieldDetector.ts) come back empty, this is the last automatic
// tier before the manual drag-and-drop creator: render each page to a
// JPEG, hand the images to GPT-4o-mini via a server endpoint, and parse
// the returned normalized bounding boxes back into PDFField objects.
//
// We render client-side (the project already avoids server-side PDF.js
// because it doesn't bundle cleanly with Next.js) and keep the OpenAI
// key on the server, so this module just orchestrates the rendering
// then calls /api/detect-fields-vision.
import { PDFField } from '@/types/pdf';

const PDFJS_SRC = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
const PDFJS_WORKER_SRC = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

async function loadPdfJs(): Promise<any> {
  if (typeof window === 'undefined') {
    throw new Error('aiVisualFieldDetector is client-only');
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

interface RenderedPage {
  pageNum: number;
  image: string; // data URL (JPEG)
  pdfWidth: number; // unscaled PDF user-space width (points)
  pdfHeight: number;
}

// Render a single PDF page to a JPEG data URL.
//   - 1.75x scale gives Letter-sized (612x792 pt) pages a 1071x1386 image,
//     which fits comfortably inside OpenAI's recommended 2048px max while
//     keeping field labels legible to the model
//   - JPEG quality 0.82 keeps body size manageable (~80-200kb per page)
async function renderPageToImage(pdfjsLib: any, pdf: any, pageNum: number): Promise<RenderedPage> {
  const page = await pdf.getPage(pageNum);
  const baseViewport = page.getViewport({ scale: 1 });
  const renderViewport = page.getViewport({ scale: 1.75 });

  const canvas = document.createElement('canvas');
  canvas.width = Math.floor(renderViewport.width);
  canvas.height = Math.floor(renderViewport.height);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get canvas 2d context');

  // White background — OpenAI vision sometimes mis-reads transparent regions
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  await page.render({ canvasContext: ctx, viewport: renderViewport }).promise;

  return {
    pageNum,
    image: canvas.toDataURL('image/jpeg', 0.82),
    pdfWidth: baseViewport.width,
    pdfHeight: baseViewport.height,
  };
}

export interface AIVisionResult {
  fields: PDFField[];
  pageCounts: number[];
  error?: string;
}

/**
 * Send PDF pages to GPT-4o for field detection. Returns PDFField definitions
 * in the app's top-left coordinate system, ready to feed to /api/add-fields.
 *
 * If the server reports no API key configured, returns { fields: [], error }
 * so callers can surface a useful message instead of throwing.
 */
export async function detectAIVisionFields(
  file: File | Blob | Uint8Array | ArrayBuffer
): Promise<AIVisionResult> {
  const pdfjsLib = await loadPdfJs();

  let data: ArrayBuffer;
  if (file instanceof File || file instanceof Blob) {
    data = await file.arrayBuffer();
  } else if (file instanceof Uint8Array) {
    const buf = new ArrayBuffer(file.byteLength);
    new Uint8Array(buf).set(file);
    data = buf;
  } else {
    data = file;
  }

  const pdf = await pdfjsLib.getDocument({ data, useSystemFonts: true }).promise;

  // Render all pages to JPEG. Sequential — Chrome's canvas/getImageData
  // path doesn't parallelize well and we want consistent memory usage.
  const pages: RenderedPage[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    pages.push(await renderPageToImage(pdfjsLib, pdf, i));
  }

  const response = await fetch('/api/detect-fields-vision', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      pages: pages.map((p) => ({
        pageNum: p.pageNum,
        image: p.image,
        pdfWidth: p.pdfWidth,
        pdfHeight: p.pdfHeight,
      })),
    }),
  });

  if (!response.ok) {
    const errBody = await response.text().catch(() => '');
    let errMsg = `AI vision request failed (${response.status})`;
    try {
      const parsed = JSON.parse(errBody);
      if (parsed.error) errMsg = parsed.error;
    } catch {
      if (errBody) errMsg = errBody.slice(0, 200);
    }
    return { fields: [], pageCounts: [], error: errMsg };
  }

  const result = await response.json();
  return {
    fields: result.fields || [],
    pageCounts: result.pageCounts || [],
    error: result.error,
  };
}
