import { NextRequest, NextResponse } from 'next/server';
import { PDFDocument } from 'pdf-lib';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const fieldsJson = formData.get('fields') as string;

    if (!file || !fieldsJson) {
      return NextResponse.json(
        { error: 'Missing file or fields data' },
        { status: 400 }
      );
    }

    const fields = JSON.parse(fieldsJson);
    const arrayBuffer = await file.arrayBuffer();
    const pdfBytes = new Uint8Array(arrayBuffer);

    // Load PDF
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const form = pdfDoc.getForm();
    const pages = pdfDoc.getPages();

    // Add each field to the PDF
    for (const field of fields) {
      const { type, name, label, position, options, defaultValue, required } = field;
      
      if (!position || position.page === undefined) {
        console.warn(`Skipping field ${name} - missing position`);
        continue;
      }

      const page = pages[position.page];
      if (!page) {
        console.warn(`Skipping field ${name} - invalid page ${position.page}`);
        continue;
      }

      const pageHeight = page.getHeight();
      
      // Convert from top-left origin (our system) to bottom-left origin (PDF)
      // Our position.y is from top, PDF expects from bottom
      const pdfY = pageHeight - (position.y + position.height);
      const pdfX = position.x;

      try {
        switch (type) {
          case 'text': {
            const textField = form.createTextField(name);
            textField.addToPage(page, {
              x: pdfX,
              y: pdfY,
              width: position.width,
              height: position.height,
            });
            
            if (defaultValue !== undefined && defaultValue !== null && defaultValue !== '') {
              textField.setText(String(defaultValue));
            }
            
            if (required) {
              textField.enableRequired();
            }
            break;
          }

          case 'checkbox': {
            const checkbox = form.createCheckBox(name);
            checkbox.addToPage(page, {
              x: pdfX,
              y: pdfY,
              width: position.width,
              height: position.height,
            });
            
            if (defaultValue === true || defaultValue === 'true' || defaultValue === 1) {
              checkbox.check();
            }
            
            if (required) {
              checkbox.enableRequired();
            }
            break;
          }

          case 'radio': {
            // For radio buttons, we need to create a radio group
            // Each option is a separate widget on the page
            let radioGroup;
            try {
              radioGroup = form.getRadioGroup(name);
            } catch {
              radioGroup = form.createRadioGroup(name);
            }
            
            if (options && options.length > 0) {
              // Add each option as a radio button
              // Place them vertically with spacing
              const optionHeight = Math.max(15, position.height / Math.max(1, options.length));
              const spacing = 5; // Space between options
              options.forEach((option: string, index: number) => {
                radioGroup.addOptionToPage(option, page, {
                  x: pdfX,
                  y: pdfY + (options.length - index - 1) * (optionHeight + spacing),
                  width: position.width,
                  height: optionHeight,
                });
              });
              
              if (defaultValue) {
                radioGroup.select(String(defaultValue));
              }
            } else {
              // Single radio button
              radioGroup.addOptionToPage('option1', page, {
                x: pdfX,
                y: pdfY,
                width: position.width,
                height: position.height,
              });
            }
            
            if (required) {
              radioGroup.enableRequired();
            }
            break;
          }

          case 'dropdown': {
            const dropdown = form.createDropdown(name);
            dropdown.addToPage(page, {
              x: pdfX,
              y: pdfY,
              width: position.width,
              height: position.height,
            });
            
            if (options && options.length > 0) {
              dropdown.setOptions(options);
              if (defaultValue) {
                dropdown.select(String(defaultValue));
              }
            }
            
            if (required) {
              dropdown.enableRequired();
            }
            break;
          }

          case 'date': {
            // Date fields are text fields with special formatting
            const dateField = form.createTextField(name);
            dateField.addToPage(page, {
              x: pdfX,
              y: pdfY,
              width: position.width,
              height: position.height,
            });
            
            if (required) {
              dateField.enableRequired();
            }
            break;
          }

          case 'number': {
            // Number fields are text fields with numeric validation
            const numberField = form.createTextField(name);
            numberField.addToPage(page, {
              x: pdfX,
              y: pdfY,
              width: position.width,
              height: position.height,
            });
            
            if (defaultValue !== undefined && defaultValue !== null && defaultValue !== '') {
              numberField.setText(String(defaultValue));
            }
            
            if (required) {
              numberField.enableRequired();
            }
            break;
          }

          default:
            console.warn(`Unknown field type: ${type}`);
        }
      } catch (error) {
        console.error(`Error adding field ${name} (${type}):`, error);
        // Continue with other fields
      }
    }

    // Save PDF
    const modifiedPdfBytes = await pdfDoc.save();

    // Convert Uint8Array to ArrayBuffer for NextResponse
    const responseArrayBuffer = modifiedPdfBytes.buffer.slice(
      modifiedPdfBytes.byteOffset,
      modifiedPdfBytes.byteOffset + modifiedPdfBytes.byteLength
    );

    // Return the modified PDF
    return new NextResponse(responseArrayBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="document-with-fields.pdf"',
      },
    });
  } catch (error) {
    console.error('Error adding fields to PDF:', error);
    return NextResponse.json(
      { error: 'Failed to add fields to PDF', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
