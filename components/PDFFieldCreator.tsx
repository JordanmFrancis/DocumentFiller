'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PDFField, PDFFieldType, PDFFieldPosition } from '@/types/pdf';
import { X, Check, Type, Square, Circle, List, Calendar, Hash, Save, Trash2 } from 'lucide-react';

interface PDFFieldCreatorProps {
  pdfFile: File | Blob | string;
  onFieldsCreated: (fields: PDFField[], modifiedPdfBytes: Uint8Array) => void;
  onClose: () => void;
}

interface FieldTemplate {
  type: PDFFieldType;
  label: string;
  icon: React.ReactNode;
  defaultWidth: number;
  defaultHeight: number;
}

const FIELD_TEMPLATES: FieldTemplate[] = [
  { type: 'text', label: 'Text Field', icon: <Type className="w-5 h-5" />, defaultWidth: 200, defaultHeight: 25 },
  { type: 'checkbox', label: 'Checkbox', icon: <Square className="w-5 h-5" />, defaultWidth: 20, defaultHeight: 20 },
  { type: 'radio', label: 'Radio Group', icon: <Circle className="w-5 h-5" />, defaultWidth: 20, defaultHeight: 20 },
  { type: 'dropdown', label: 'Dropdown', icon: <List className="w-5 h-5" />, defaultWidth: 200, defaultHeight: 25 },
  { type: 'date', label: 'Date', icon: <Calendar className="w-5 h-5" />, defaultWidth: 150, defaultHeight: 25 },
  { type: 'number', label: 'Number', icon: <Hash className="w-5 h-5" />, defaultWidth: 150, defaultHeight: 25 },
];

