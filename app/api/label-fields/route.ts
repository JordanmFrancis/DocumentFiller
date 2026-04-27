import { NextRequest, NextResponse } from 'next/server';
import { relabelFieldsWithAI } from '@/lib/aiLabelGenerator';
import { PDFField } from '@/types/pdf';

// Relabels an existing set of fields using AI, given the source PDF for
// context extraction. Used by the client when Tier 2 (vector) or Tier 3
// (AI vision) detection produces fields without meaningful labels.
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const fieldsJson = formData.get('fields') as string;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }
    if (file.type !== 'application/pdf') {
      return NextResponse.json({ error: 'File must be a PDF' }, { status: 400 });
    }
    if (!fieldsJson) {
      return NextResponse.json({ error: 'No fields provided' }, { status: 400 });
    }

    let fields: PDFField[];
    try {
      fields = JSON.parse(fieldsJson) as PDFField[];
    } catch {
      return NextResponse.json({ error: 'Invalid fields JSON' }, { status: 400 });
    }

    // Optional pre-extracted contexts. When present, the route skips the
    // fragile server-side pdfjs path entirely and just calls OpenAI.
    const contextsJson = formData.get('contexts') as string | null;
    let preBuiltContexts: Map<string, string> | undefined;
    if (contextsJson) {
      try {
        const obj = JSON.parse(contextsJson) as Record<string, string>;
        preBuiltContexts = new Map(Object.entries(obj));
      } catch {
        console.warn('Invalid contexts JSON; ignoring and falling back to server extraction');
      }
    }

    const arrayBuffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);

    const relabeled = await relabelFieldsWithAI(uint8Array, fields, preBuiltContexts);
    return NextResponse.json({ fields: relabeled });
  } catch (error) {
    console.error('Error labeling fields:', error);
    return NextResponse.json({ error: 'Failed to label fields' }, { status: 500 });
  }
}
