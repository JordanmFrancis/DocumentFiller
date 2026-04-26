// Client-side AcroForm widget detector via pdf.js getAnnotations().
//
// This is the same path Chrome/Firefox/most PDF viewers use to render fillable
// form widgets. For each page we ask pdf.js for its annotation dictionary and
// pick out the Widget subtype entries — those are the AcroForm fields. We get
// rect, fieldName, fieldType, options, etc. directly, with no widget→page
// detective work needed (the page is implicit because we ask per page).
//
// Runs alongside the pdf-lib server detector. Both feed into a union-by-name
// merge in app/page.tsx, so a field detected by either parser is captured.
import { PDFField, PDFFieldType } from '@/types/pdf';

const PDFJS_SRC = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
const PDFJS_WORKER_SRC = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

async function loadPdfJs(): Promise<any> {
  if (typeof window === 'undefined') {
    throw new Error('annotationFieldDetector is client-only');
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

// Convert "first_name_2" → "First Name", "PurchasePrice" → "Purchase Price"
function generateFriendlyLabel(fieldName: string): string {
  let label = fieldName
    .replace(/^(field|input|text|txt|fld)_?/i, '')
    .replace(/_?(\d+)$/, '')
    .trim();
  label = label
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
  return label || fieldName;
}

// Map pdf.js fieldType + flags to our PDFFieldType. Returns null for things we
// don't surface as fields — pushbuttons, signatures, unknown subtypes.
function inferType(annotation: any, fieldName: string): PDFFieldType | null {
  const ft = annotation.fieldType;
  if (ft === 'Tx') {
    const lname = fieldName.toLowerCase();
    if (lname.includes('date')) return 'date';
    if (lname.includes('number') || lname.includes('amount')) return 'number';
    return 'text';
  }
  if (ft === 'Btn') {
    if (annotation.checkBox) return 'checkbox';
    if (annotation.radioButton) return 'radio';
    // Pushbutton — an action trigger, not a fillable field.
    return null;
  }
  if (ft === 'Ch') {
    return 'dropdown';
  }
  // Sig (signature), unknown subtypes — skip.
  return null;
}

function extractOptions(annotation: any): string[] | undefined {
  const opts = annotation.options;
  if (!Array.isArray(opts) || opts.length === 0) return undefined;
  const out: string[] = [];
  for (const o of opts) {
    if (typeof o === 'string') {
      out.push(o);
    } else if (o && typeof o === 'object') {
      const v = o.exportValue || o.displayValue;
      if (typeof v === 'string') out.push(v);
    }
  }
  return out.length > 0 ? out : undefined;
}

export async function detectAnnotationFields(
  file: File | Blob | Uint8Array | ArrayBuffer
): Promise<PDFField[]> {
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
  const fields: PDFField[] = [];

  // Track field names we've already emitted. Radio groups produce multiple
  // widget annotations sharing the same fieldName (one per option) — for now
  // we emit only the first widget's position. Better radio handling can come
  // later if it matters.
  const seenFieldNames = new Set<string>();

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale: 1 });
    const pageHeight = viewport.height;

    let annotations: any[] = [];
    try {
      annotations = await page.getAnnotations();
    } catch (e) {
      console.warn(`Failed to read annotations for page ${pageNum}:`, e);
      continue;
    }

    for (const ann of annotations) {
      if (ann.subtype !== 'Widget') continue;
      const fieldName = ann.fieldName;
      if (!fieldName || typeof fieldName !== 'string') continue;
      if (seenFieldNames.has(fieldName)) continue;

      const type = inferType(ann, fieldName);
      if (!type) continue;

      const rect = ann.rect;
      if (!Array.isArray(rect) || rect.length < 4) continue;

      // PDF spec says rect is [llx, lly, urx, ury], but some authors flip.
      // Use min/max defensively.
      const x = Math.min(rect[0], rect[2]);
      const topY = Math.max(rect[1], rect[3]);
      const width = Math.abs(rect[2] - rect[0]);
      const height = Math.abs(rect[3] - rect[1]);
      if (width <= 0 || height <= 0) continue;

      const label =
        (typeof ann.alternativeText === 'string' && ann.alternativeText.trim()) ||
        generateFriendlyLabel(fieldName);

      const field: PDFField = {
        name: fieldName,
        label,
        type,
        page: pageNum - 1,
        position: {
          x,
          // pdf.js rect is bottom-left origin; flip to top-left for our app.
          y: pageHeight - topY,
          width,
          height,
          page: pageNum - 1,
        },
      };

      const defaultValue = ann.fieldValue ?? ann.defaultFieldValue;
      if (defaultValue !== undefined && defaultValue !== null && defaultValue !== '') {
        field.defaultValue = Array.isArray(defaultValue) ? defaultValue[0] : defaultValue;
      }
      const options = extractOptions(ann);
      if (options) field.options = options;
      if (ann.required === true) field.required = true;

      seenFieldNames.add(fieldName);
      fields.push(field);
    }
  }

  return fields;
}
