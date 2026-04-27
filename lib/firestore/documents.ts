import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  updateDoc,
  query,
  where,
  orderBy,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { PDFDocument, PDFField } from '@/types/pdf';

const DOCUMENTS_COLLECTION = 'documents';

export interface DocumentData {
  name: string;
  originalPdfUrl: string;
  fieldDefinitions: PDFField[];
  defaultValues?: Record<string, string | boolean | number>;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  userId: string;
  filledPdfs?: Array<{
    id: string;
    downloadUrl: string;
    createdAt: Timestamp;
    formValues: Record<string, any>;
  }>;
}

// Helper function to remove undefined values from an object
const removeUndefined = (obj: any): any => {
  if (obj === null || obj === undefined) {
    return null;
  }
  if (Array.isArray(obj)) {
    return obj.map(removeUndefined).filter(item => item !== undefined);
  }
  if (typeof obj === 'object') {
    const cleaned: any = {};
    for (const key in obj) {
      if (obj[key] !== undefined) {
        cleaned[key] = removeUndefined(obj[key]);
      }
    }
    return cleaned;
  }
  return obj;
};

export const saveDocument = async (
  userId: string,
  documentId: string,
  data: Omit<DocumentData, 'userId' | 'createdAt' | 'updatedAt'>
): Promise<void> => {
  const docRef = doc(db, DOCUMENTS_COLLECTION, documentId);
  
  // Clean the data to remove undefined values
  const cleanedData = removeUndefined({
    ...data,
    userId,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });
  
  await setDoc(docRef, cleanedData);
};

export const getUserDocuments = async (userId: string): Promise<PDFDocument[]> => {
  const q = query(
    collection(db, DOCUMENTS_COLLECTION),
    where('userId', '==', userId),
    orderBy('updatedAt', 'desc')
  );
  
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      ...data,
      createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt),
      updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : new Date(data.updatedAt),
    };
  }) as PDFDocument[];
};

export const getDocument = async (documentId: string): Promise<PDFDocument | null> => {
  const docRef = doc(db, DOCUMENTS_COLLECTION, documentId);
  const docSnap = await getDoc(docRef);
  
  if (!docSnap.exists()) {
    return null;
  }
  
  const data = docSnap.data();
  return {
    id: docSnap.id,
    ...data,
    createdAt: data.createdAt.toDate(),
    updatedAt: data.updatedAt.toDate(),
  } as PDFDocument;
};

export const updateDocument = async (
  documentId: string,
  updates: Partial<DocumentData>
): Promise<void> => {
  const docRef = doc(db, DOCUMENTS_COLLECTION, documentId);
  await updateDoc(docRef, {
    ...updates,
    updatedAt: Timestamp.now(),
  });
};

export const deleteDocument = async (documentId: string): Promise<void> => {
  const docRef = doc(db, DOCUMENTS_COLLECTION, documentId);
  await deleteDoc(docRef);
};

export const addFilledPDF = async (
  documentId: string,
  filledPdf: {
    id: string;
    downloadUrl: string;
    formValues: Record<string, any>;
  }
): Promise<void> => {
  const docRef = doc(db, DOCUMENTS_COLLECTION, documentId);
  const docSnap = await getDoc(docRef);
  
  if (!docSnap.exists()) {
    throw new Error('Document not found');
  }
  
  const currentData = docSnap.data();
  const filledPdfs = currentData.filledPdfs || [];
  
  await updateDoc(docRef, {
    filledPdfs: [
      ...filledPdfs,
      {
        ...filledPdf,
        createdAt: Timestamp.now(),
      },
    ],
  });
};

/**
 * Drops entries from a defaults map whose field no longer exists.
 * Use whenever fieldDefinitions is replaced wholesale (e.g. via the
 * field creator or visual editor).
 */
export function pruneDefaults(
  fields: PDFField[],
  defaults: Record<string, string | boolean | number> | undefined
): Record<string, string | boolean | number> {
  if (!defaults) return {};
  const validNames = new Set(fields.map((f) => f.name));
  return Object.fromEntries(
    Object.entries(defaults).filter(([name]) => validNames.has(name))
  );
}
