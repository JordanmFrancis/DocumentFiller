'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ZoomIn, ZoomOut, FileText } from 'lucide-react';
import { PDFField } from '@/types/pdf';

interface PDFPreviewProps {
  pdfFile: File | Blob | string | null;
  activeField?: PDFField | null;
  className?: string;
}

// Read-only PDF preview for the right pane of the form view. Loads PDF.js
// from CDN (same as PDFViewerEditor) and renders the current page to a
// canvas with zoom + page navigation in a top toolbar. When `activeField`
// is set:
//   - if its position is on a different page, automatically navigates there
//   - draws a green highlight overlay on top of the canvas at the field's
//     coordinates (using viewport.convertToViewportRectangle for the math)
//   - scrolls the highlight into view inside the canvas viewport
export default function PDFPreview({ pdfFile, activeField, className = '' }: PDFPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const viewportContainerRef = useRef<HTMLDivElement>(null);

  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(1.2);
  const [loading, setLoading] = useState(true);
  const [viewport, setViewport] = useState<any>(null);
  const [pageSize, setPageSize] = useState({ width: 0, height: 0 });
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });

  // Load the PDF.js library + the file itself
  useEffect(() => {
    if (!pdfFile) {
      setPdfDoc(null);
      return;
    }

    let mounted = true;

    const loadPDF = async () => {
      if (typeof window === 'undefined') return;
      setLoading(true);

      try {
        let pdfjsLib = (window as any).pdfjsLib;
        if (!pdfjsLib) {
          await new Promise<void>((resolve, reject) => {
            const existing = (window as any).pdfjsLib;
            if (existing) return resolve();
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
            script.async = true;
            script.onload = () => {
              pdfjsLib = (window as any).pdfjsLib;
              if (!pdfjsLib) return reject(new Error('PDF.js missing'));
              pdfjsLib.GlobalWorkerOptions.workerSrc =
                'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
              resolve();
            };
            script.onerror = () => reject(new Error('Failed to load PDF.js'));
            document.head.appendChild(script);
          });
        }

        let arrayBuffer: ArrayBuffer;
        if (pdfFile instanceof File || pdfFile instanceof Blob) {
          arrayBuffer = await pdfFile.arrayBuffer();
        } else {
          const response = await fetch(pdfFile);
          arrayBuffer = await response.arrayBuffer();
        }

        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer, useSystemFonts: true }).promise;
        if (!mounted) return;
        setPdfDoc(pdf);
        setNumPages(pdf.numPages);
        setCurrentPage(1);
      } catch (e) {
        console.error('PDFPreview load error:', e);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    loadPDF();
    return () => {
      mounted = false;
    };
  }, [pdfFile]);

  // Render the current page to canvas
  useEffect(() => {
    if (!pdfDoc || !canvasRef.current) return;

    let cancelled = false;
    const render = async () => {
      try {
        const page = await pdfDoc.getPage(currentPage);
        const viewportObj = page.getViewport({ scale });

        // Unscaled viewport gives us the page dimensions in PDF user-space
        // points (needed for overlay coordinate math).
        const unscaled = page.getViewport({ scale: 1 });

        const canvas = canvasRef.current;
        if (!canvas || cancelled) return;

        const dpr = window.devicePixelRatio || 1;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        canvas.width = Math.floor(viewportObj.width * dpr);
        canvas.height = Math.floor(viewportObj.height * dpr);
        canvas.style.width = `${Math.floor(viewportObj.width)}px`;
        canvas.style.height = `${Math.floor(viewportObj.height)}px`;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        await page.render({ canvasContext: ctx, viewport: viewportObj }).promise;

        if (!cancelled) {
          setViewport(viewportObj);
          setPageSize({ width: unscaled.width, height: unscaled.height });
          setCanvasSize({
            width: Math.floor(viewportObj.width),
            height: Math.floor(viewportObj.height),
          });
        }
      } catch (e) {
        if (!cancelled) console.error('PDFPreview render error:', e);
      }
    };

    render();
    return () => {
      cancelled = true;
    };
  }, [pdfDoc, currentPage, scale]);

  // When the active field changes, jump to its page if needed
  useEffect(() => {
    if (!activeField?.position) return;
    const targetPage = activeField.position.page + 1; // 1-based
    if (targetPage >= 1 && targetPage <= numPages && targetPage !== currentPage) {
      setCurrentPage(targetPage);
    }
  }, [activeField, numPages]); // intentionally not depending on currentPage to avoid loops

  // Compute overlay style for the active field on the current page.
  // Mirrors the math used in PDFViewerEditor: stored Y is top-left, but
  // PDF.js viewport.convertToViewportRectangle expects bottom-left coords.
  const overlayStyle = useMemo(() => {
    if (
      !activeField?.position ||
      activeField.position.page !== currentPage - 1 ||
      !viewport ||
      !pageSize.width
    ) {
      return null;
    }

    const { x: pdfX, y: pdfY, width: pdfW, height: pdfH } = activeField.position;
    const yMin = pageSize.height - (pdfY + pdfH);
    const yMax = pageSize.height - pdfY;

    let viewportRect: number[];
    try {
      viewportRect = viewport.convertToViewportRectangle([pdfX, yMin, pdfX + pdfW, yMax]);
    } catch {
      return null;
    }

    const left = Math.min(viewportRect[0], viewportRect[2]);
    const top = Math.min(viewportRect[1], viewportRect[3]);
    const width = Math.abs(viewportRect[0] - viewportRect[2]);
    const height = Math.abs(viewportRect[1] - viewportRect[3]);

    return {
      left: `${left}px`,
      top: `${top}px`,
      width: `${width}px`,
      height: `${height}px`,
    };
  }, [activeField, viewport, pageSize, currentPage]);

  // Scroll the overlay into view inside the viewport container so the user
  // can see the highlighted box even on long/zoomed pages.
  useEffect(() => {
    if (!overlayStyle || !overlayRef.current || !viewportContainerRef.current) return;

    // Wait one frame so the overlay div has its computed bounding rect
    const t = requestAnimationFrame(() => {
      const overlay = overlayRef.current;
      const container = viewportContainerRef.current;
      if (!overlay || !container) return;

      const overlayRect = overlay.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();

      // Only scroll if the highlight isn't fully visible
      const fullyVisible =
        overlayRect.top >= containerRect.top &&
        overlayRect.bottom <= containerRect.bottom &&
        overlayRect.left >= containerRect.left &&
        overlayRect.right <= containerRect.right;
      if (fullyVisible) return;

      const targetTop =
        container.scrollTop +
        (overlayRect.top - containerRect.top) -
        containerRect.height / 2 +
        overlayRect.height / 2;
      const targetLeft =
        container.scrollLeft +
        (overlayRect.left - containerRect.left) -
        containerRect.width / 2 +
        overlayRect.width / 2;

      container.scrollTo({
        top: Math.max(0, targetTop),
        left: Math.max(0, targetLeft),
        behavior: 'smooth',
      });
    });

    return () => cancelAnimationFrame(t);
  }, [overlayStyle]);

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 h-11 hairline shrink-0 bg-paper-card">
        <div className="flex items-center gap-2 text-[12.5px] text-ink-soft">
          <span className="eyebrow !text-[10.5px] !tracking-[0.08em]">Preview</span>
          {numPages > 0 && (
            <span className="text-ink-faint">
              · page {currentPage} of {numPages}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {numPages > 1 && (
            <div className="flex items-center gap-0.5 mr-2">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-1 rounded hover:bg-paper-edge text-ink disabled:opacity-40 disabled:cursor-not-allowed"
              >
                ←
              </button>
              <button
                onClick={() => setCurrentPage((p) => Math.min(numPages, p + 1))}
                disabled={currentPage === numPages}
                className="p-1 rounded hover:bg-paper-edge text-ink disabled:opacity-40 disabled:cursor-not-allowed"
              >
                →
              </button>
            </div>
          )}
          <button
            onClick={() => setScale((s) => Math.max(0.5, s - 0.1))}
            className="p-1 rounded hover:bg-paper-edge text-ink"
            title="Zoom out"
          >
            <ZoomOut className="co-ico co-ico-pop w-3.5 h-3.5" />
          </button>
          <span className="text-[12px] text-ink-soft min-w-[36px] text-center">
            {Math.round(scale * 100)}%
          </span>
          <button
            onClick={() => setScale((s) => Math.min(2.5, s + 0.1))}
            className="p-1 rounded hover:bg-paper-edge text-ink"
            title="Zoom in"
          >
            <ZoomIn className="co-ico co-ico-pop w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Canvas viewport — independent scroll inside this pane */}
      <div
        ref={viewportContainerRef}
        className="flex-1 overflow-auto bg-paper-edge/50 p-6 flex items-start justify-center"
      >
        {!pdfFile && (
          <div className="text-center mt-16 text-ink-faint">
            <FileText className="w-9 h-9 mx-auto mb-2 opacity-50" strokeWidth={1.4} />
            <p className="text-[13px]">No PDF to preview</p>
          </div>
        )}
        {pdfFile && loading && (
          <div className="text-center mt-16">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-accent border-t-transparent mx-auto mb-2" />
            <p className="text-[12.5px] text-ink-faint">Loading preview…</p>
          </div>
        )}
        {pdfFile && !loading && (
          <div className="relative inline-block">
            <canvas
              ref={canvasRef}
              className="bg-white shadow-md ring-1 ring-rule rounded-sm block"
            />
            {overlayStyle && canvasSize.width > 0 && (
              <div
                ref={overlayRef}
                className="absolute pointer-events-none transition-all duration-200"
                style={{
                  ...overlayStyle,
                  background: 'rgba(45, 74, 58, 0.18)',
                  border: '2px solid #2d4a3a',
                  borderRadius: '3px',
                  boxShadow: '0 0 0 4px rgba(45, 74, 58, 0.12)',
                  zIndex: 10,
                }}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
