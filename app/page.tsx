'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthContext } from '@/components/Auth/AuthProvider';
import Header from '@/components/Layout/Header';
import Sidebar from '@/components/Layout/Sidebar';
import PDFUploader from '@/components/PDFUploader';
import FormFieldRenderer from '@/components/FormFieldRenderer';
import DocumentList from '@/components/DocumentList';
import { PDFField, PDFDocument, FormValues } from '@/types/pdf';
import { fillPDF } from '@/lib/pdfFiller';
import { uploadPDF, downloadPDF } from '@/lib/firestore/storage';
import { saveDocument, getUserDocuments, deleteDocument, updateDocument } from '@/lib/firestore/documents';
import { Download, Save, Loader2, Eye, Sparkles, PenLine } from 'lucide-react';
import PDFViewerEditor from '@/components/PDFViewerEditor';
import PDFFieldCreator from '@/components/PDFFieldCreator';
import OnboardingSlideshow from '@/components/Onboarding/OnboardingSlideshow';

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
  const [showFieldCreator, setShowFieldCreator] = useState(false);
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
      const hasSeenOnboarding = localStorage.getItem('hasSeenOnboarding');
      if (!hasSeenOnboarding) {
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

      if (data.fields.length === 0) {
        setViewMode('upload');
        const shouldCreateFields = confirm(
          'No form fields detected in this PDF. Would you like to create fields by dragging and dropping them on the document?'
        );
        if (shouldCreateFields) {
          setShowFieldCreator(true);
        }
      } else {
        setViewMode('form');
      }
    } catch (error) {
      console.error('Error detecting fields:', error);
      alert('Failed to detect fields in PDF');
      setViewMode('upload');
    } finally {
      setProcessing(false);
    }
  };

  const handleFormChange = (fieldName: string, value: any) => {
    setFormValues((prev) => ({ ...prev, [fieldName]: value }));
  };

  const handleLabelChange = (fieldName: string, newLabel: string) => {
    const updatedFields = fields.map((field) =>
      field.name === fieldName ? { ...field, label: newLabel } : field
    );
    setFields(updatedFields);

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

      const pdfPath = `users/${user.uid}/documents/${documentId}/original.pdf`;
      const pdfUrl = await uploadPDF(selectedFile, pdfPath);

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

      if (currentDocument && user) {
        const filledPdfPath = `users/${user.uid}/documents/${currentDocument.id}/filled_${Date.now()}.pdf`;
        await uploadPDF(blob, filledPdfPath);
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
      let file: File | null = null;

      try {
        const url = new URL(doc.originalPdfUrl);
        const pathMatch = url.pathname.match(/\/o\/(.+?)(\?|$)/);

        if (pathMatch) {
          const storagePath = decodeURIComponent(pathMatch[1]);
          const blob = await downloadPDF(storagePath);
          file = new File([blob], doc.name, { type: 'application/pdf' });
          setSelectedFile(file);
        }
      } catch (urlError) {
        console.warn('Could not parse URL, trying direct fetch:', urlError);
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

      const fieldsHavePositions = doc.fieldDefinitions.some(f => f.position);

      if (!fieldsHavePositions && file) {
        console.log('Re-detecting field positions for existing document...');
        const formData = new FormData();
        formData.append('file', file);
        formData.append('useAI', 'false');

        const response = await fetch('/api/detect-fields', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          throw new Error('Failed to re-detect positions');
        }

        const data = await response.json();
        const detectedFields = data.fields;

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

        if (user) {
          updateDocument(doc.id, {
            fieldDefinitions: mergedFields,
          }).catch((error) => {
            console.error('Error updating document with positions:', error);
          });
        }
      } else {
        setFields(doc.fieldDefinitions);
      }

      setViewMode('form');
    } catch (error) {
      console.error('Error loading document:', error);
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
    const field = fields.find(f => f.name === fieldName);
    if (field && field.position) {
      setHighlightFieldName(fieldName);
      setShowPDFEditor(true);
    }
  };

  const handleFieldsCreated = async (createdFields: PDFField[], modifiedPdfBytes: Uint8Array) => {
    const pdfArrayBuffer = new ArrayBuffer(modifiedPdfBytes.length);
    new Uint8Array(pdfArrayBuffer).set(modifiedPdfBytes);
    const blob = new Blob([pdfArrayBuffer], { type: 'application/pdf' });

    const modifiedFile = new File([blob], selectedFile?.name || 'document.pdf', { type: 'application/pdf' });

    setFields(createdFields);
    setSelectedFile(modifiedFile);
    setShowFieldCreator(false);
    setViewMode('form');

    if (currentDocument && user) {
      try {
        const pdfPath = `users/${user.uid}/documents/${currentDocument.id}/original.pdf`;
        await uploadPDF(modifiedFile, pdfPath);
        await updateDocument(currentDocument.id, { fieldDefinitions: createdFields });
      } catch (error) {
        console.error('Error saving modified PDF:', error);
      }
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-paper">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-2 border-ink border-t-transparent mx-auto mb-4"></div>
          <p className="font-marker text-ink text-lg">initializing…</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-paper text-ink">
      <Header onShowTutorial={() => setShowOnboarding(true)} />
      <div className="flex">
        <Sidebar onNewDocument={handleNewDocument} />
        <main className="flex-1 p-8 min-h-[calc(100vh-4rem)]">
          {viewMode === 'list' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="max-w-7xl mx-auto"
            >
              <div className="mb-8 flex items-end justify-between flex-wrap gap-4">
                <div>
                  <h2 className="font-marker text-3xl text-ink squig inline-block">
                    Your Documents
                  </h2>
                  <p className="font-cursive text-lg text-ink-soft mt-3">
                    everything you've uploaded — pick one to fill it out again
                  </p>
                </div>
                <span className="font-typewriter text-xs text-ink-faint uppercase tracking-widest">
                  {documents.length} item{documents.length !== 1 ? 's' : ''}
                </span>
              </div>
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
              <div className="mb-6">
                <h2 className="font-marker text-3xl text-ink squig inline-block">
                  Upload a PDF
                </h2>
                <p className="font-cursive text-lg text-ink-soft mt-3">
                  drop a file in, or browse from your computer
                </p>
              </div>

              {/* AI Labeling Toggle */}
              <div className="mb-6 rough p-4 bg-white">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={useAILabeling}
                    onChange={(e) => setUseAILabeling(e.target.checked)}
                    className="checkbox-hand mt-0.5"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-ink" />
                      <span className="font-marker text-base text-ink">
                        Use AI to generate field labels
                      </span>
                    </div>
                    <p className="font-cursive text-base text-ink-soft mt-1">
                      automatically generate friendly labels from PDF context.
                      requires an OpenAI API key configured.
                    </p>
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

              {/* Create Fields prompt */}
              {selectedFile && fields.length === 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-6 rough p-5 bg-paper-legalpad"
                >
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-marker text-lg text-ink mb-1">
                        No form fields detected
                      </h3>
                      <p className="font-cursive text-base text-ink-soft">
                        this PDF has no fillable fields. create them by dragging field types onto the document.
                      </p>
                    </div>
                    <motion.button
                      whileHover={{ scale: 1.05, rotate: -1 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setShowFieldCreator(true)}
                      className="btn-rough primary"
                    >
                      <PenLine className="w-4 h-4" />
                      Create Fields
                    </motion.button>
                  </div>
                </motion.div>
              )}
            </motion.div>
          )}

          {viewMode === 'loading' && (
            <div className="flex items-center justify-center min-h-[400px]">
              <div className="text-center">
                <div className="relative inline-block mb-4">
                  <Loader2 className="w-14 h-14 text-ink animate-spin mx-auto" />
                </div>
                <p className="font-marker text-xl text-ink mb-1">
                  {useAILabeling ? 'detecting fields & generating AI labels…' : 'detecting form fields…'}
                </p>
                {useAILabeling && (
                  <p className="font-cursive text-base text-ink-soft mt-2">
                    this may take a moment
                  </p>
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
              <div className="mb-6 flex items-end justify-between gap-4 flex-wrap">
                <div className="min-w-0 flex-1">
                  <h2 className="font-marker text-2xl text-ink leading-tight squig inline-block">
                    {currentDocument?.name || selectedFile?.name || 'Fill Form'}
                  </h2>
                  <p className="font-cursive text-base text-ink-soft mt-3">
                    {fields.length} field{fields.length !== 1 ? 's' : ''} detected — fill them in below
                  </p>
                </div>
                <div className="flex gap-2 flex-wrap">
                  {(selectedFile || currentDocument) && (
                    <motion.button
                      whileHover={{ scale: 1.05, rotate: -1 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setShowPDFEditor(true)}
                      className="btn-rough"
                      title="Edit field labels in PDF viewer"
                    >
                      <Eye className="w-4 h-4" />
                      Edit Labels
                    </motion.button>
                  )}
                  {selectedFile && (
                    <motion.button
                      whileHover={{ scale: 1.05, rotate: 1 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setShowFieldCreator(true)}
                      className="btn-rough"
                      title="Add or edit fields"
                    >
                      <PenLine className="w-4 h-4" />
                      Add Fields
                    </motion.button>
                  )}
                  {!currentDocument && (
                    <motion.button
                      whileHover={{ scale: 1.05, rotate: -1 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={handleSaveDocument}
                      disabled={processing}
                      className="btn-rough"
                    >
                      <Save className="w-4 h-4" />
                      Save
                    </motion.button>
                  )}
                  <motion.button
                    whileHover={{ scale: 1.05, rotate: 1 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleFillPDF}
                    disabled={processing || fields.length === 0}
                    className="btn-rough primary"
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

              {/* Notebook-style form sheet */}
              <div className="rough p-6 bg-white relative">
                <div className="tape" style={{ top: '-10px', left: '24px' }} />
                <div className="tape tape-blue" style={{ top: '-10px', right: '24px', transform: 'rotate(4deg)' }} />
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

      {/* PDF Field Creator Modal */}
      {showFieldCreator && selectedFile && (
        <PDFFieldCreator
          pdfFile={selectedFile}
          onFieldsCreated={handleFieldsCreated}
          onClose={() => setShowFieldCreator(false)}
        />
      )}
    </div>
  );
}
