import { PDFDocument, PDFField, PDFFieldType, PDFFieldPosition } from '@/types/pdf';

// Helper to extract object number from various pdf-lib object types
const getObjectNumber = (obj: any): number | undefined => {
  if (!obj) return undefined;
  
  // Direct objectNumber property
  if (typeof obj.objectNumber === 'number') {
    return obj.objectNumber;
  }
  
  // PDFRef has objectNumber
  if (obj.tag === 'Ref' && typeof obj.objectNumber === 'number') {
    return obj.objectNumber;
  }
  
  // Check for ref property
  if (obj.ref && typeof obj.ref.objectNumber === 'number') {
    return obj.ref.objectNumber;
  }
  
  return undefined;
};

// Helper to resolve a PDFArray or reference to an array
const resolveToArray = (obj: any, context: any): any[] => {
  if (!obj) return [];
  
  // If it's a reference, look it up first
  let resolved = obj;
  if (obj.tag === 'Ref' || (obj.objectNumber !== undefined && context)) {
    try {
      resolved = context.lookup(obj);
    } catch (e) {
      return [];
    }
  }
  
  // Now extract as array
  if (!resolved) return [];
  
  // Direct JavaScript array
  if (Array.isArray(resolved)) {
    return resolved;
  }
  
  // PDFArray - has asArray() method
  if (typeof resolved.asArray === 'function') {
    try {
      return resolved.asArray();
    } catch (e) {
      // Fall through to manual extraction
    }
  }
  
  // PDFArray - iterate using size() and get()
  if (typeof resolved.size === 'function') {
    const arr: any[] = [];
    const size = resolved.size();
    for (let i = 0; i < size; i++) {
      arr.push(resolved.get(i));
    }
    return arr;
  }
  
  // PDFArray - iterate using length and get()
  if (typeof resolved.length === 'number' && typeof resolved.get === 'function') {
    const arr: any[] = [];
    for (let i = 0; i < resolved.length; i++) {
      arr.push(resolved.get(i));
    }
    return arr;
  }
  
  return [];
};

// Build a map of widget reference strings to page indices
// This is the most reliable way to determine which page a field belongs to
const buildWidgetToPageMap = (pdfDoc: any): Map<string, number> => {
  const widgetToPage = new Map<string, number>();
  const pages = pdfDoc.getPages();
  const context = pdfDoc.context;
  
  console.log(`Building widget-to-page map for ${pages.length} pages...`);
  
  for (let pageIndex = 0; pageIndex < pages.length; pageIndex++) {
    try {
      const page = pages[pageIndex];
      const pageNode = (page as any).node;
      
      if (!pageNode) continue;
      
      // Method 1: Try Annots() as a method (pdf-lib's page node method)
      let annotsArray: any[] = [];
      
      if (typeof pageNode.Annots === 'function') {
        try {
          const annots = pageNode.Annots();
          if (annots) {
            annotsArray = resolveToArray(annots, context);
          }
        } catch (e) {
          // Continue to next method
        }
      }
      
      // Method 2: Try get with PDFName
      if (annotsArray.length === 0 && typeof pageNode.get === 'function') {
        try {
          // In pdf-lib, PDFName.of('Annots') creates the proper key
          const { PDFName } = require('pdf-lib');
          const annotsKey = PDFName.of('Annots');
          const annotsRef = pageNode.get(annotsKey);
          if (annotsRef) {
            annotsArray = resolveToArray(annotsRef, context);
          }
        } catch (e) {
          // Continue to next method
        }
      }
      
      // Method 3: Try lookupMaybe
      if (annotsArray.length === 0 && typeof pageNode.lookupMaybe === 'function') {
        try {
          const { PDFName, PDFArray } = require('pdf-lib');
          const annots = pageNode.lookupMaybe(PDFName.of('Annots'), PDFArray);
          if (annots) {
            annotsArray = resolveToArray(annots, context);
          }
        } catch (e) {
          // Continue to next method
        }
      }
      
      // Map each annotation to this page using its string representation
      let mappedCount = 0;
      for (const annot of annotsArray) {
        // Use toString() for consistent reference comparison
        if (annot) {
          // Primary: use ref.toString() if available
          if (annot.tag === 'Ref' || (typeof annot.objectNumber === 'number')) {
            const refStr = annot.toString();
            widgetToPage.set(refStr, pageIndex);
            mappedCount++;
            
            // Also store by object number for fallback matching
            const objNum = getObjectNumber(annot);
            if (objNum !== undefined) {
              widgetToPage.set(`objnum:${objNum}`, pageIndex);
            }
          }
        }
      }
      
      // Logged during development: Page ${pageIndex}: ${annotsArray.length} annotations, ${mappedCount} mapped
    } catch (e) {
      console.warn(`Error processing page ${pageIndex}:`, e);
    }
  }
  
  console.log(`Widget-to-page map built with ${widgetToPage.size} entries`);
  return widgetToPage;
};