export default function PDFFieldCreator({
  pdfFile,
  onFieldsCreated,
  onClose,
}: PDFFieldCreatorProps) {
  const [selectedFieldType, setSelectedFieldType] = useState<PDFFieldType | null>(null);
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

    if (!selectedFieldType || !viewport || !pageSize.width || !pageSize.height) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    // Get mouse position relative to canvas
    const canvasX = e.clientX - rect.left;
    const canvasY = e.clientY - rect.top;

    const template = FIELD_TEMPLATES.find(t => t.type === selectedFieldType);
    if (!template) return;

    // Convert canvas coordinates directly to our top-left PDF coordinate system
    // Both canvas and our system use top-left origin (Y increases downward)
    // So we can convert directly without any Y-axis inversion
    const pdfX = (canvasX / viewport.width) * pageSize.width;
    const pdfY = (canvasY / viewport.height) * pageSize.height;
    
    // The click point should be the top-left corner of the field
    // Since both use top-left origin, pdfY is already correct
    const fieldY = pdfY;

    const newField: PDFField = {
      name: `field_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      label: template.label,
      type: selectedFieldType,
      position: {
        x: pdfX,
        y: fieldY,
        width: template.defaultWidth,
        height: template.defaultHeight,
        page: currentPage - 1,
      },
      required: false,
    };

    // Add options for radio and dropdown
    if (selectedFieldType === 'radio' || selectedFieldType === 'dropdown') {
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
    setSelectedFieldType(null); // Deselect after placing
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
        className="fixed inset-0 z-50 bg-ink/70 backdrop-blur-sm flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0, rotate: 1 }}
          animate={{ scale: 1, opacity: 1, rotate: 0 }}
          exit={{ scale: 0.95, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-paper border-2 border-ink rounded-lg shadow-rough-xl w-full max-w-7xl h-[92vh] flex flex-col relative"
        >
          {/* Tape on top */}
          <div className="tape tape-pink" style={{ top: '-12px', left: '50%', marginLeft: '-35px', zIndex: 10 }} />

          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b-2 border-ink bg-paper">
            <div className="flex items-center gap-4">
              <h2 className="font-marker text-xl text-ink squig">Create Form Fields</h2>
              <span className="font-cursive text-base text-ink-soft">
                {fields.length} field{fields.length !== 1 ? 's' : ''} created
              </span>
            </div>
            <div className="flex items-center gap-2">
              {numPages > 1 && (
                <div className="flex items-center gap-1 rough-sm px-2 py-1 bg-white">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className="px-2 py-0.5 hover:bg-accent-yellow/40 rounded font-marker text-sm disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    ←
                  </button>
                  <span className="font-marker text-ink text-sm min-w-[80px] text-center">
                    Page {currentPage} / {numPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage(prev => Math.min(numPages, prev + 1))}
                    disabled={currentPage === numPages}
                    className="px-2 py-0.5 hover:bg-accent-yellow/40 rounded font-marker text-sm disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    →
                  </button>
                </div>
              )}
              <button
                onClick={handleSaveFields}
                disabled={fields.length === 0}
                className="btn-rough primary"
              >
                <Save className="w-4 h-4" />
                Save Fields
              </button>
              <button
                onClick={onClose}
                className="btn-rough"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="flex flex-1 overflow-hidden">
            {/* Field Type Toolbar */}
            <div className="w-72 border-r-2 border-ink p-4 overflow-y-auto bg-paper-indexcard">
              <h3 className="font-marker text-sm uppercase text-ink mb-3 squig inline-block">Field Types</h3>
              <div className="space-y-2 mt-4">
                {FIELD_TEMPLATES.map((template) => (
                  <button
                    key={template.type}
                    onClick={() => {
                      setSelectedFieldType(template.type);
                      setEditingField(null);
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md border-[1.5px] border-ink font-marker text-sm transition-all ${
                      selectedFieldType === template.type
                        ? 'bg-accent-yellow shadow-rough'
                        : 'bg-white hover:bg-paper-legalpad shadow-rough'
                    }`}
                  >
                    {template.icon}
                    <span>{template.label}</span>
                  </button>
                ))}
              </div>

              {/* Field Configuration Panel */}
              {editingField && (
                <div className="mt-6 pt-6 border-t-2 border-dashed border-ink/30">
                  <h3 className="font-marker text-sm uppercase text-ink mb-3 squig inline-block">Field Settings</h3>
                  <div className="space-y-3 mt-4">
                    <div>
                      <label className="font-cursive text-sm text-ink-soft mb-1 block">Field Name</label>
                      <input
                        type="text"
                        value={fieldConfig.name}
                        onChange={(e) => setFieldConfig({ ...fieldConfig, name: e.target.value })}
                        className="input-rough text-sm py-1.5"
                      />
                    </div>
                    <div>
                      <label className="font-cursive text-sm text-ink-soft mb-1 block">Label</label>
                      <input
                        type="text"
                        value={fieldConfig.label}
                        onChange={(e) => setFieldConfig({ ...fieldConfig, label: e.target.value })}
                        className="input-rough text-sm py-1.5"
                      />
                    </div>
                    {(fields.find(f => f.name === editingField)?.type === 'dropdown' ||
                      fields.find(f => f.name === editingField)?.type === 'radio') && (
                      <div>
                        <label className="font-cursive text-sm text-ink-soft mb-1 block">Options (one per line)</label>
                        <textarea
                          value={fieldConfig.options?.join('\n') || ''}
                          onChange={(e) => setFieldConfig({
                            ...fieldConfig,
                            options: e.target.value.split('\n').filter(o => o.trim()),
                          })}
                          rows={4}
                          className="input-rough text-sm py-2 font-hand"
                        />
                      </div>
                    )}
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={fieldConfig.required}
                        onChange={(e) => setFieldConfig({ ...fieldConfig, required: e.target.checked })}
                        className="checkbox-hand"
                        style={{ width: 18, height: 18 }}
                      />
                      <span className="font-cursive text-base text-ink">Required field</span>
                    </label>
                    <div className="flex gap-2">
                      <button
                        onClick={handleSaveFieldConfig}
                        className="btn-rough primary flex-1 justify-center"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => {
                          setEditingField(null);
                          setFieldConfig({ name: '', label: '', required: false });
                        }}
                        className="btn-rough"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Fields List */}
              {fields.length > 0 && (
                <div className="mt-6 pt-6 border-t-2 border-dashed border-ink/30">
                  <h3 className="font-marker text-sm uppercase text-ink mb-3 squig inline-block">Created Fields</h3>
                  <div className="space-y-2 max-h-64 overflow-y-auto mt-4">
                    {fields.map((field) => (
                      <div
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
                        className={`p-2.5 rounded-md border-[1.5px] cursor-pointer transition-all ${
                          editingField === field.name
                            ? 'bg-accent-yellow border-ink shadow-rough'
                            : 'bg-white border-ink/30 hover:border-ink hover:shadow-rough'
                        }`}
                      >
                        <div className="font-marker text-sm text-ink">{field.label || field.name}</div>
                        <div className="font-typewriter text-[10px] uppercase text-ink-faint">{field.type}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* PDF Canvas Viewer */}
            <div className="flex-1 bg-paper p-4 overflow-auto">
              {pdfDoc ? (
                <div ref={containerRef} className="flex justify-center items-start">
                  <div className="relative inline-block">
                    <canvas
                      ref={canvasRef}
                      onClick={handleCanvasClick}
                      className={`border-2 border-ink rounded-md shadow-rough-lg bg-white ${
                        selectedFieldType ? 'cursor-crosshair' : 'cursor-default'
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
                              ? 'rgba(255, 222, 89, 0.5)'
                              : 'rgba(255, 222, 89, 0.22)',
                            border: isEditing
                              ? '2.5px solid #1a1a1a'
                              : '2px dashed rgba(26,26,26,0.7)',
                            boxShadow: isEditing ? '2px 2px 0 #1a1a1a' : 'none',
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
                            className="resize-handle absolute -bottom-1.5 -right-1.5 w-3.5 h-3.5 bg-ink rounded-full opacity-0 group-hover:opacity-100 cursor-se-resize border-2 border-white"
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
                                className="delete-button absolute -top-2 -right-2 w-6 h-6 bg-accent-coral hover:bg-red-500 rounded-full border-[1.5px] border-ink flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-30 shadow-rough"
                              >
                                <Trash2 className="w-3 h-3 text-ink" />
                              </button>

                              {/* Field label */}
                              <div className="absolute -top-7 left-0 bg-ink text-white font-marker text-xs px-2 py-1 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 shadow-rough">
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
                    <div className="animate-spin rounded-full h-10 w-10 border-2 border-ink border-t-transparent mx-auto mb-3"></div>
                    <p className="font-marker text-ink">loading PDF…</p>
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
