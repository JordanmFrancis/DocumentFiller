import type { Rule, ChatMessage } from './rule';

export type PDFFieldType = 'text' | 'checkbox' | 'radio' | 'dropdown' | 'date' | 'number';

export interface PDFFieldPosition {
  x: number;
  y: number;
  width: number;
  height: number;
  page: number;
}

export interface PDFField {
  name: string; // Internal PDF field name (used for filling)
  label?: string; // User-friendly display label
  type: PDFFieldType;
  value?: string | boolean | number;
  defaultValue?: string | boolean | number;
  required?: boolean;
  options?: string[]; // For radio and dropdown
  page?: number;
  position?: PDFFieldPosition; // Field position on the page
}

export interface PDFDocument {
  id: string;
  name: string;
  originalPdfUrl: string;
  fieldDefinitions: PDFField[];
  defaultValues?: Record<string, string | boolean | number>;
  rules?: Rule[];                 // NEW — ordered; index = firing priority
  chatHistory?: ChatMessage[];    // NEW — bounded to last 50 turns
  createdAt: Date;
  updatedAt: Date;
  filledPdfs?: FilledPDF[];
}

export interface FilledPDF {
  id: string;
  downloadUrl: string;
  createdAt: Date;
  formValues: Record<string, any>;
}

export interface FormValues {
  [fieldName: string]: string | boolean | number;
}