// Convert field names to friendly labels
const generateFriendlyLabel = (fieldName: string): string => {
  // Try to extract tooltip/alternate name first (if available in PDF)
  // For now, we'll clean up the field name
  
  // Remove common prefixes/suffixes
  let label = fieldName
    .replace(/^(field|input|text|txt|fld)_?/i, '')
    .replace(/_?(\d+)$/, '') // Remove trailing numbers
    .trim();
  
  // Convert snake_case and camelCase to Title Case
  label = label
    .replace(/_/g, ' ') // Replace underscores with spaces
    .replace(/([a-z])([A-Z])/g, '$1 $2') // Add space before capital letters
    .replace(/\b\w/g, (char) => char.toUpperCase()) // Capitalize first letter of each word
    .trim();
  
  // If label is empty or too short, use original name
  if (!label || label.length < 2) {
    label = fieldName;
  }
  
  return label;
};

// Try to extract tooltip or alternate name from PDF field
const extractFieldLabel = (field: any): string | undefined => {
  try {
    // Try to get tooltip (TU - ToolTip)
    const tooltip = (field as any).getTooltip?.();
    if (tooltip && tooltip.trim()) {
      return tooltip.trim();
    }
    
    // Try to get alternate name (TU - Alternate Field Name)
    const altName = (field as any).getAlternateName?.();
    if (altName && altName.trim()) {
      return altName.trim();
    }
    
    // Try accessing internal PDF structure
    const acroField = (field as any).acroField;
    if (acroField) {
      const tu = acroField.dict.get('TU');
      if (tu && typeof tu === 'string' && tu.trim()) {
        return tu.trim();
      }
    }
  } catch (e) {
    // If extraction fails, return undefined to use generated label
  }
  return undefined;
};

