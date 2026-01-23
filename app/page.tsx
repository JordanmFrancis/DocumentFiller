'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { useAuthContext } from '@/components/Auth/AuthProvider';
import Header from '@/components/Layout/Header';
import Sidebar from '@/components/Layout/Sidebar';
import PDFUploader from '@/components/PDFUploader';
import FormFieldRenderer from '@/components/FormFieldRenderer';
import DocumentList from '@/components/DocumentList';
import { PDFField, PDFDocument, FormValues } from '@/types/pdf';
import { detectPDFFields } from '@/lib/pdfFieldDetector';
import { fillPDF } from '@/lib/pdfFiller';
import { uploadPDF, deletePDF, downloadPDF } from '@/lib/firestore/storage';
import { saveDocument, getUserDocuments, deleteDocument, getDocument, updateDocument } from '@/lib/firestore/documents';
import { Download, Save, Loader2, Eye } from 'lucide-react';
import PDFViewerEditor from '@/components/PDFViewerEditor';
import OnboardingSlideshow from '@/components/Onboarding/OnboardingSlideshow';
import { AnimatePresence } from 'framer-motion';

type ViewMode = 'list' | 'upload' | 'form' | 'loading';

export default function HomePage() {
  const { user, loading: authLoading } = useAuthContext();
  const router = useRouter();
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [documents, setDocuments] = useState<PDFDocument[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fields, setFields] = useState<PDFField[]>([]);
  const [formValues, setFormValues] = useState<FormValues>({});
  const [currentDocument, setCurrentDocument] = useState<PDFDocument | null>(null);
  const [processing, setProcessing] = useState(false);
  const [loadingDocuments, setLoadingDocuments] = useState(true);
  const [showPDFEditor, setShowPDFEditor] = useState(false);
  const [useAILabeling, setUseAILabeling] = useState(false);
  const [highlightFieldName, setHighlightFieldName] = useState<string | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user) {
      loadDocuments();
      
      // Check if user has seen onboarding
      const hasSeenOnboarding = localStorage.getItem('hasSeenOnboarding');
      if (!hasSeenOnboarding) {
        // Show onboarding after a short delay
        setTimeout(() => {
          setShowOnboarding(true);
        }, 500);
      }
    }
  }, [user]);

  const loadDocuments = async () => {
    if (!user) return;
    try {
      setLoadingDocuments(true);
      const docs = await getUserDocuments(user.uid);
      setDocuments(docs);
    } catch (error) {
      console.error('Error loading documents:', error);
    } finally {
      setLoadingDocuments(false);
    }
  };

  const handleFileSelect = async (file: File) => {
    setSelectedFile(file);
    setProcessing(true);
    setViewMode('loading');

    try {
      // Use API route for field detection (supports AI labeling)
      const formData = new FormData();
      formData.append('file', file);
      formData.append('useAI', useAILabeling.toString());

      const response = await fetch('/api/detect-fields', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to detect fields');
      }

      const data = await response.json();
      setFields(data.fields);
      setFormValues({});
      setViewMode('form');
    } catch (error) {
      console.error('Error detecting fields:', error);
      alert('Failed to detect fields in PDF');
      setViewMode('upload');
    } finally {
      setProcessing(false);
    }
  };

  const handleFormChange = (fieldName: string, value: any) => {
    setFormValues((prev) => ({
      ...prev,
      [fieldName]: value,
    }));
  };

  const handleLabelChange = (fieldName: string, newLabel: string) => {
    const updatedFields = fields.map((field) =>
      field.name === fieldName ? { ...field, label: newLabel } : field
    );
    setFields(updatedFields);
    
    // If it's a saved document, update Firestore immediately
    if (currentDocument) {
      updateDocument(currentDocument.id, {
        fieldDefinitions: updatedFields,
      }).catch((error) => {
        console.error('Error updating document fields:', error);
      });
    }
  };

  const handleSaveDocument = async () => {
    if (!user || !selectedFile || fields.length === 0) return;

    try {
      setProcessing(true);
      const documentId = currentDocument?.id || `doc_${Date.now()}`;
      
      // Upload original PDF
      const pdfPath = `users/${user.uid}/documents/${documentId}/original.pdf`;
      const pdfUrl = await uploadPDF(selectedFile, pdfPath);

      // Save document metadata
      await saveDocument(user.uid, documentId, {
        name: selectedFile.name,
        originalPdfUrl: pdfUrl,
        fieldDefinitions: fields,
      });

      await loadDocuments();
      setViewMode('list');
      setSelectedFile(null);
      setFields([]);
      setFormValues({});
      setCurrentDocument(null);
    } catch (error) {
      console.error('Error saving document:', error);
      alert('Failed to save document');
    } finally {
      setProcessing(false);
    }
  };

  const handleFillPDF = async () => {
    if (!selectedFile || fields.length === 0) return;

    try {
      setProcessing(true);
      const arrayBuffer = await selectedFile.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      
      const filledPdfBytes = await fillPDF(uint8Array, formValues);
      
      // Create blob and download
      // Convert to ArrayBuffer for TypeScript compatibility
      const pdfArrayBuffer = new ArrayBuffer(filledPdfBytes.length);
      new Uint8Array(pdfArrayBuffer).set(filledPdfBytes);
      const blob = new Blob([pdfArrayBuffer], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `filled_${selectedFile.name}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      // Save to Firestore if document exists
      if (currentDocument && user) {
        const filledPdfPath = `users/${user.uid}/documents/${currentDocument.id}/filled_${Date.now()}.pdf`;
        const filledPdfUrl = await uploadPDF(blob, filledPdfPath);
        
        // Note: You'll need to implement addFilledPDF function
        // await addFilledPDF(currentDocument.id, {
        //   id: `filled_${Date.now()}`,
        //   downloadUrl: filledPdfUrl,
        //   formValues,
        // });
      }
    } catch (error) {
      console.error('Error filling PDF:', error);
      alert('Failed to fill PDF');
    } finally {
      setProcessing(false);
    }
  };

  const handleDocumentSelect = async (doc: PDFDocument) => {
    setCurrentDocument(doc);
    setFormValues({});
    setViewMode('loading');
    setProcessing(true);
    
    try {
      // Load the original PDF file so we can edit labels
      let file: File | null = null;
      
      try {
        // Extract the path from the Firebase Storage URL
        const url = new URL(doc.originalPdfUrl);
        const pathMatch = url.pathname.match(/\/o\/(.+?)(\?|$)/);
        
        if (pathMatch) {
          // Decode the path (Firebase Storage URLs are URL-encoded)
          const storagePath = decodeURIComponent(pathMatch[1]);
          const blob = await downloadPDF(storagePath);
          file = new File([blob], doc.name, { type: 'application/pdf' });
          setSelectedFile(file);
        }
      } catch (urlError) {
        console.warn('Could not parse URL, trying direct fetch:', urlError);
        // Fallback: try direct fetch
        const response = await fetch(doc.originalPdfUrl, {
          mode: 'cors',
          credentials: 'omit',
        });
        if (response.ok) {
          const blob = await response.blob();
          file = new File([blob], doc.name, { type: 'application/pdf' });
          setSelectedFile(file);
        }
      }
      
      // Check if fields have position data, if not, re-detect positions
      const fieldsHavePositions = doc.fieldDefinitions.some(f => f.position);
      
      if (!fieldsHavePositions && file) {
        // Re-detect positions for existing documents that don't have them
        console.log('Re-detecting field positions for existing document...');
        const formData = new FormData();
        formData.append('file', file);
        formData.append('useAI', 'false'); // Don't regenerate labels for existing docs
        
        const response = await fetch('/api/detect-fields', {
          method: 'POST',
          body: formData,
        });
        
        if (!response.ok) {
          throw new Error('Failed to re-detect positions');
        }
        
        const data = await response.json();
        const detectedFields = data.fields;
        
        // Merge detected positions with saved labels
        const mergedFields = doc.fieldDefinitions.map(savedField => {
          const detectedField = detectedFields.find((f: PDFField) => f.name === savedField.name);
          if (detectedField && detectedField.position) {
            return {
              ...savedField,
              position: detectedField.position,
              page: detectedField.page,
            };
          }
          return savedField;
        });
        
        setFields(mergedFields);
        
        // Update the document with position data
        if (user) {
          updateDocument(doc.id, {
            fieldDefinitions: mergedFields,
          }).catch((error) => {
            console.error('Error updating document with positions:', error);
          });
        }
      } else {
        // Use existing field definitions
        setFields(doc.fieldDefinitions);
      }
      
      setViewMode('form');
    } catch (error) {
      console.error('Error loading document:', error);
      // Use existing field definitions even if PDF load fails
      setFields(doc.fieldDefinitions);
      setViewMode('form');
    } finally {
      setProcessing(false);
    }
  };

  const handleDeleteDocument = async (documentId: string) => {
    if (!confirm('Are you sure you want to delete this document?')) return;

    try {
      await deleteDocument(documentId);
      await loadDocuments();
    } catch (error) {
      console.error('Error deleting document:', error);
      alert('Failed to delete document');
    }
  };

  const handleNewDocument = () => {
    setViewMode('upload');
    setSelectedFile(null);
    setFields([]);
    setFormValues({});
    setCurrentDocument(null);
  };

  const handleOnboardingComplete = () => {
    setShowOnboarding(false);
    localStorage.setItem('hasSeenOnboarding', 'true');
  };

  const handleFieldClick = (fieldName: string) => {
    // Find the field to get its page
    const field = fields.find(f => f.name === fieldName);
    if (field && field.position) {
      setHighlightFieldName(fieldName);
      setShowPDFEditor(true);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-gray-400 text-sm">Initializing...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-900">
      <Header onShowTutorial={() => setShowOnboarding(true)} />
      <div className="flex">
        <Sidebar onNewDocument={handleNewDocument} />
        <main className="flex-1 p-8">
          {viewMode === 'list' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="max-w-7xl mx-auto"
            >
              <h2 className="text-2xl font-bold text-white mb-6">Your Documents</h2>
              <DocumentList
                documents={documents}
                onSelect={handleDocumentSelect}
                onDelete={handleDeleteDocument}
                loading={loadingDocuments}
              />
            </motion.div>
          )}

          {viewMode === 'upload' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="max-w-3xl mx-auto"
            >
              <h2 className="text-2xl font-bold text-white mb-6">Upload PDF</h2>
              
              {/* AI Labeling Toggle */}
              <div className="mb-6 p-4 bg-gray-800 rounded-lg border border-gray-700">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={useAILabeling}
                    onChange={(e) => setUseAILabeling(e.target.checked)}
                    className="w-5 h-5 rounded border-gray-600 bg-gray-700 text-primary focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-gray-800"
                  />
                  <div>
                    <div className="text-white font-medium">Use AI to generate field labels</div>
                    <div className="text-sm text-gray-400 mt-1">
                      Automatically generate intelligent labels based on context around each field. 
                      Requires OpenAI API key configured.
                    </div>
                  </div>
                </label>
              </div>
              
              <PDFUploader
                onFileSelect={handleFileSelect}
                selectedFile={selectedFile}
                onRemove={() => {
                  setSelectedFile(null);
                  setViewMode('list');
                }}
              />
            </motion.div>
          )}

          {viewMode === 'loading' && (
            <div className="flex items-center justify-center min-h-[400px]">
              <div className="text-center">
                <Loader2 className="w-12 h-12 text-primary animate-spin mx-auto mb-4" />
                <p className="text-gray-400">
                  {useAILabeling ? 'Detecting fields and generating AI labels...' : 'Detecting form fields...'}
                </p>
                {useAILabeling && (
                  <p className="text-sm text-gray-500 mt-2">This may take a moment</p>
                )}
              </div>
            </div>
          )}

          {viewMode === 'form' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="max-w-3xl mx-auto"
            >
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-white mb-2">
                    {currentDocument?.name || selectedFile?.name || 'Fill Form'}
                  </h2>
                  <p className="text-gray-400">
                    {fields.length} field{fields.length !== 1 ? 's' : ''} detected
                  </p>
                </div>
                <div className="flex gap-3">
                  {(selectedFile || currentDocument) && (
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setShowPDFEditor(true)}
                      className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors"
                      title="Edit field labels in PDF viewer"
                    >
                      <Eye className="w-4 h-4" />
                      Edit Labels
                    </motion.button>
                  )}
                  {!currentDocument && (
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={handleSaveDocument}
                      disabled={processing}
                      className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors disabled:opacity-50"
                    >
                      <Save className="w-4 h-4" />
                      Save
                    </motion.button>
                  )}
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleFillPDF}
                    disabled={processing || fields.length === 0}
                    className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-lg transition-colors disabled:opacity-50"
                  >
                    {processing ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Download className="w-4 h-4" />
                    )}
                    Generate PDF
                  </motion.button>
                </div>
              </div>

              <div className="bg-gray-800/50 backdrop-blur-xl rounded-xl border border-gray-700/50 p-6">
                <FormFieldRenderer
                  fields={fields}
                  values={formValues}
                  onChange={handleFormChange}
                  onLabelChange={handleLabelChange}
                  onFieldClick={handleFieldClick}
                  editableLabels={true}
                />
              </div>
            </motion.div>
          )}
        </main>
      </div>

      {/* Onboarding Slideshow */}
      <AnimatePresence>
        {showOnboarding && (
          <OnboardingSlideshow onComplete={handleOnboardingComplete} />
        )}
      </AnimatePresence>

      {/* PDF Viewer Editor Modal */}
      {showPDFEditor && (selectedFile || currentDocument?.originalPdfUrl) && (
        <PDFViewerEditor
          pdfFile={selectedFile || currentDocument!.originalPdfUrl}
          fields={fields}
          highlightFieldName={highlightFieldName}
          onFieldsChange={(updatedFields) => {
            setFields(updatedFields);
            // If it's a saved document, update Firestore
            if (currentDocument) {
              updateDocument(currentDocument.id, {
                fieldDefinitions: updatedFields,
              }).catch((error) => {
                console.error('Error updating document fields:', error);
              });
            }
          }}
          onClose={() => {
            setShowPDFEditor(false);
            setHighlightFieldName(null);
          }}
        />
      )}
    </div>
  );
}
