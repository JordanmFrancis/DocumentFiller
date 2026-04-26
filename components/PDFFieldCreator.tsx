'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PDFField, PDFFieldType, PDFFieldPosition } from '@/types/pdf';
import { X, Type, Square, Circle, List, Calendar, Hash, Save, Trash2, AlignLeft, PenTool } from 'lucide-react';

interface PDFFieldCreatorProps {
  pdfFile: File | Blob | string;
  onFieldsCreated: (fields: PDFField[], modifiedPdfBytes: Uint8Array) => void;
  onClose: () => void;
}

interface FieldTemplate {
  id: string;
  type: PDFFieldType;
  label: string;
  meta: string;
  icon: React.ReactNode;
  defaultWidth: number;
  defaultHeight: number;
}

// Match the Counsel wireframe's field palette. "Paragraph", "Signature",
// and "Initials" are surfaced as separate template ids but materialize as
// existing PDFFieldType values so they behave correctly when written:
//   - Paragraph → text (multi-line via larger default height)
//   - Signature → text (rendered with a different label/hint)
//   - Initials  → text (short)
// Icon class assignments mirror the per-element personalities from
// the wireframe spec — pencil-write on signature, rubber on checkbox,
// pop on number, etc.
const FIELD_TEMPLATES: FieldTemplate[] = [
  { id: 'text',      type: 'text',     label: 'Text',      meta: 'Single line',     icon: <Type className="co-ico co-ico-pop w-4 h-4" strokeWidth={1.7} />,               defaultWidth: 220, defaultHeight: 24 },
  { id: 'paragraph', type: 'text',     label: 'Paragraph', meta: 'Multi-line',      icon: <AlignLeft className="co-ico co-ico-bounce w-4 h-4" strokeWidth={1.7} />,       defaultWidth: 320, defaultHeight: 80 },
  { id: 'date',      type: 'date',     label: 'Date',      meta: 'MM/DD/YYYY',      icon: <Calendar className="co-ico co-ico-tilt w-4 h-4" strokeWidth={1.7} />,         defaultWidth: 150, defaultHeight: 24 },
  { id: 'number',    type: 'number',   label: 'Number',    meta: '0, 1, 2, …',      icon: <Hash className="co-ico co-ico-pop w-4 h-4" strokeWidth={1.7} />,              defaultWidth: 130, defaultHeight: 24 },
  { id: 'checkbox',  type: 'checkbox', label: 'Checkbox',  meta: 'Yes / no',        icon: <Square className="co-ico co-ico-rubber w-4 h-4" strokeWidth={1.7} />,         defaultWidth: 18,  defaultHeight: 18 },
  { id: 'dropdown',  type: 'dropdown', label: 'Dropdown',  meta: 'Pick from list',  icon: <List className="co-ico co-ico-swing w-4 h-4" strokeWidth={1.7} />,            defaultWidth: 200, defaultHeight: 24 },
  { id: 'radio',     type: 'radio',    label: 'Radio',     meta: 'One of many',     icon: <Circle className="co-ico co-ico-rubber w-4 h-4" strokeWidth={1.7} />,         defaultWidth: 18,  defaultHeight: 18 },
  { id: 'signature', type: 'text',     label: 'Signature', meta: 'Drawn or typed',  icon: <PenTool className="co-ico co-ico-pencil w-4 h-4" strokeWidth={1.7} />,        defaultWidth: 240, defaultHeight: 38 },
  { id: 'initials',  type: 'text',     label: 'Initials',  meta: '2–3 letters',     icon: <Type className="co-ico co-ico-jig w-4 h-4" strokeWidth={1.7} />,              defaultWidth: 60,  defaultHeight: 26 },
];

