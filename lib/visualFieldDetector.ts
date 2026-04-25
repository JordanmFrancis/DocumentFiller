// Client-side visual field detector
//
// Many PDFs that look fillable (clear boxes drawn on the page) don't actually
// have AcroForm widgets — they're just rectangle vector paths in the page
// content stream. pdf-lib's form.getFields() returns nothing for those.
//
// This module loads PDF.js from CDN, walks each page's operator list, finds
// stroked rectangles in user space, applies the CTM stack to get final
// coordinates, then filters to plausible "form-field-shaped" boxes
// (right size, not page-borders, not table backgrounds, deduplicated).
//
// The output is PDFField[] with positions in our app's top-left origin
// system — same shape the AcroForm detector returns — so the rest of the
// app can treat them identically.
import { PDFField } from '@/types/pdf';

const PDFJS_SRC = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
const PDFJS_WORKER_SRC = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

async function loadPdfJs(): Promise<any> {
  if (typeof window === 'undefined') {
    throw new Error('visualFieldDetector is client-only');
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

// Affine matrix multiply: a × b, where each is [a, b, c, d, e, f] meaning
// the 3x3 [[a, c, e], [b, d, f], [0, 0, 1]].
function mulCTM(a: number[], b: number[]): number[] {
  return [
    a[0] * b[0] + a[2] * b[1],
    a[1] * b[0] + a[3] * b[1],
    a[0] * b[2] + a[2] * b[3],
    a[1] * b[2] + a[3] * b[3],
    a[0] * b[4] + a[2] * b[5] + a[4],
    a[1] * b[4] + a[3] * b[5] + a[5],
  ];
}

function applyCTM(ctm: number[], x: number, y: number) {
  return {
    x: ctm[0] * x + ctm[2] * y + ctm[4],
    y: ctm[1] * x + ctm[3] * y + ctm[5],
  };
}

// Transform a user-space rect through a CTM, returning the axis-aligned
// bounding box in device space. Rotation/skew get flattened, which is fine
// for form fields — they're virtually always axis-aligned.
function transformRect(ctm: number[], x: number, y: number, w: number, h: number) {
  const corners = [
    applyCTM(ctm, x, y),
    applyCTM(ctm, x + w, y),
    applyCTM(ctm, x, y + h),
    applyCTM(ctm, x + w, y + h),
  ];
  const xs = corners.map((c) => c.x);
  const ys = corners.map((c) => c.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

interface RawRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

// Walk a constructPath sub-op list, extracting rectangles. PDF paths can
// describe a rect three ways:
//   1. A direct `rectangle` sub-op (cleanest; what most authoring tools emit)
//   2. moveTo + 4 lineTos forming an axis-aligned closed quad
//   3. moveTo + 3 lineTos + closePath forming the same
// We handle all three; everything else (curves, non-quad paths) is ignored.
function extractRectsFromPath(subOps: number[], subArgs: number[], OPS: any): RawRect[] {
  const rects: RawRect[] = [];
  let argIdx = 0;
  let pathStart: { x: number; y: number } | null = null;
  let pathPoints: Array<{ x: number; y: number }> = [];
  let pathInvalid = false;

  const tryEmitQuad = () => {
    if (pathInvalid || pathPoints.length < 4) {
      pathPoints = [];
      pathInvalid = false;
      return;
    }
    // Take first 4 points (extra points like a closing line back to start are ok)
    const [p1, p2, p3, p4] = pathPoints;
    // Two valid orderings for an axis-aligned rectangle:
    //   horizontal-vertical-horizontal-vertical (start moving right, then up)
    //   vertical-horizontal-vertical-horizontal (start moving up, then right)
    const tol = 0.5;
    const hvhv =
      Math.abs(p1.y - p2.y) < tol &&
      Math.abs(p2.x - p3.x) < tol &&
      Math.abs(p3.y - p4.y) < tol &&
      Math.abs(p4.x - p1.x) < tol;
    const vhvh =
      Math.abs(p1.x - p2.x) < tol &&
      Math.abs(p2.y - p3.y) < tol &&
      Math.abs(p3.x - p4.x) < tol &&
      Math.abs(p4.y - p1.y) < tol;
    if (hvhv || vhvh) {
      const xs = [p1.x, p2.x, p3.x, p4.x];
      const ys = [p1.y, p2.y, p3.y, p4.y];
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      const minY = Math.min(...ys);
      const maxY = Math.max(...ys);
      rects.push({ x: minX, y: minY, width: maxX - minX, height: maxY - minY });
    }
    pathPoints = [];
    pathInvalid = false;
  };

  for (const op of subOps) {
    if (op === OPS.moveTo) {
      tryEmitQuad();
      const x = subArgs[argIdx++];
      const y = subArgs[argIdx++];
      pathStart = { x, y };
      pathPoints = [{ x, y }];
    } else if (op === OPS.lineTo) {
      const x = subArgs[argIdx++];
      const y = subArgs[argIdx++];
      pathPoints.push({ x, y });
    } else if (op === OPS.rectangle) {
      const x = subArgs[argIdx++];
      const y = subArgs[argIdx++];
      const w = subArgs[argIdx++];
      const h = subArgs[argIdx++];
      // Direct rectangle — keep regardless of path state
      rects.push({ x, y, width: w, height: h });
    } else if (op === OPS.curveTo) {
      argIdx += 6;
      pathInvalid = true;
    } else if (op === OPS.curveTo2 || op === OPS.curveTo3) {
      argIdx += 4;
      pathInvalid = true;
    } else if (op === OPS.closePath) {
      // Append the start point as the closing point so the quad check sees 4 sides
      if (pathStart && pathPoints.length === 4) {
        // Already 4 points — close confirms it's a closed quad
      }
      tryEmitQuad();
    }
  }
  tryEmitQuad();

  return rects;
}

interface DetectedRect {
  x: number; // device space, bottom-left origin (PDF user space)
  y: number;
  width: number;
  height: number;
  page: number;
  filled: boolean;
  stroked: boolean;
}

function collectRectsForPage(opList: any, OPS: any): DetectedRect[] {
  const fnArray: number[] = opList.fnArray;
  const argsArray: any[] = opList.argsArray;

  // CTM stack — pdf.js expects identity at the start of the page
  const stack: number[][] = [[1, 0, 0, 1, 0, 0]];
  let pendingRects: RawRect[] = [];
  const result: DetectedRect[] = [];

  const pushPending = (filled: boolean, stroked: boolean) => {
    for (const r of pendingRects) {
      result.push({ ...r, page: 0, filled, stroked });
    }
    pendingRects = [];
  };

  for (let i = 0; i < fnArray.length; i++) {
    const op = fnArray[i];
    const args = argsArray[i];
    const ctm = stack[stack.length - 1];

    if (op === OPS.save) {
      stack.push([...ctm]);
    } else if (op === OPS.restore) {
      if (stack.length > 1) stack.pop();
    } else if (op === OPS.transform) {
      // args is the new transform [a, b, c, d, e, f]; multiply into CTM in place
      stack[stack.length - 1] = mulCTM(ctm, args);
    } else if (op === OPS.constructPath) {
      // args = [subOps, subArgs, minMax]
      const subOps: number[] = args[0];
      const subArgs: number[] = args[1];
      const rects = extractRectsFromPath(subOps, subArgs, OPS);
      for (const r of rects) {
        const tr = transformRect(ctm, r.x, r.y, r.width, r.height);
        pendingRects.push(tr);
      }
    } else if (op === OPS.rectangle) {
      // Some PDFs emit `rectangle` as a top-level op rather than nested
      const [x, y, w, h] = args;
      const tr = transformRect(ctm, x, y, w, h);
      pendingRects.push(tr);
    } else if (op === OPS.stroke || op === OPS.closeStroke) {
      pushPending(false, true);
    } else if (
      op === OPS.fillStroke ||
      op === OPS.eoFillStroke ||
      op === OPS.closeFillStroke ||
      op === OPS.closeEoFillStroke
    ) {
      pushPending(true, true);
    } else if (op === OPS.fill || op === OPS.eoFill) {
      pushPending(true, false);
    } else if (op === OPS.endPath) {
      pendingRects = [];
    }
  }

  return result;
}

// Apply size + position + dedup heuristics to narrow detected rectangles
// down to "things that plausibly look like form fields."
function filterToFieldShapes(
  rects: DetectedRect[],
  pageWidth: number,
  pageHeight: number
): DetectedRect[] {
  const filtered = rects.filter((r) => {
    // Filled-only (no stroke) rects are usually backgrounds — skip them.
    // Stroked rects (with or without fill) are box-shaped → keep.
    if (!r.stroked) return false;

    // Tiny boxes are likely artifacts, separators, or small icons
    if (r.width < 8 || r.height < 6) return false;

    // Page-sized rectangles are almost always page borders or backgrounds
    if (r.width > pageWidth * 0.92) return false;
    if (r.height > pageHeight * 0.85) return false;

    // Very-thin rectangles are lines, not boxes
    const aspect = r.width / r.height;
    if (aspect > 60 || aspect < 1 / 30) return false;

    // Reject rectangles that aren't sensibly inside the page
    const margin = 4;
    if (
      r.x < -margin ||
      r.y < -margin ||
      r.x + r.width > pageWidth + margin ||
      r.y + r.height > pageHeight + margin
    ) {
      return false;
    }

    return true;
  });

  // Dedup: PDFs frequently stroke the same rect twice (visible border + a
  // fill underneath, or a double border for emphasis). Quantize coords to
  // 2-point buckets and drop near-duplicates.
  const seen = new Set<string>();
  const deduped: DetectedRect[] = [];
  for (const r of filtered) {
    const key = `${Math.round(r.x / 2)}_${Math.round(r.y / 2)}_${Math.round(r.width / 2)}_${Math.round(r.height / 2)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(r);
  }

  // Sort top-to-bottom, left-to-right (in user space, top of page = high Y)
  deduped.sort((a, b) => {
    if (Math.abs(a.y - b.y) > 6) return b.y - a.y;
    return a.x - b.x;
  });

  return deduped;
}

export interface VisualDetectionResult {
  fields: PDFField[];
  pageCounts: number[]; // fields per page, for debugging/UI
}

/**
 * Scan a PDF for visual rectangle "boxes" that look like form fields.
 * Returns PDFField definitions in our top-left origin coordinate system,
 * ready to be passed to /api/add-fields to materialize as real AcroForm widgets.
 */
export async function detectVisualFields(
  file: File | Blob | Uint8Array | ArrayBuffer
): Promise<VisualDetectionResult> {
  const pdfjsLib = await loadPdfJs();
  const OPS = pdfjsLib.OPS;

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
  const pageCounts: number[] = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    // unscaled viewport gives PDF user-space dimensions (in points)
    const viewport = page.getViewport({ scale: 1 });
    const pageWidth = viewport.width;
    const pageHeight = viewport.height;

    const opList = await page.getOperatorList();
    const rawRects = collectRectsForPage(opList, OPS);
    const filtered = filterToFieldShapes(rawRects, pageWidth, pageHeight);

    pageCounts.push(filtered.length);

    filtered.forEach((r, idx) => {
      // pdf.js operator-list coords are in PDF user space (bottom-left origin).
      // Our app stores positions in top-left origin, so flip Y.
      const topLeftY = pageHeight - r.y - r.height;

      // Heuristic: small square boxes are checkboxes, otherwise text fields.
      // Anything taller than 60pt on a single line is likely a multi-line area
      // but we still treat it as a text field — pdf-lib can't easily distinguish.
      const isCheckboxShaped =
        r.width <= 22 && r.height <= 22 && Math.abs(r.width - r.height) < 6;

      const fieldName = `vfield_p${pageNum}_${idx}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;

      fields.push({
        name: fieldName,
        label: isCheckboxShaped ? `Checkbox ${fields.length + 1}` : `Field ${fields.length + 1}`,
        type: isCheckboxShaped ? 'checkbox' : 'text',
        page: pageNum - 1,
        position: {
          x: r.x,
          y: topLeftY,
          width: r.width,
          height: r.height,
          page: pageNum - 1,
        },
      });
    });
  }

  return { fields, pageCounts };
}