// Extract field position from pdf-lib field
const extractFieldPosition = (field: any, pdfDoc: any): PDFFieldPosition | undefined => {
  try {
    const acroField = (field as any).acroField;
    if (!acroField) {
      // Try alternative access method
      const dict = (field as any).dict;
      if (!dict) return undefined;
      
      // Try to get widgets from dict directly
      const kids = dict.get('Kids');
      if (kids && kids.size() > 0) {
        const firstKid = kids.get(0);
        if (firstKid) {
          const rect = firstKid.get('Rect');
          if (rect) {
            const pages = pdfDoc.getPages();
            const page = pages[0]; // Default to first page
            const pageHeight = page.getHeight();
            
            return {
              x: rect.get(0) || 0,
              y: pageHeight - (rect.get(3) || 0), // Convert from bottom-left to top-left
              width: (rect.get(2) || 0) - (rect.get(0) || 0),
              height: (rect.get(3) || 0) - (rect.get(1) || 0),
              page: 0,
            };
          }
        }
      }
      return undefined;
    }

    // Method 1: Try getWidgets()
    try {
      const widgets = acroField.getWidgets();
      if (widgets && widgets.length > 0) {
        const widget = widgets[0];
        const rect = widget.getRectangle();
        const pageRef = widget.dict?.get('P') || widget.dict?.get('Parent')?.get('P');
        
        if (rect && pageRef) {
          const pages = pdfDoc.getPages();
          let pageNumber = 0;
          for (let i = 0; i < pages.length; i++) {
            if (pages[i].ref === pageRef || pages[i].ref?.toString() === pageRef?.toString()) {
              pageNumber = i;
              break;
            }
          }
          
          const page = pages[pageNumber] || pages[0];
          const pageHeight = page.getHeight();
          
          return {
            x: rect.x || 0,
            y: pageHeight - (rect.y + rect.height), // Convert to top-left origin
            width: rect.width || 100,
            height: rect.height || 20,
            page: pageNumber,
          };
        }
      }
    } catch (e) {
      // Continue to next method
    }

    // Method 2: Try accessing dict directly
    try {
      const dict = acroField.dict;
      if (dict) {
        // Try to get Rect from the field dict
        const rect = dict.get('Rect');
        if (rect && Array.isArray(rect) && rect.length >= 4) {
          const pages = pdfDoc.getPages();
          const page = pages[0];
          const pageHeight = page.getHeight();
          
          // Rect format: [x1, y1, x2, y2] (bottom-left and top-right corners)
          const x1 = rect[0];
          const y1 = rect[1];
          const x2 = rect[2];
          const y2 = rect[3];
          
          return {
            x: x1,
            y: pageHeight - y2, // Convert to top-left origin
            width: x2 - x1,
            height: y2 - y1,
            page: 0,
          };
        }
        
        // Try Kids array
        const kids = dict.get('Kids');
        if (kids) {
          const kidsArray = Array.isArray(kids) ? kids : (kids.toArray ? kids.toArray() : []);
          if (kidsArray.length > 0) {
            const firstKid = kidsArray[0];
            const kidDict = firstKid.dict || firstKid;
            const rect = kidDict.get('Rect');
            
            if (rect && Array.isArray(rect) && rect.length >= 4) {
              const pages = pdfDoc.getPages();
              const page = pages[0];
              const pageHeight = page.getHeight();
              
              const x1 = rect[0];
              const y1 = rect[1];
              const x2 = rect[2];
              const y2 = rect[3];
              
              // Get page reference
              let pageNumber = 0;
              const pageRef = kidDict.get('P') || kidDict.get('Parent')?.get('P');
              if (pageRef) {
                const pages = pdfDoc.getPages();
                for (let i = 0; i < pages.length; i++) {
                  if (pages[i].ref === pageRef || pages[i].ref?.toString() === pageRef?.toString()) {
                    pageNumber = i;
                    break;
                  }
                }
              }
              
              return {
                x: x1,
                y: pageHeight - y2,
                width: x2 - x1,
                height: y2 - y1,
                page: pageNumber,
              };
            }
          }
        }
      }
    } catch (e) {
      // Continue to next method
    }

    // Method 3: Try accessing internal structure
    try {
      const internalDict = (field as any).acroField?.dict;
      if (internalDict) {
        // Try to find any widget annotation
        const annots = internalDict.context?.lookup('Annots');
        if (annots) {
          const annotsArray = Array.isArray(annots) ? annots : (annots.toArray ? annots.toArray() : []);
          for (const annot of annotsArray) {
            const annotDict = annot.dict || annot;
            const rect = annotDict.get('Rect');
            if (rect && Array.isArray(rect) && rect.length >= 4) {
              const pages = pdfDoc.getPages();
              const page = pages[0];
              const pageHeight = page.getHeight();
              
              return {
                x: rect[0],
                y: pageHeight - rect[3],
                width: rect[2] - rect[0],
                height: rect[3] - rect[1],
                page: 0,
              };
            }
          }
        }
      }
    } catch (e) {
      // All methods failed
    }

    return undefined;
  } catch (e) {
    console.warn('Could not extract field position:', field.getName(), e);
    return undefined;
  }
};

