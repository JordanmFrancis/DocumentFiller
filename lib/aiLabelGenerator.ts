import { PDFField } from '@/types/pdf';

/**
 * Extract text context around a field from PDF using pdfjs-dist
 * This helps the AI understand what the field is for
 */
export async function extractFieldContext(
  pdfBytes: Uint8Array,
  field: PDFField
): Promise<string> {
  try {
    // Dynamically import pdfjs-dist
    const pdfjsLib = await import('pdfjs-dist');
    
    // Set worker - for server-side Next.js, we can use the node worker
    try {
      // Try to use node worker (for server-side)
      const workerPath = require.resolve('pdfjs-dist/build/pdf.worker.min.mjs');
      pdfjsLib.GlobalWorkerOptions.workerSrc = workerPath;
    } catch (e) {
      // Fallback to CDN worker (for client-side or if node worker not available)
      pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.worker.min.mjs`;
    }
    
    // Load PDF
    const loadingTask = pdfjsLib.getDocument({ data: pdfBytes });
    const pdf = await loadingTask.promise;
    
    if (!field.position || field.position.page === undefined) {
      return '';
    }
    
    const pageNum = field.position.page + 1; // pdfjs uses 1-based indexing
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();
    
    // Get page dimensions
    const viewport = page.getViewport({ scale: 1.0 });
    const pageHeight = viewport.height;
    
    // Field position in PDF coordinates (we have top-left origin)
    const fieldX = field.position.x;
    const fieldY = field.position.y;
    const fieldWidth = field.position.width;
    const fieldHeight = field.position.height;
    
    // Collect text items near the field
    // Look for text within a reasonable distance (e.g., 50 points above/below, 100 points left/right)
    const contextRadius = 50;
    const nearbyText: Array<{ text: string; y: number; x: number }> = [];
    
    for (const item of textContent.items) {
      if ('str' in item && item.str.trim()) {
        // Transform coordinates - pdfjs uses bottom-left origin
        const itemY = pageHeight - (item.transform[5] || 0);
        const itemX = item.transform[4] || 0;
        
        // Check if text is near the field
        const isNearby = 
          itemY >= fieldY - contextRadius &&
          itemY <= fieldY + fieldHeight + contextRadius &&
          itemX >= fieldX - 100 &&
          itemX <= fieldX + fieldWidth + 100;
        
        if (isNearby) {
          nearbyText.push({
            text: item.str.trim(),
            y: itemY,
            x: itemX,
          });
        }
      }
    }
    
    // Sort by Y (top to bottom), then X (left to right)
    nearbyText.sort((a, b) => {
      if (Math.abs(a.y - b.y) > 5) return a.y - b.y;
      return a.x - b.x;
    });
    
    // Build context string
    const contextLines: string[] = [];
    let currentLine = '';
    let lastY = -1;
    
    for (const item of nearbyText) {
      if (lastY === -1 || Math.abs(item.y - lastY) > 5) {
        // New line
        if (currentLine) {
          contextLines.push(currentLine.trim());
        }
        currentLine = item.text;
        lastY = item.y;
      } else {
        // Same line, append
        currentLine += ' ' + item.text;
      }
    }
    if (currentLine) {
      contextLines.push(currentLine.trim());
    }
    
    return contextLines.join('\n');
  } catch (error) {
    console.warn(`Error extracting context for field ${field.name}:`, error);
    return '';
  }
}

/**
 * Orchestrates the AI relabeling flow: gather per-field text context, call
 * OpenAI with batched prompts, return fields with the generated labels
 * merged onto them.
 *
 * Pass `preBuiltContexts` to skip server-side extraction (recommended:
 * extract on the client where pdf.js is reliable, post the map up). When
 * absent, falls back to server-side `extractFieldContext` which depends on
 * pdfjs-dist resolving its worker — fragile on Vercel serverless.
 *
 * Reads OPENAI_API_KEY from the environment. If unset, logs a warning and
 * returns the input fields unchanged. Any error during extraction or the
 * OpenAI call is logged and the original fields are returned — callers can
 * treat this as a best-effort enhancement that never throws.
 */
export async function relabelFieldsWithAI(
  pdfBytes: Uint8Array,
  fields: PDFField[],
  preBuiltContexts?: Map<string, string>
): Promise<PDFField[]> {
  const openaiApiKey = process.env.OPENAI_API_KEY;
  if (!openaiApiKey) {
    console.warn('OPENAI_API_KEY not set, skipping AI label generation');
    return fields;
  }
  if (fields.length === 0) return fields;

  try {
    let contextMap: Map<string, string>;
    if (preBuiltContexts) {
      contextMap = preBuiltContexts;
    } else {
      contextMap = new Map<string, string>();
      const batchSize = 5;
      for (let i = 0; i < fields.length; i += batchSize) {
        const batch = fields.slice(i, i + batchSize);
        await Promise.all(
          batch.map(async (field) => {
            const context = await extractFieldContext(pdfBytes, field);
            contextMap.set(field.name, context);
          })
        );
      }
    }

    const aiLabels = await generateAILabels(fields, contextMap, openaiApiKey);
    console.log(
      `Generated ${aiLabels.size} AI labels out of ${fields.length} fields`,
      preBuiltContexts ? '(client-supplied contexts)' : '(server-extracted contexts)'
    );

    return fields.map((field) => {
      const aiLabel = aiLabels.get(field.name);
      return aiLabel ? { ...field, label: aiLabel } : field;
    });
  } catch (error) {
    console.error('Error generating AI labels:', error);
    return fields;
  }
}

/**
 * Generate better labels for fields using OpenAI
 */
export async function generateAILabels(
  fields: PDFField[],
  contextMap: Map<string, string>,
  apiKey: string
): Promise<Map<string, string>> {
  const labelMap = new Map<string, string>();
  
  // Group fields into batches to reduce API calls
  const batchSize = 10;
  for (let i = 0; i < fields.length; i += batchSize) {
    const batch = fields.slice(i, i + batchSize);
    
    // Build prompt for this batch
    const fieldDescriptions = batch.map((field, idx) => {
      const context = contextMap.get(field.name) || '';
      return `${idx + 1}. Field name: "${field.name}"
   Type: ${field.type}
   Context around field: ${context || '(no context available)'}
   Current label: "${field.label || field.name}"`;
    }).join('\n\n');
    
    const prompt = `You are analyzing a PDF form. For each field below, generate a clear, concise, user-friendly label based on:
1. The field's internal name
2. The text context around the field in the PDF
3. The field type

Return ONLY a JSON object mapping field numbers to labels, like:
{"1": "Purchase Price", "2": "Buyer Name", ...}

Fields:
${fieldDescriptions}

Return JSON only, no other text:`;

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini', // Cost-effective model
          messages: [
            {
              role: 'system',
              content: 'You are a helpful assistant that generates clear, concise labels for PDF form fields. Always return valid JSON only.',
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          temperature: 0.3,
          max_tokens: 500,
        }),
      });
      
      if (!response.ok) {
        const error = await response.text();
        console.error('OpenAI API error:', error);
        continue;
      }
      
      const data = await response.json();
      const content = data.choices[0]?.message?.content?.trim();
      
      if (!content) continue;
      
      // Parse JSON response
      let labels: Record<string, string>;
      try {
        // Remove markdown code blocks if present
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        const jsonStr = jsonMatch ? jsonMatch[0] : content;
        labels = JSON.parse(jsonStr);
      } catch (e) {
        console.warn('Failed to parse AI response:', content);
        continue;
      }
      
      // Map labels back to field names
      batch.forEach((field, idx) => {
        const label = labels[String(idx + 1)];
        if (label && typeof label === 'string' && label.trim()) {
          labelMap.set(field.name, label.trim());
        }
      });
    } catch (error) {
      console.error('Error generating AI labels for batch:', error);
    }
  }
  
  return labelMap;
}
