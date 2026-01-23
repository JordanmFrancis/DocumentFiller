import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage } from '../firebase/config';

export const uploadPDF = async (
  file: File | Blob,
  path: string
): Promise<string> => {
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, file);
  return getDownloadURL(storageRef);
};

export const deletePDF = async (path: string): Promise<void> => {
  const storageRef = ref(storage, path);
  await deleteObject(storageRef);
};

export const getPDFUrl = async (path: string): Promise<string> => {
  const storageRef = ref(storage, path);
  return getDownloadURL(storageRef);
};

export const downloadPDF = async (pdfPath: string): Promise<Blob> => {
  const fileRef = ref(storage, pdfPath);
  // Get a fresh download URL
  const url = await getDownloadURL(fileRef);
  
  // Firebase Storage download URLs should work, but if CORS is an issue,
  // you may need to configure CORS in Firebase Console:
  // https://firebase.google.com/docs/storage/web/download-files#cors_configuration
  
  // Try fetching with proper headers
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Accept': 'application/pdf',
    },
  });
  
  if (!response.ok) {
    throw new Error(`Failed to download PDF: ${response.statusText}`);
  }
  
  return await response.blob();
};