export const detectPDFFields = async (pdfBytes: Uint8Array): Promise<PDFField[]> => {
  const { PDFDocument } = await import('pdf-lib');
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const form = pdfDoc.getForm();
  const pages = pdfDoc.getPages();
  
  const fields: PDFField[] = [];
  
  // Build widget-to-page map FIRST - this is the key to reliable page detection
  const widgetToPageMap = buildWidgetToPageMap(pdfDoc);
  
  // Get all form fields
  const pdfFields = form.getFields();
  
  console.log(`Processing ${pdfFields.length} form fields...`);
  
  pdfFields.forEach((field) => {
    const fieldName = field.getName();
    const fieldType = field.constructor.name;
    
    let type: PDFFieldType = 'text';
    let options: string[] | undefined;
    let defaultValue: string | boolean | undefined;
    
    // Determine field type and extract properties
    if (fieldType === 'PDFCheckBox') {
      type = 'checkbox';
      defaultValue = (field as any).isChecked();
    } else if (fieldType === 'PDFRadioGroup') {
      type = 'radio';
      const radioGroup = field as any;
      options = radioGroup.getOptions();
      defaultValue = radioGroup.getSelected()?.[0];
    } else if (fieldType === 'PDFDropdown') {
      type = 'dropdown';
      const dropdown = field as any;
      options = dropdown.getOptions();
      defaultValue = dropdown.getSelected()?.[0];
    } else if (fieldType === 'PDFTextField') {
      const textField = field as any;
      const textValue = textField.getText();
      if (textValue) {
        defaultValue = textValue;
      }
      // Check if it's a date field (simple heuristic)
      if (fieldName.toLowerCase().includes('date')) {
        type = 'date';
      } else if (fieldName.toLowerCase().includes('number') || fieldName.toLowerCase().includes('amount')) {
        type = 'number';
      }
    }
    
    // Try to extract label from PDF, otherwise generate friendly label
    const extractedLabel = extractFieldLabel(field);
    const label = extractedLabel || generateFriendlyLabel(fieldName);
    
    // Extract field position using the widget-to-page map
    let position: PDFFieldPosition | undefined;
    
    try {
      const acroField = (field as any).acroField;
      if (acroField) {
        const widgets = acroField.getWidgets();
        if (widgets && widgets.length > 0) {
          const widget = widgets[0];
          const rect = widget.getRectangle();
          
          // Get the widget's reference to look up in our map
          let pageIndex = 0;
          let foundPage = false;
          
          const widgetRef = (widget as any).ref;
          
          // Method 1: Try widget.ref.toString()
          if (widgetRef && typeof widgetRef.toString === 'function') {
            const refStr = widgetRef.toString();
            const mappedPage = widgetToPageMap.get(refStr);
            if (mappedPage !== undefined) {
              pageIndex = mappedPage;
              foundPage = true;
            }
          }
          
          // Method 2: Try by object number string
          if (!foundPage) {
            const objNum = getObjectNumber(widgetRef) || getObjectNumber(widget) || getObjectNumber((widget as any).dict);
            if (objNum !== undefined) {
              const mappedPage = widgetToPageMap.get(`objnum:${objNum}`);
              if (mappedPage !== undefined) {
                pageIndex = mappedPage;
                foundPage = true;
              }
            }
          }
          
          // Method 3: Check P (parent page) reference in widget dict directly
          if (!foundPage) {
            const widgetDict = (widget as any).dict;
            if (widgetDict && typeof widgetDict.get === 'function') {
              try {
                const { PDFName } = require('pdf-lib');
                let pageRef = widgetDict.get(PDFName.of('P'));
                
                if (pageRef) {
                  const pageRefObjNum = getObjectNumber(pageRef);
                  if (pageRefObjNum !== undefined) {
                    // Find which page has this object number
                    for (let i = 0; i < pages.length; i++) {
                      const pageNode = (pages[i] as any).node;
                      const pageRef2 = pages[i].ref;
                      
                      const pageNodeObjNum = getObjectNumber(pageNode);
                      const pageRefNum = getObjectNumber(pageRef2);
                      
                      if (pageNodeObjNum === pageRefObjNum || pageRefNum === pageRefObjNum) {
                        pageIndex = i;
                        foundPage = true;
                        break;
                      }
                    }
                  }
                }
              } catch (e) { /* ignore */ }
            }
          }
          
          // Method 4: Brute force - search all pages for this widget
          if (!foundPage) {
            const widgetRef2 = (widget as any).ref;
            const widgetRefStr = widgetRef2?.toString?.();
            const widgetObjNum = getObjectNumber(widgetRef2) || getObjectNumber(widget);
            
            for (let i = 0; i < pages.length && !foundPage; i++) {
              try {
                const pageNode = (pages[i] as any).node;
                if (!pageNode) continue;
                
                let annots: any[] = [];
                
                // Try different methods to get annotations
                if (typeof pageNode.Annots === 'function') {
                  const annotsResult = pageNode.Annots();
                  if (annotsResult) {
                    annots = resolveToArray(annotsResult, pdfDoc.context);
                  }
                }
                
                if (annots.length === 0 && typeof pageNode.lookupMaybe === 'function') {
                  const { PDFName, PDFArray } = require('pdf-lib');
                  const annotsResult = pageNode.lookupMaybe(PDFName.of('Annots'), PDFArray);
                  if (annotsResult) {
                    annots = resolveToArray(annotsResult, pdfDoc.context);
                  }
                }
                
                for (const annot of annots) {
                  const annotRefStr = annot?.toString?.();
                  const annotObjNum = getObjectNumber(annot);
                  
                  if ((widgetRefStr && annotRefStr === widgetRefStr) || 
                      (widgetObjNum !== undefined && annotObjNum === widgetObjNum)) {
                    pageIndex = i;
                    foundPage = true;
                    break;
                  }
                }
              } catch (e) {
                // Continue to next page
              }
            }
          }
          
          if (!foundPage) {
            console.warn(`⚠ Could not determine page for "${fieldName}", defaulting to page 0`);
          }
          
          const page = pages[pageIndex] || pages[0];
          const pageHeight = page.getHeight();
          
          position = {
            x: rect.x,
            y: pageHeight - (rect.y + rect.height),
            width: rect.width,
            height: rect.height,
            page: pageIndex,
          };
        }
      }
    } catch (e) {
      console.warn(`Error extracting position for "${fieldName}":`, e);
      position = extractFieldPosition(field, pdfDoc);
    }
    
    const fieldData: PDFField = {
      name: fieldName,
      label,
      type,
      page: position?.page,
      position,
    };
    
    // Only add optional fields if they have values
    if (defaultValue !== undefined && defaultValue !== null && defaultValue !== '') {
      fieldData.defaultValue = defaultValue;
    }
    if (options && options.length > 0) {
      fieldData.options = options;
    }
    const isRequired = (field as any).isRequired?.();
    if (isRequired !== undefined) {
      fieldData.required = isRequired;
    }
    
    fields.push(fieldData);
  });
  
  // Log page distribution summary
  const pageDistribution: Record<number, number> = {};
  fields.forEach(f => {
    const page = f.position?.page ?? -1;
    pageDistribution[page] = (pageDistribution[page] || 0) + 1;
  });
  console.log('=== FIELD DETECTION SUMMARY ===');
  console.log(`Total fields detected: ${fields.length}`);
  console.log('Fields by page (0-based):', pageDistribution);
  if (Object.keys(pageDistribution).length === 1 && pageDistribution[0]) {
    console.warn('⚠ All fields on page 0 - page detection may have failed');
  }
  console.log('===============================');
  
  return fields;
};
