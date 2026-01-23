// Type declarations for PDF.js loaded from CDN
declare global {
  interface Window {
    pdfjsLib?: {
      getDocument: (params: { data: ArrayBuffer; useSystemFonts?: boolean }) => {
        promise: Promise<any>;
      };
      GlobalWorkerOptions: {
        workerSrc: string;
      };
      version?: string;
    };
  }
}

export {};
