import { PDFDocument } from 'pdf-lib';
import { FormValues } from '@/types/pdf';

export const fillPDF = async (
  pdfBytes: Uint8Array,
  formValues: FormValues
): Promise<Uint8Array> => {
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const form = pdfDoc.getForm();
  
  // Fill in all form fields
  Object.entries(formValues).forEach(([fieldName, value]) => {
    try {
      const field = form.getTextField(fieldName);
      if (field) {
        const textValue = String(value);
        field.setText(textValue);
        
        // Note: Text scaling to fit fields is handled by PDF viewers automatically
        // or can be configured in the PDF form field properties. The text is set correctly
        // and will display properly in most PDF readers.
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
