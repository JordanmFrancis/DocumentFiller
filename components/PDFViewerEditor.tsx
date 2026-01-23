'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PDFField } from '@/types/pdf';
import { X, Check, Move, ZoomIn, ZoomOut } from 'lucide-react';

interface PDFViewerEditorProps {
  pdfFile: File | Blob | string;
  fields: PDFField[];
  highlightFieldName?: string | null;
  onFieldsChange: (fields: PDFField[]) => void;
  onClose: () => void;
}

interface OverlayOffset {
  x: number;
  y: number;
  scale: number;
}

export default function PDFViewerEditor({
  pdfFile,
  fields,
  highlightFieldName,
  onFieldsChange,
  onClose,
}: PDFViewerEditorProps) {
  const [hoveredField, setHoveredField] = useState<string | null>(null);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [pdfUrl, setPdfUrl] = useState<string>('');
  const [scale, setScale] = useState(1.5);
  const [overlayOffset, setOverlayOffset] = useState<OverlayOffset>({ x: 0, y: 0, scale: 1 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [viewport, setViewport] = useState<any>(null);
  const [pageSize, setPageSize] = useState({ width: 0, height: 0 }); // Page size in points
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const [highlightedFieldRef, setHighlightedFieldRef] = useState<HTMLDivElement | null>(null);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const overlayContainerRef = useRef<HTMLDivElement>(null);

  // Load PDF.js from CDN (avoids Next.js webpack issues)
  useEffect(() => {
    let mounted = true;

    const loadPDF = async () => {
      // Ensure we're on client side
      if (typeof window === 'undefined') return;

      try {
        // Load PDF.js from CDN if not already loaded
        let pdfjsLib = (window as any).pdfjsLib;
        
        if (!pdfjsLib) {
          // Load PDF.js script from CDN
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

        // Get PDF data
        let arrayBuffer: ArrayBuffer;
        if (pdfFile instanceof File || pdfFile instanceof Blob) {
          arrayBuffer = await pdfFile.arrayBuffer();
        } else {
          const response = await fetch(pdfFile);
          arrayBuffer = await response.arrayBuffer();
        }

        // Load PDF document
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
        console.error('Error details:', error);
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
        
        // Get actual page dimensions from PDF (in points) using unscaled viewport
        const unscaledViewport = page.getViewport({ scale: 1.0 });
        setPageSize({ width: unscaledViewport.width, height: unscaledViewport.height });

        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');

        if (!context) return;

        // High-DPI support
        const dpr = window.devicePixelRatio || 1;
        const backingStore = (context as any).webkitBackingStorePixelRatio ||
                           (context as any).mozBackingStorePixelRatio ||
                           (context as any).msBackingStorePixelRatio ||
                           (context as any).oBackingStorePixelRatio ||
                           (context as any).backingStorePixelRatio || 1;
        const ratio = dpr / backingStore;

        // Set canvas dimensions
        canvas.width = Math.floor(viewportObj.width * ratio);
        canvas.height = Math.floor(viewportObj.height * ratio);
        canvas.style.width = Math.floor(viewportObj.width) + 'px';
        canvas.style.height = Math.floor(viewportObj.height) + 'px';

        context.setTransform(ratio, 0, 0, ratio, 0, 0);

        // Render PDF page
        await page.render({
          canvasContext: context,
          viewport: viewportObj,
        }).promise;

        // Log rendering info and set canvas size
        // Use the CSS size (style width/height) for overlay positioning
        const cssWidth = Math.floor(viewportObj.width);
        const cssHeight = Math.floor(viewportObj.height);
        
        // Wait a frame to ensure canvas is rendered
        requestAnimationFrame(() => {
          if (canvas) {
            const canvasRect = canvas.getBoundingClientRect();
            setCanvasSize({ width: cssWidth, height: cssHeight });
            
            console.log('Canvas size set:', { width: cssWidth, height: cssHeight });
            console.log('Canvas bounding rect:', canvasRect);
          }
        });

        console.log('=== PDF RENDERING INFO ===');
        console.log('Viewport:', {
          width: viewportObj.width,
          height: viewportObj.height,
          scale: viewportObj.scale,
        });
        console.log('Canvas:', {
          actualWidth: canvas.width,
          actualHeight: canvas.height,
          styleWidth: canvas.style.width,
          styleHeight: canvas.style.height,
        });
        console.log('Device Pixel Ratio:', { dpr, backingStore, ratio });
        console.log('==========================');

      } catch (error) {
        console.error('Error rendering page:', error);
      }
    };

    renderPage();
  }, [pdfDoc, currentPage, scale]);

  // Handle field highlighting - navigate to page and scroll to field
  useEffect(() => {
    if (!highlightFieldName || !pdfDoc) return;

    const field = fields.find(f => f.name === highlightFieldName);
    if (!field || !field.position) return;

    const fieldPage = field.position.page + 1; // Convert 0-based to 1-based

    // Navigate to the correct page if needed
    if (currentPage !== fieldPage) {
      setCurrentPage(fieldPage);
      // Wait for page to render before scrolling
      setTimeout(() => {
        scrollToHighlightedField();
      }, 500);
    } else {
      // Already on correct page, wait for overlay to render
      setTimeout(() => {
        scrollToHighlightedField();
      }, 100);
    }
  }, [highlightFieldName, pdfDoc, fields, currentPage, viewport, canvasSize]);

  // Scroll to highlighted field
  const scrollToHighlightedField = useCallback(() => {
    if (!highlightedFieldRef || !containerRef.current) return;

    const fieldElement = highlightedFieldRef;
    const container = containerRef.current;

    // Get field position relative to container
    const fieldRect = fieldElement.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();

    // Calculate scroll position to center the field
    const scrollTop = container.scrollTop + (fieldRect.top - containerRect.top) - (containerRect.height / 2) + (fieldRect.height / 2);
    const scrollLeft = container.scrollLeft + (fieldRect.left - containerRect.left) - (containerRect.width / 2) + (fieldRect.width / 2);

    // Smooth scroll to field
    container.scrollTo({
      top: Math.max(0, scrollTop),
      left: Math.max(0, scrollLeft),
      behavior: 'smooth',
    });
  }, [highlightedFieldRef]);

  // Filter fields with positions for current page (defined before useCallback)
  const fieldsWithPosition = fields.filter(f => f.position && f.position.page === currentPage - 1);

  // Calculate overlay positions with offset and scale adjustments
  const getFieldOverlayStyle = useCallback((field: PDFField) => {
    if (!field.position || !viewport || !canvasSize.width || !canvasSize.height) {
      return { display: 'none' };
    }

    // Our PDF position is already in top-left coordinates (converted from bottom-left in detector)
    // But PDF.js viewport uses bottom-left origin, so we need to convert back
    const pdfX = field.position.x;
    const pdfY = field.position.y;
    const pdfWidth = field.position.width;
    const pdfHeight = field.position.height;

    // Use the actual page size in points (from PDF)
    const pageWidth = pageSize.width || (viewport.width / viewport.scale);
    const pageHeight = pageSize.height || (viewport.height / viewport.scale);
    
    // Convert our top-left Y back to bottom-left for PDF.js
    // Our y is from top, PDF.js expects from bottom
    const pdfYBottomLeft = pageHeight - (pdfY + pdfHeight);

    // Convert PDF rectangle to viewport coordinates
    // PDF.js convertToViewportRectangle expects [xMin, yMin, xMax, yMax] in PDF coordinates (bottom-left origin)
    const pdfRect = [pdfX, pdfYBottomLeft, pdfX + pdfWidth, pdfYBottomLeft + pdfHeight];
    
    let viewportRect: number[];
    try {
      viewportRect = viewport.convertToViewportRectangle(pdfRect);
    } catch (error) {
      console.error(`Error converting rect for field ${field.name}:`, error);
      return { display: 'none' };
    }

    // Extract viewport coordinates
    const left = Math.min(viewportRect[0], viewportRect[2]);
    const top = Math.min(viewportRect[1], viewportRect[3]);
    const width = Math.abs(viewportRect[0] - viewportRect[2]);
    const height = Math.abs(viewportRect[1] - viewportRect[3]);

    // Apply user adjustments (drag offset and scale)
    const adjustedLeft = left + overlayOffset.x;
    const adjustedTop = top + overlayOffset.y;
    const adjustedWidth = width * overlayOffset.scale;
    const adjustedHeight = height * overlayOffset.scale;

    // Log calculation for debugging (always log first field, or when hovering)
    const allFieldsWithPosition = fields.filter(f => f.position && f.position.page === currentPage - 1);
    if (hoveredField === field.name || (allFieldsWithPosition.indexOf(field) === 0 && viewport)) {
      console.log(`=== Field "${field.name}" Overlay Calculation ===`);
      console.log('PDF Position (points, top-left):', { x: pdfX, y: pdfY, width: pdfWidth, height: pdfHeight });
      console.log('Page Dimensions (points):', { width: pageWidth, height: pageHeight });
      console.log('PDF Y (bottom-left):', pdfYBottomLeft);
      console.log('PDF Rect (bottom-left):', pdfRect);
      console.log('Viewport Rect:', viewportRect);
      console.log('Base Overlay (px):', { left, top, width, height });
      console.log('User Adjustments:', overlayOffset);
      console.log('Final Overlay (px):', { 
        left: adjustedLeft, 
        top: adjustedTop, 
        width: adjustedWidth, 
        height: adjustedHeight 
      });
      console.log('Canvas Size:', canvasSize);
      console.log('==========================================');
    }

    return {
      position: 'absolute' as const,
      left: `${adjustedLeft}px`,
      top: `${adjustedTop}px`,
      width: `${adjustedWidth}px`,
      height: `${adjustedHeight}px`,
      pointerEvents: 'auto' as const,
      zIndex: 10,
    };
  }, [viewport, overlayOffset, hoveredField, canvasSize, pageSize]);

  // Drag handlers for all overlays together
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return; // Only left mouse button
    if (!overlayContainerRef.current) return;
    
    const containerRect = overlayContainerRef.current.getBoundingClientRect();
    setIsDragging(true);
    setDragStart({ 
      x: e.clientX - overlayOffset.x - containerRect.left, 
      y: e.clientY - overlayOffset.y - containerRect.top 
    });
    e.preventDefault();
    e.stopPropagation();
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging || !overlayContainerRef.current) return;
    
    const containerRect = overlayContainerRef.current.getBoundingClientRect();
    setOverlayOffset({
      x: e.clientX - dragStart.x - containerRect.left,
      y: e.clientY - dragStart.y - containerRect.top,
      scale: overlayOffset.scale,
    });
  }, [isDragging, dragStart, overlayOffset.scale]);

  const handleMouseUp = useCallback(() => {
    if (isDragging) {
      setIsDragging(false);
      console.log('=== Final Overlay Offset ===');
      console.log('Offset:', overlayOffset);
      console.log('Use these values to hardcode the offset in the code:');
      console.log(`overlayOffset: { x: ${overlayOffset.x}, y: ${overlayOffset.y}, scale: ${overlayOffset.scale} }`);
      console.log('===========================');
    }
  }, [isDragging, overlayOffset]);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  // Scale handlers (mouse wheel)
  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.05 : 0.05;
      setOverlayOffset(prev => ({
        ...prev,
        scale: Math.max(0.5, Math.min(2, prev.scale + delta)),
      }));
    }
  };

  const handleFieldClick = (fieldName: string, event?: React.MouseEvent) => {
    if (event) {
      event.stopPropagation();
    }
    const field = fields.find((f) => f.name === fieldName);
    if (field) {
      setEditingField(fieldName);
      setEditValue(field.label || field.name);
    }
  };

  const handleSaveEdit = () => {
    if (editingField && editValue.trim()) {
      const updatedFields = fields.map((field) =>
        field.name === editingField
          ? { ...field, label: editValue.trim() }
          : field
      );
      onFieldsChange(updatedFields);
    }
    setEditingField(null);
    setEditValue('');
  };

  const handleCancelEdit = () => {
    setEditingField(null);
    setEditValue('');
  };

  const handleZoom = (delta: number) => {
    setScale(prev => Math.max(0.5, Math.min(3, prev + delta)));
  };

  const handlePrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(prev => prev - 1);
      // Reset overlay offset when changing pages
      setOverlayOffset({ x: 0, y: 0, scale: 1 });
    }
  };

  const handleNextPage = () => {
    if (currentPage < numPages) {
      setCurrentPage(prev => prev + 1);
      // Reset overlay offset when changing pages
      setOverlayOffset({ x: 0, y: 0, scale: 1 });
    }
  };

  // Output final calculation formula to console
  useEffect(() => {
    if (viewport && overlayOffset.x !== 0 || overlayOffset.y !== 0 || overlayOffset.scale !== 1) {
      console.log('=== OVERLAY POSITION FORMULA ===');
      console.log('For each field with PDF position (x, y, width, height) in points (top-left origin):');
      console.log(`
1. Get page dimensions:
   pageWidth = viewport.width / viewport.scale * 72
   pageHeight = viewport.height / viewport.scale * 72
   
2. Convert PDF Y from top-left to bottom-left:
   pdfYBottomLeft = pageHeight - (pdfY + pdfHeight)
   
3. Create PDF rect in bottom-left coordinates:
   pdfRect = [pdfX, pdfYBottomLeft, pdfX + pdfWidth, pdfYBottomLeft + pdfHeight]
   
4. Convert to viewport coordinates:
   viewportRect = viewport.convertToViewportRectangle(pdfRect)
   
5. Calculate base overlay:
   left = min(viewportRect[0], viewportRect[2])
   top = min(viewportRect[1], viewportRect[3])
   width = abs(viewportRect[0] - viewportRect[2])
   height = abs(viewportRect[1] - viewportRect[3])
   
6. Apply user adjustments:
   finalLeft = left + ${overlayOffset.x}
   finalTop = top + ${overlayOffset.y}
   finalWidth = width * ${overlayOffset.scale}
   finalHeight = height * ${overlayOffset.scale}
      `);
      console.log('Current adjustments:', overlayOffset);
      console.log('==============================');
    }
  }, [viewport, overlayOffset]);
  
  // Debug: Log field positions
  useEffect(() => {
    console.log('=== FIELD POSITIONS DEBUG ===');
    console.log(`Current page: ${currentPage} (0-based: ${currentPage - 1})`);
    console.log(`Total pages: ${numPages}`);
    console.log(`Total fields: ${fields.length}`);
    
    // Show page distribution
    const fieldsByPage: Record<number, number> = {};
    fields.forEach(f => {
      const page = f.position?.page ?? -1;
      fieldsByPage[page] = (fieldsByPage[page] || 0) + 1;
    });
    console.log('Fields by page (0-based):', fieldsByPage);
    
    if (fieldsWithPosition.length > 0) {
      console.log(`Found ${fieldsWithPosition.length} fields with positions on page ${currentPage}`);
      console.log('Canvas size:', canvasSize);
      console.log('Viewport:', viewport);
      console.log('Fields on this page:', fieldsWithPosition.map(f => ({
        name: f.name,
        position: f.position,
      })));
      
      if (viewport) {
        fieldsWithPosition.forEach((field, index) => {
          const style = getFieldOverlayStyle(field);
          console.log(`Field ${index + 1} (${field.name}):`, {
            pdfPosition: field.position,
            overlayStyle: style,
          });
        });
      } else {
        console.warn('Viewport not set yet - overlays cannot be calculated');
      }
      console.log('============================');
    } else {
      console.warn('No fields with positions found!');
      console.log('All fields:', fields.map(f => ({
        name: f.name,
        hasPosition: !!f.position,
        position: f.position,
      })));
    }
  }, [fieldsWithPosition, viewport, canvasSize, getFieldOverlayStyle, currentPage, fields]);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-gray-900 rounded-xl shadow-2xl w-full max-w-7xl h-[90vh] flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-800">
            <div className="flex items-center gap-4">
              <h2 className="text-xl font-bold text-white">Edit Field Labels</h2>
              <div className="text-sm text-gray-400">
                {fields.length} total field{fields.length !== 1 ? 's' : ''} • {fieldsWithPosition.length} with positions on page {currentPage}
              </div>
              {fieldsWithPosition.length === 0 && (
                <div className="text-xs text-yellow-400">
                  ⚠ No field positions detected - check console
                </div>
              )}
              {fieldsWithPosition.length > 0 && (
                <div className="text-xs text-gray-500">
                  Drag to move • Ctrl+Wheel to scale
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              {/* Page Navigation */}
              {numPages > 1 && (
                <div className="flex items-center gap-2 bg-gray-800 rounded-lg px-3 py-1">
                  <button
                    onClick={handlePrevPage}
                    disabled={currentPage === 1}
                    className="px-2 py-1 hover:bg-gray-700 rounded text-white text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    ←
                  </button>
                  <span className="text-gray-300 text-sm min-w-[80px] text-center">
                    Page {currentPage} / {numPages}
                  </span>
                  <button
                    onClick={handleNextPage}
                    disabled={currentPage === numPages}
                    className="px-2 py-1 hover:bg-gray-700 rounded text-white text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    →
                  </button>
                </div>
              )}
              <div className="flex items-center gap-2 bg-gray-800 rounded-lg px-2 py-1">
                <button
                  onClick={() => handleZoom(-0.1)}
                  className="px-2 py-1 hover:bg-gray-700 rounded text-white text-sm"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <span className="text-gray-300 text-sm min-w-[50px] text-center">
                  {Math.round(scale * 100)}%
                </span>
                <button
                  onClick={() => handleZoom(0.1)}
                  className="px-2 py-1 hover:bg-gray-700 rounded text-white text-sm"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-400 hover:text-white" />
              </button>
            </div>
          </div>

          {/* PDF Canvas Viewer with Overlays */}
          <div className="flex-1 bg-gray-800 p-4 overflow-auto">
            {pdfDoc ? (
              <div 
                ref={containerRef}
                className="flex justify-center items-start"
                onWheel={handleWheel}
              >
                <div className="relative inline-block">
                  <canvas
                    ref={canvasRef}
                    className="border border-gray-700 rounded-lg shadow-2xl"
                  />
                  
                  {/* Overlay Container - positioned absolutely over canvas */}
                  {canvasSize.width > 0 && canvasSize.height > 0 && viewport && fieldsWithPosition.length > 0 && (
                    <div
                      ref={overlayContainerRef}
                      className="absolute top-0 left-0 pointer-events-none"
                      style={{
                        width: `${canvasSize.width}px`,
                        height: `${canvasSize.height}px`,
                        cursor: isDragging ? 'grabbing' : 'grab',
                        border: '1px solid rgba(59, 130, 246, 0.3)', // Debug: show overlay container
                      }}
                      onMouseDown={handleMouseDown}
                    >
                    {/* Field Overlays */}
                    {fieldsWithPosition.map((field) => {
                      const isHovered = hoveredField === field.name;
                      const isEditing = editingField === field.name;
                      const isHighlighted = highlightFieldName === field.name;
                      const style = getFieldOverlayStyle(field);

                      // Skip if style says to hide
                      if (style.display === 'none') {
                        console.warn(`Field ${field.name} overlay hidden - no position or viewport`);
                        return null;
                      }

                      return (
                        <div
                          key={field.name}
                          ref={(el) => {
                            if (isHighlighted && el) {
                              setHighlightedFieldRef(el);
                            }
                          }}
                          style={{
                            ...style,
                            backgroundColor: isHighlighted
                              ? 'rgba(34, 197, 94, 0.5)' // Green for highlighted
                              : isHovered || isEditing 
                              ? 'rgba(59, 130, 246, 0.4)' 
                              : 'rgba(59, 130, 246, 0.2)',
                            border: isHighlighted
                              ? '3px solid #22c55e' // Green border for highlighted
                              : isHovered || isEditing 
                              ? '2px solid #3b82f6' 
                              : '2px dashed rgba(59, 130, 246, 0.8)',
                            pointerEvents: 'auto',
                            boxShadow: isHighlighted ? '0 0 20px rgba(34, 197, 94, 0.6)' : 'none',
                            zIndex: isHighlighted ? 20 : 10,
                          }}
                          onMouseEnter={() => setHoveredField(field.name)}
                          onMouseLeave={() => setHoveredField(null)}
                          onClick={(e) => handleFieldClick(field.name, e)}
                          className={`cursor-pointer transition-all ${isHighlighted ? 'animate-pulse' : ''}`}
                          title={field.label || field.name}
                        >
                          {isEditing && (
                            <div className="absolute -top-20 left-0 bg-gray-900 border border-gray-700 rounded-lg p-3 shadow-xl z-20 min-w-[250px]">
                              <div className="text-xs text-gray-400 mb-2">Edit field label</div>
                              <input
                                type="text"
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleSaveEdit();
                                  if (e.key === 'Escape') handleCancelEdit();
                                }}
                                onClick={(e) => e.stopPropagation()}
                                className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded text-white focus:outline-none focus:ring-2 focus:ring-primary mb-2"
                                autoFocus
                                placeholder="Enter label..."
                              />
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleSaveEdit();
                                  }}
                                  className="flex-1 px-3 py-1.5 bg-primary hover:bg-primary-hover text-white rounded text-sm font-medium transition-colors"
                                >
                                  Save
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleCancelEdit();
                                  }}
                                  className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white rounded text-sm transition-colors"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          )}
                          {(isHovered || isHighlighted) && !isEditing && (
                            <div className={`absolute -top-8 left-0 bg-gray-900 border ${isHighlighted ? 'border-green-500' : 'border-gray-700'} rounded px-2 py-1 text-xs text-white whitespace-nowrap shadow-lg z-20`}>
                              {field.label || field.name}
                              {isHighlighted && <span className="ml-2 text-green-400">●</span>}
                            </div>
                          )}
                        </div>
                      );
                    })}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
