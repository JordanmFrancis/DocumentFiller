import { NextRequest, NextResponse } from 'next/server';
import { fillPDF } from '@/lib/pdfFiller';

export async function POST(request: NextRequest) {
  try {
    // Note: In production, verify the auth token here
    // For now, we'll trust the client-side auth

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const formValuesJson = formData.get('formValues') as string;

    if (!file || !formValuesJson) {
      return NextResponse.json(
        { error: 'Missing file or form values' },
        { status: 400 }
      );
    }

    const formValues = JSON.parse(formValuesJson);
    const arrayBuffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);

    const filledPdfBytes = await fillPDF(uint8Array, formValues);

    // Convert to base64 for response
    const base64 = Buffer.from(filledPdfBytes).toString('base64');

    return NextResponse.json({
      pdf: base64,
    });
  } catch (error) {
    console.error('Error filling PDF:', error);
    return NextResponse.json(
      { error: 'Failed to fill PDF' },
      { status: 500 }
    );
  }
}
