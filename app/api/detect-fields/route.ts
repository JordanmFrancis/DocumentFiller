import { NextRequest, NextResponse } from 'next/server';
import { detectPDFFields } from '@/lib/pdfFieldDetector';
import { extractFieldContext, generateAILabels } from '@/lib/aiLabelGenerator';
import { PDFField } from '@/types/pdf';

export async function POST(request: NextRequest) {
  try {
    // Note: In production, verify the auth token here
    // For now, we'll trust the client-side auth

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const useAI = formData.get('useAI') === 'true'; // Optional flag to enable AI label generation

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (file.type !== 'application/pdf') {
      return NextResponse.json({ error: 'File must be a PDF' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);

    // Detect fields
    let fields = await detectPDFFields(uint8Array);

    // Optionally generate AI labels
    if (useAI) {
      const openaiApiKey = process.env.OPENAI_API_KEY;
      
      if (!openaiApiKey) {
        console.warn('OPENAI_API_KEY not set, skipping AI label generation');
      } else {
        try {
          // Extract context for each field
          console.log('Extracting context for fields...');
          const contextMap = new Map<string, string>();
          
          // Process fields in parallel (but limit concurrency)
          const batchSize = 5;
          for (let i = 0; i < fields.length; i += batchSize) {
            const batch = fields.slice(i, i + batchSize);
            await Promise.all(
              batch.map(async (field) => {
                const context = await extractFieldContext(uint8Array, field);
                contextMap.set(field.name, context);
              })
            );
          }
          
          // Generate AI labels
          console.log('Generating AI labels...');
          const aiLabels = await generateAILabels(fields, contextMap, openaiApiKey);
          
          // Update field labels
          fields = fields.map((field) => {
            const aiLabel = aiLabels.get(field.name);
            if (aiLabel) {
              return { ...field, label: aiLabel };
            }
            return field;
          });
          
          console.log(`Generated ${aiLabels.size} AI labels out of ${fields.length} fields`);
        } catch (error) {
          console.error('Error generating AI labels:', error);
          // Continue with original labels if AI fails
        }
      }
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
