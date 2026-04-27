import { NextRequest, NextResponse } from 'next/server';
import { detectPDFFields } from '@/lib/pdfFieldDetector';
import { relabelFieldsWithAI } from '@/lib/aiLabelGenerator';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const useAI = formData.get('useAI') === 'true';

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }
    if (file.type !== 'application/pdf') {
      return NextResponse.json({ error: 'File must be a PDF' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);

    let fields = await detectPDFFields(uint8Array);
    if (useAI) {
      fields = await relabelFieldsWithAI(uint8Array, fields);
    }

    return NextResponse.json({ fields });
  } catch (error) {
    console.error('Error detecting fields:', error);
    return NextResponse.json(
      { error: 'Failed to detect fields' },
      { status: 500 }
    );
  }
}
