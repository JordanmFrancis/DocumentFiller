import { PDFDocument, PDFFont, rgb, StandardFonts } from 'pdf-lib';
import { FormValues } from '@/types/pdf';

// Estimate text width in points using font metrics
// Uses a more accurate estimate based on character widths
const estimateTextWidth = (text: string, fontSize: number, font: PDFFont): number => {
  if (!text || text.length === 0) return 0;
  
  try {
    // Use pdf-lib's font width calculation if available
    // For Helvetica, average character width is approximately 0.5-0.6 * fontSize
    // We'll use a conservative estimate of 0.55
    let totalWidth = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      // Get character width from font (in 1000 units, convert to points)
      try {
        const width = font.widthOfTextAtSize(char, fontSize);
        totalWidth += width;
      } catch {
        // Fallback: use average width
        totalWidth += fontSize * 0.55;
      }
    }
    return totalWidth;
  } catch {
    // Fallback: simple estimation
    return text.length * fontSize * 0.55;
  }
};

// Calculate appropriate font size to fit text within field width
const calculateFontSize = (
  text: string, 
  fieldWidth: number, 
  font: PDFFont,
  minFontSize: number = 6, 
  maxFontSize: number = 12
): number => {
  if (!text || text.length === 0 || fieldWidth <= 0) return maxFontSize;
  
  // Start with max font size and reduce if needed
  let fontSize = maxFontSize;
  let textWidth = estimateTextWidth(text, fontSize, font);
  
  // Reduce font size until text fits (with some padding)
  const padding = 4; // 4 points padding total (2 on each side)
  const availableWidth = fieldWidth - padding;
  
  // Binary search for optimal font size (more efficient)
  let minSize = minFontSize;
  let maxSize = maxFontSize;
  let bestSize = maxSize;
  
  // If text already fits, use max size
  if (textWidth <= availableWidth) {
    return maxSize;
  }
  
  // Binary search for the largest font size that fits
  while (maxSize - minSize > 0.1) {
    fontSize = (minSize + maxSize) / 2;
    textWidth = estimateTextWidth(text, fontSize, font);
    
    if (textWidth <= availableWidth) {
      bestSize = fontSize;
      minSize = fontSize;
    } else {
      maxSize = fontSize;
    }
  }
  
  return Math.max(minFontSize, Math.min(maxFontSize, bestSize));
};

export const fillPDF = async (
  pdfBytes: Uint8Array,
  formValues: FormValues
): Promise<Uint8Array> => {
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const form = pdfDoc.getForm();
  
  // Get a standard font for text rendering
  const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  
  // Fill in all form fields
  Object.entries(formValues).forEach(([fieldName, value]) => {
    try {
      const field = form.getTextField(fieldName);
      if (field) {
        const textValue = String(value);
        field.setText(textValue);
        
        // Get field widgets to access their rectangles and update appearance with scaled font
        try {
          const widgets = field.acroField.getWidgets();
          if (widgets && widgets.length > 0) {
            // Get the first widget's rectangle to determine field width
            const widget = widgets[0];
            const rect = widget.getRectangle();
            
            if (rect && rect.width > 0 && textValue.length > 0) {
              // Calculate appropriate font size to fit text
              const calculatedFontSize = calculateFontSize(textValue, rect.width, helveticaFont);
              
              // Update widget appearance with scaled font for each widget
              // (field can appear on multiple pages or locations)
              widgets.forEach((widget) => {
                try {
                  const page = widget.getPage();
                  if (page) {
                    field.updateWidgetAppearances(page, {
                      text: textValue,
                      backgroundColor: rgb(1, 1, 1),
                      borderColor: rgb(0, 0, 0),
                      borderWidth: 1,
                      font: helveticaFont,
                      fontSize: calculatedFontSize,
                    });
                  }
                } catch (widgetError) {
                  // Continue with other widgets if one fails
                  console.warn(`Could not update widget appearance for field ${fieldName}:`, widgetError);
                }
              });
            } else {
              // Field has no width or empty text, use default appearance
              widgets.forEach((widget) => {
                try {
                  const page = widget.getPage();
                  if (page) {
                    field.updateWidgetAppearances(page, {
                      text: textValue,
                      backgroundColor: rgb(1, 1, 1),
                      borderColor: rgb(0, 0, 0),
                      borderWidth: 1,
                    });
                  }
                } catch (widgetError) {
                  // Ignore individual widget errors
                }
              });
            }
          }
        } catch (appearanceError) {
          // If appearance update fails, the text is still set via setText()
          // It just might not fit perfectly or use the default font size
          console.warn(`Could not update appearance for field ${fieldName}:`, appearanceError);
        }
      }
    } catch (e) {
      // Try checkbox
      try {
        const field = form.getCheckBox(fieldName);
        if (field) {
          if (value === true || value === 'true' || value === '1') {
            field.check();
          } else {
            field.uncheck();
          }
        }
      } catch (e2) {
        // Try radio or dropdown
        try {
          const field = form.getDropdown(fieldName);
          if (field) {
            field.select(String(value));
          }
        } catch (e3) {
          try {
            const field = form.getRadioGroup(fieldName);
            if (field) {
              field.select(String(value));
            }
          } catch (e4) {
            // Field not found or not fillable, skip
            console.warn(`Could not fill field: ${fieldName}`);
          }
        }
      }
    }
  });
  
  // Flatten form to prevent further editing (optional)
  form.flatten();
  
  // Generate PDF bytes
  const pdfBytesFilled = await pdfDoc.save();
  return pdfBytesFilled;
};