export default function PDFFieldCreator({
  pdfFile,
  onFieldsCreated,
  onClose,
}: PDFFieldCreatorProps) {
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [fields, setFields] = useState<PDFField[]>([]);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [scale, setScale] = useState(1.5);
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [viewport, setViewport] = useState<any>(null);
  const [pageSize, setPageSize] = useState({ width: 0, height: 0 });
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const [fieldConfig, setFieldConfig] = useState<{
    name: string;
    label: string;
    options?: string[];
    defaultValue?: string;
    required: boolean;
  }>({
    name: '',
    label: '',
    required: false,
  });
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const overlayContainerRef = useRef<HTMLDivElement>(null);

  // Load PDF.js from CDN
  useEffect(() => {
    let mounted = true;

    const loadPDF = async () => {
      if (typeof window === 'undefined') return;

      try {
        let pdfjsLib = (window as any).pdfjsLib;
        
        if (!pdfjsLib) {
          await new Promise<void>((resolve, reject) => {
            if ((window as any).pdfjsLib) {
              resolve();
              return;
            }

            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
            script.async = true;
            
            script.onload = () => {
              pdfjsLib = (window as any).pdfjsLib;
              if (pdfjsLib) {
                pdfjsLib.GlobalWorkerOptions.workerSrc = 
                  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
                resolve();
              } else {
                reject(new Error('PDF.js not found on window'));
              }
            };
            
            script.onerror = () => {
              reject(new Error('Failed to load PDF.js from CDN'));
            };
            
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

        const loadingTask = pdfjsLib.getDocument({ 
          data: arrayBuffer,
          useSystemFonts: true,
        });
        const pdf = await loadingTask.promise;
        
        if (mounted) {
          setPdfDoc(pdf);
          setNumPages(pdf.numPages);
          setCurrentPage(1);
        }
      } catch (error) {
        console.error('Error loading PDF:', error);
      }
    };

    loadPDF();

    return () => {
      mounted = false;
    };
  }, [pdfFile]);

  // Render PDF page on canvas
  useEffect(() => {
    const renderPage = async () => {
      if (!pdfDoc || !canvasRef.current) return;

      try {
        const page = await pdfDoc.getPage(currentPage);
        const viewportObj = page.getViewport({ scale });
        setViewport(viewportObj);
        
        const unscaledViewport = page.getViewport({ scale: 1.0 });
        setPageSize({ width: unscaledViewport.width, height: unscaledViewport.height });

        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');

        if (!context) return;

        const dpr = window.devicePixelRatio || 1;
        const backingStore = (context as any).webkitBackingStorePixelRatio ||
                           (context as any).mozBackingStorePixelRatio ||
                           (context as any).msBackingStorePixelRatio ||
                           (context as any).oBackingStorePixelRatio ||
                           (context as any).backingStorePixelRatio || 1;
        const ratio = dpr / backingStore;

        canvas.width = Math.floor(viewportObj.width * ratio);
        canvas.height = Math.floor(viewportObj.height * ratio);
        canvas.style.width = Math.floor(viewportObj.width) + 'px';
        canvas.style.height = Math.floor(viewportObj.height) + 'px';

        context.setTransform(ratio, 0, 0, ratio, 0, 0);

        await page.render({
          canvasContext: context,
          viewport: viewportObj,
        }).promise;

        const cssWidth = Math.floor(viewportObj.width);
        const cssHeight = Math.floor(viewportObj.height);
        
        requestAnimationFrame(() => {
          if (canvas) {
            setCanvasSize({ width: cssWidth, height: cssHeight });
          }
        });
      } catch (error) {
        console.error('Error rendering page:', error);
      }
    };

    renderPage();
  }, [pdfDoc, currentPage, scale]);

  // Convert canvas coordinates (relative to canvas) to PDF coordinates
  const canvasToPDF = useCallback((canvasX: number, canvasY: number): { x: number; y: number } => {
    if (!viewport || !pageSize.width || !pageSize.height) {
      return { x: 0, y: 0 };
    }

    // canvasX and canvasY are already relative to the canvas element
    // Convert viewport coordinates to PDF coordinates
    const pdfX = (canvasX / viewport.width) * pageSize.width;
    // Convert Y: canvas uses top-left origin, PDF uses bottom-left
    // So we need: pdfY (bottom-left) = pageHeight - (canvasY / viewport.height * pageHeight)
    const pdfY = pageSize.height - ((canvasY / viewport.height) * pageSize.height);

    return { x: pdfX, y: pdfY };
  }, [viewport, pageSize]);

  // Handle canvas click to place field
  const handleCanvasClick = (e: React.MouseEvent) => {
    // Don't place if clicking on an existing field overlay
    if ((e.target as HTMLElement).closest('[data-field-overlay]')) {
      return;
    }

    if (!selectedTemplateId || !viewport || !pageSize.width || !pageSize.height) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const canvasX = e.clientX - rect.left;
    const canvasY = e.clientY - rect.top;

    const template = FIELD_TEMPLATES.find(t => t.id === selectedTemplateId);
    if (!template) return;

    // Convert canvas → PDF top-left coords (both use top-left origin)
    const pdfX = (canvasX / viewport.width) * pageSize.width;
    const pdfY = (canvasY / viewport.height) * pageSize.height;

    const newField: PDFField = {
      name: `field_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      label: template.label,
      type: template.type,
      position: {
        x: pdfX,
        y: pdfY,
        width: template.defaultWidth,
        height: template.defaultHeight,
        page: currentPage - 1,
      },
      required: false,
    };

    if (template.type === 'radio' || template.type === 'dropdown') {
      newField.options = ['Option 1', 'Option 2', 'Option 3'];
    }

    setFields([...fields, newField]);
    setEditingField(newField.name);
    setFieldConfig({
      name: newField.name,
      label: newField.label || '',
      options: newField.options,
      required: false,
    });
    setSelectedTemplateId(null);
  };

  // Handle field drag to move
  const handleFieldDragStart = (fieldName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const field = fields.find(f => f.name === fieldName);
    if (!field || !field.position || !viewport || !pageSize.width || !pageSize.height) return;

    const startX = e.clientX;
    const startY = e.clientY;
    const startPos = { ...field.position };

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - startX;
      const deltaY = e.clientY - startY;

      // Convert pixel delta to PDF coordinates
      // For X: direct conversion (both use left-to-right)
      const pdfDeltaX = (deltaX / viewport.width) * pageSize.width;
      // For Y: canvas Y increases downward, PDF Y (in our top-left system) also increases downward
      // So we should NOT invert - just convert directly
      const pdfDeltaY = (deltaY / viewport.height) * pageSize.height;

      const updatedFields = fields.map(f => {
        if (f.name === fieldName && f.position) {
          return {
            ...f,
            position: {
              ...f.position,
              x: startPos.x + pdfDeltaX,
              y: startPos.y + pdfDeltaY,
            },
          };
        }
        return f;
      });

      setFields(updatedFields);
    };

    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  // Handle field resize
  const handleFieldResize = (fieldName: string, e: React.MouseEvent, corner: 'se' | 'sw' | 'ne' | 'nw') => {
    e.stopPropagation();
    const field = fields.find(f => f.name === fieldName);
    if (!field || !field.position || !viewport || !pageSize.width || !pageSize.height) return;

    const startX = e.clientX;
    const startY = e.clientY;
    const startPos = { ...field.position };

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - startX;
      const deltaY = e.clientY - startY;

      // Convert pixel delta to PDF coordinates
      const pdfDeltaX = (deltaX / viewport.width) * pageSize.width;
      // For resize, Y should follow mouse (no inversion needed since we use top-left origin)
      const pdfDeltaY = (deltaY / viewport.height) * pageSize.height;

      const updatedFields = fields.map(f => {
        if (f.name === fieldName && f.position) {
          const newPos = { ...f.position };
          
          if (corner === 'se') {
            // Southeast: expand right and down
            newPos.width = Math.max(20, startPos.width + pdfDeltaX);
            newPos.height = Math.max(10, startPos.height + pdfDeltaY);
          } else if (corner === 'sw') {
            // Southwest: expand left and down
            newPos.x = startPos.x + pdfDeltaX;
            newPos.width = Math.max(20, startPos.width - pdfDeltaX);
            newPos.height = Math.max(10, startPos.height + pdfDeltaY);
          } else if (corner === 'ne') {
            // Northeast: expand right and up
            newPos.width = Math.max(20, startPos.width + pdfDeltaX);
            newPos.height = Math.max(10, startPos.height - pdfDeltaY);
            newPos.y = startPos.y + pdfDeltaY;
          } else if (corner === 'nw') {
            // Northwest: expand left and up
            newPos.x = startPos.x + pdfDeltaX;
            newPos.width = Math.max(20, startPos.width - pdfDeltaX);
            newPos.height = Math.max(10, startPos.height - pdfDeltaY);
            newPos.y = startPos.y + pdfDeltaY;
          }

          return { ...f, position: newPos };
        }
        return f;
      });

      setFields(updatedFields);
    };

    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  // Get overlay style for a field
  const getFieldOverlayStyle = useCallback((field: PDFField) => {
    if (!field.position || !viewport || !canvasSize.width || !canvasSize.height) {
      return { display: 'none' };
    }

    // Our field.position is in top-left coordinate system (Y=0 at top, increases downward)
    const pdfX = field.position.x;
    const pdfY = field.position.y; // Top Y in top-left system
    const pdfWidth = field.position.width;
    const pdfHeight = field.position.height;

    const pageWidth = pageSize.width || (viewport.width / viewport.scale);
    const pageHeight = pageSize.height || (viewport.height / viewport.scale);
    
    // Convert to PDF's bottom-left coordinate system for viewport conversion
    // In top-left: field goes from Y=pdfY to Y=pdfY+pdfHeight
    // In bottom-left: field goes from Y=pageHeight-(pdfY+pdfHeight) to Y=pageHeight-pdfY
    const yMin = pageHeight - (pdfY + pdfHeight); // Bottom of field in bottom-left
    const yMax = pageHeight - pdfY; // Top of field in bottom-left

    // PDF.js expects [xMin, yMin, xMax, yMax] in bottom-left coordinates
    const pdfRect = [pdfX, yMin, pdfX + pdfWidth, yMax];
    
    let viewportRect: number[];
    try {
      viewportRect = viewport.convertToViewportRectangle(pdfRect);
    } catch (error) {
      return { display: 'none' };
    }

    const left = Math.min(viewportRect[0], viewportRect[2]);
    const top = Math.min(viewportRect[1], viewportRect[3]);
    const width = Math.abs(viewportRect[0] - viewportRect[2]);
    const height = Math.abs(viewportRect[1] - viewportRect[3]);

    return {
      position: 'absolute' as const,
      left: `${left}px`,
      top: `${top}px`,
      width: `${width}px`,
      height: `${height}px`,
      pointerEvents: 'auto' as const,
      zIndex: 10,
    };
  }, [viewport, canvasSize, pageSize]);

  // Save field configuration
  const handleSaveFieldConfig = () => {
    if (!editingField) return;

    const updatedFields = fields.map(f => {
      if (f.name === editingField) {
        return {
          ...f,
          name: fieldConfig.name || f.name,
          label: fieldConfig.label || f.label,
          options: fieldConfig.options,
          defaultValue: fieldConfig.defaultValue,
          required: fieldConfig.required,
        };
      }
      return f;
    });

    setFields(updatedFields);
    setEditingField(null);
    setFieldConfig({ name: '', label: '', required: false });
  };

  // Delete field
  const handleDeleteField = (fieldName: string) => {
    setFields(fields.filter(f => f.name !== fieldName));
    if (editingField === fieldName) {
      setEditingField(null);
    }
  };

  // Save all fields to PDF
  const handleSaveFields = async () => {
    if (fields.length === 0) {
      alert('No fields to save');
      return;
    }

    try {
      // Get PDF file as File or Blob
      let pdfBlob: Blob;
      if (pdfFile instanceof File) {
        pdfBlob = pdfFile;
      } else if (pdfFile instanceof Blob) {
        pdfBlob = pdfFile;
      } else {
        const response = await fetch(pdfFile);
        pdfBlob = await response.blob();
      }

      const formData = new FormData();
      formData.append('file', pdfBlob);
      formData.append('fields', JSON.stringify(fields));

      const response = await fetch('/api/add-fields', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to add fields to PDF');
      }

      const modifiedPdfBytes = new Uint8Array(await response.arrayBuffer());
      onFieldsCreated(fields, modifiedPdfBytes);
    } catch (error) {
      console.error('Error saving fields:', error);
      alert('Failed to save fields to PDF');
    }
  };

  const fieldsOnCurrentPage = fields.filter(f => f.position?.page === currentPage - 1);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-ink/55 backdrop-blur-sm flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.97, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.97, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-paper-card border border-rule rounded-xl shadow-2xl w-full max-w-[1400px] h-[92vh] flex flex-col overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 h-14 hairline bg-paper-card shrink-0">
            <div className="flex items-center gap-3">
              <h2 className="font-serif text-[17px] text-ink leading-none">Create form fields</h2>
              <span className="text-[12.5px] text-ink-faint">
                {fields.length} field{fields.length !== 1 ? 's' : ''} placed
              </span>
            </div>
            <div className="flex items-center gap-2">
              {numPages > 1 && (
                <div className="surface flex items-center gap-1 px-1.5 py-1">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className="p-1 hover:bg-paper-edge rounded text-ink disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    ←
                  </button>
                  <span className="text-[12.5px] text-ink min-w-[72px] text-center">
                    Page {currentPage}/{numPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage(prev => Math.min(numPages, prev + 1))}
                    disabled={currentPage === numPages}
                    className="p-1 hover:bg-paper-edge rounded text-ink disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    →
                  </button>
                </div>
              )}
              <button
                onClick={handleSaveFields}
                disabled={fields.length === 0}
                className="btn btn-primary btn-sm"
              >
                <Save className="w-3.5 h-3.5" />
                Save fields
              </button>
              <button onClick={onClose} className="btn btn-ghost btn-sm" title="Close">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="flex flex-1 overflow-hidden">
            {/* Field Type Toolbar */}
            <div className="w-72 hairline-t border-r border-rule overflow-y-auto bg-paper">
              <div className="p-5">
                <div className="eyebrow mb-3">Drag to add</div>
                <div className="space-y-1.5">
                  {FIELD_TEMPLATES.map((template) => (
                    <button
                      key={template.id}
                      onClick={() => {
                        setSelectedTemplateId(template.id);
                        setEditingField(null);
                      }}
                      className="field-chip"
                      data-selected={selectedTemplateId === template.id}
                    >
                      <span className="field-chip-icon">{template.icon}</span>
                      <span className="flex-1 min-w-0">
                        <span className="block font-medium text-[13.5px] leading-tight">
                          {template.label}
                        </span>
                        <span className="block field-chip-meta leading-tight mt-0.5">
                          {template.meta}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>

                {/* Field Configuration Panel */}
                {editingField && (
                  <div className="mt-6 pt-6 hairline-t">
                    <div className="eyebrow mb-3">Field settings</div>
                    <div className="space-y-3">
                      <div>
                        <label className="field-label">Field name</label>
                        <input
                          type="text"
                          value={fieldConfig.name}
                          onChange={(e) => setFieldConfig({ ...fieldConfig, name: e.target.value })}
                          className="input py-1.5 text-[13px]"
                        />
                      </div>
                      <div>
                        <label className="field-label">Label</label>
                        <input
                          type="text"
                          value={fieldConfig.label}
                          onChange={(e) => setFieldConfig({ ...fieldConfig, label: e.target.value })}
                          className="input py-1.5 text-[13px]"
                        />
                      </div>
                      {(fields.find(f => f.name === editingField)?.type === 'dropdown' ||
                        fields.find(f => f.name === editingField)?.type === 'radio') && (
                        <div>
                          <label className="field-label">Options (one per line)</label>
                          <textarea
                            value={fieldConfig.options?.join('\n') || ''}
                            onChange={(e) => setFieldConfig({
                              ...fieldConfig,
                              options: e.target.value.split('\n').filter(o => o.trim()),
                            })}
                            rows={4}
                            className="input py-2 text-[13px]"
                          />
                        </div>
                      )}
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={fieldConfig.required}
                          onChange={(e) => setFieldConfig({ ...fieldConfig, required: e.target.checked })}
                          className="checkbox"
                        />
                        <span className="text-[13px] text-ink">Required field</span>
                      </label>
                      <div className="flex gap-2 pt-1">
                        <button onClick={handleSaveFieldConfig} className="btn btn-primary btn-sm flex-1 justify-center">
                          Save
                        </button>
                        <button
                          onClick={() => {
                            setEditingField(null);
                            setFieldConfig({ name: '', label: '', required: false });
                          }}
                          className="btn btn-outline btn-sm"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Fields List */}
                {fields.length > 0 && (
                  <div className="mt-6 pt-6 hairline-t">
                    <div className="eyebrow mb-3">On this page</div>
                    <div className="space-y-1 max-h-72 overflow-y-auto">
                      {fields
                        .filter((f) => f.position?.page === currentPage - 1)
                        .map((field) => (
                          <button
                            key={field.name}
                            onClick={() => {
                              setEditingField(field.name);
                              setFieldConfig({
                                name: field.name,
                                label: field.label || '',
                                options: field.options,
                                defaultValue: field.defaultValue as string,
                                required: field.required || false,
                              });
                            }}
                            className={`w-full text-left px-2.5 py-1.5 rounded-md border transition-colors flex items-center justify-between gap-2 ${
                              editingField === field.name
                                ? 'bg-accent-tint border-accent-line text-accent'
                                : 'bg-paper-elev border-rule hover:border-ink-faint text-ink'
                            }`}
                          >
                            <span className="text-[13px] truncate">{field.label || field.name}</span>
                            <span className="font-mono text-[10.5px] text-ink-faint shrink-0">
                              {field.type}
                            </span>
                          </button>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* PDF Canvas Viewer */}
            <div className="flex-1 bg-paper p-6 overflow-auto">
              {pdfDoc ? (
                <div ref={containerRef} className="flex justify-center items-start">
                  <div className="relative inline-block">
                    <canvas
                      ref={canvasRef}
                      onClick={handleCanvasClick}
                      className={`bg-white rounded-md shadow-lg ring-1 ring-rule ${
                        selectedTemplateId ? 'cursor-crosshair' : 'cursor-default'
                      }`}
                    />
                    
                    {/* Field Overlays */}
                    {canvasSize.width > 0 && canvasSize.height > 0 && viewport && (
                      <div
                        ref={overlayContainerRef}
                        className="absolute top-0 left-0 pointer-events-none"
                        style={{
                          width: `${canvasSize.width}px`,
                          height: `${canvasSize.height}px`,
                        }}
                      >
                        {fieldsOnCurrentPage.map((field) => {
                          const style = getFieldOverlayStyle(field);
                          const isEditing = editingField === field.name;

                          if (style.display === 'none') return null;

                          return (
                            <div
                              key={field.name}
                          style={{
                            ...style,
                            backgroundColor: isEditing
                              ? 'rgba(45, 74, 58, 0.22)'
                              : 'rgba(45, 74, 58, 0.10)',
                            border: isEditing
                              ? '2px solid #2d4a3a'
                              : '1.5px dashed rgba(45, 74, 58, 0.55)',
                            boxShadow: isEditing ? '0 0 0 3px rgba(45, 74, 58, 0.18)' : 'none',
                            borderRadius: '3px',
                            pointerEvents: 'auto',
                            cursor: 'move',
                          }}
                          data-field-overlay
                          onMouseDown={(e) => {
                            // Only drag if not clicking on resize handle or delete button
                            if ((e.target as HTMLElement).closest('.resize-handle, .delete-button')) {
                              return;
                            }
                            handleFieldDragStart(field.name, e);
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingField(field.name);
                            setFieldConfig({
                              name: field.name,
                              label: field.label || '',
                              options: field.options,
                              defaultValue: field.defaultValue as string,
                              required: field.required || false,
                            });
                          }}
                          className="group relative"
                        >
                          {/* Resize handles */}
                          <div
                            className="resize-handle absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-accent rounded-full opacity-0 group-hover:opacity-100 cursor-se-resize ring-2 ring-paper-card"
                            onMouseDown={(e) => {
                              e.stopPropagation();
                              handleFieldResize(field.name, e, 'se');
                            }}
                          />

                              {/* Delete button */}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteField(field.name);
                                }}
                                className="delete-button absolute -top-2 -right-2 w-5 h-5 bg-paper-card border border-rule rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-30 shadow-md hover:bg-danger-tint hover:border-danger"
                              >
                                <Trash2 className="w-2.5 h-2.5 text-danger" />
                              </button>

                              {/* Field label */}
                              <div className="absolute -top-7 left-0 bg-ink text-paper-card text-[11.5px] font-medium px-2 py-1 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 shadow-md">
                                {field.label || field.name}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-9 w-9 border-2 border-accent border-t-transparent mx-auto mb-3"></div>
                    <p className="text-ink-soft text-[13px]">Loading PDF…</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
