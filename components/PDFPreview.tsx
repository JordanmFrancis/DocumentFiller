'use client';

import { useEffect, useRef, useState } from 'react';
import { ZoomIn, ZoomOut, FileText } from 'lucide-react';

interface PDFPreviewProps {
  pdfFile: File | Blob | string | null;
  className?: string;
}

// Read-only PDF preview for the right pane of the form view. Loads PDF.js
// from CDN (same as PDFViewerEditor) and renders the current page to a
// canvas with zoom + page navigation in a top toolbar.
export default function PDFPreview({ pdfFile, className = '' }: PDFPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(1.2);
  const [loading, setLoading] = useState(true);

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

  useEffect(() => {
    if (!pdfDoc || !canvasRef.current) return;

    let cancelled = false;
    const render = async () => {
      try {
        const page = await pdfDoc.getPage(currentPage);
        const viewport = page.getViewport({ scale });
        const canvas = canvasRef.current;
        if (!canvas || cancelled) return;

        const dpr = window.devicePixelRatio || 1;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        canvas.width = Math.floor(viewport.width * dpr);
        canvas.height = Math.floor(viewport.height * dpr);
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        await page.render({ canvasContext: ctx, viewport }).promise;
      } catch (e) {
        if (!cancelled) console.error('PDFPreview render error:', e);
      }
    };

    render();
    return () => {
      cancelled = true;
    };
  }, [pdfDoc, currentPage, scale]);

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 h-11 hairline shrink-0">
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
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <span className="text-[12px] text-ink-soft min-w-[36px] text-center">
            {Math.round(scale * 100)}%
          </span>
          <button
            onClick={() => setScale((s) => Math.min(2.5, s + 0.1))}
            className="p-1 rounded hover:bg-paper-edge text-ink"
            title="Zoom in"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Canvas viewport */}
      <div className="flex-1 overflow-auto bg-paper-edge/50 p-6 flex items-start justify-center">
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
          <canvas
            ref={canvasRef}
            className="bg-white shadow-md ring-1 ring-rule rounded-sm"
          />
        )}
      </div>
    </div>
  );
}
