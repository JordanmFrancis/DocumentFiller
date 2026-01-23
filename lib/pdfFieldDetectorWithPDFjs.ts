import { PDFField } from '@/types/pdf';

// This function name is kept for compatibility, but it just uses pdf-lib
// PDF.js has compatibility issues with Next.js, so we use pdf-lib instead
export const detectPDFFieldsWithPDFjs = async (pdfBytes: Uint8Array): Promise<PDFField[]> => {
  // Use pdf-lib for field detection - it's more reliable
  const { detectPDFFields } = await import('./pdfFieldDetector');
  return detectPDFFields(pdfBytes);
};
