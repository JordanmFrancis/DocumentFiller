'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthContext } from '@/components/Auth/AuthProvider';
import Header from '@/components/Layout/Header';
import PDFUploader from '@/components/PDFUploader';
import FormFieldRenderer from '@/components/FormFieldRenderer';
import DocumentList from '@/components/DocumentList';
import PDFPreview from '@/components/PDFPreview';
import { PDFField, PDFDocument, FormValues } from '@/types/pdf';
import { fillPDF } from '@/lib/pdfFiller';
import { uploadPDF, downloadPDF } from '@/lib/firestore/storage';
import { saveDocument, getUserDocuments, deleteDocument, updateDocument } from '@/lib/firestore/documents';
import {
  Save,
  Loader2,
  Eye,
  Sparkles,
  PenLine,
  ArrowLeft,
  ArrowUp,
  Plus,
} from 'lucide-react';
import PDFViewerEditor from '@/components/PDFViewerEditor';
import PDFFieldCreator from '@/components/PDFFieldCreator';
import OnboardingSlideshow from '@/components/Onboarding/OnboardingSlideshow';
import { detectVisualFields } from '@/lib/visualFieldDetector';
import { detectAIVisionFields } from '@/lib/aiVisualFieldDetector';
import { detectAnnotationFields } from '@/lib/annotationFieldDetector';

type ViewMode = 'list' | 'upload' | 'form' | 'loading';

export default function HomePage() {
  const { user, loading: authLoading } = useAuthContext();
  const router = useRouter();
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [documents, setDocuments] = useState<PDFDocument[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fields, setFields] = useState<PDFField[]>([]);
  const [formValues, setFormValues] = useState<FormValues>({});
  const [untouchedDefaults, setUntouchedDefaults] = useState<Set<string>>(new Set());
  const [currentDocument, setCurrentDocument] = useState<PDFDocument | null>(null);
  const [processing, setProcessing] = useState(false);
  const [loadingDocuments, setLoadingDocuments] = useState(true);
  const [showPDFEditor, setShowPDFEditor] = useState(false);
  const [showFieldCreator, setShowFieldCreator] = useState(false);
  const [useAILabeling, setUseAILabeling] = useState(false);
  const [highlightFieldName, setHighlightFieldName] = useState<string | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [detectionStage, setDetectionStage] = useState<'acroform' | 'visual' | 'ai-vision' | null>(null);
  const [autoSavedAt, setAutoSavedAt] = useState<Date | null>(null);
  // Currently focused field on the form side — drives the highlight + page
  // jump on the PDF preview pane.
  const [activeFieldName, setActiveFieldName] = useState<string | null>(null);

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
        setTimeout(() => setShowOnboarding(true), 500);
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

  const materializeInferredFields = async (
    file: File,
    inferredFields: PDFField[]
  ): Promise<void> => {
    const addFieldsForm = new FormData();
    addFieldsForm.append('file', file);
    addFieldsForm.append('fields', JSON.stringify(inferredFields));

    const addResponse = await fetch('/api/add-fields', {
      method: 'POST',
      body: addFieldsForm,
    });

    if (!addResponse.ok) throw new Error('Failed to materialize inferred fields');

    const modifiedPdfBytes = new Uint8Array(await addResponse.arrayBuffer());
    const pdfArrayBuffer = new ArrayBuffer(modifiedPdfBytes.length);
    new Uint8Array(pdfArrayBuffer).set(modifiedPdfBytes);
    const blob = new Blob([pdfArrayBuffer], { type: 'application/pdf' });
    const modifiedFile = new File([blob], file.name, { type: 'application/pdf' });

    setSelectedFile(modifiedFile);
    setFields(inferredFields);
    setViewMode('form');
  };

  const handleFileSelect = async (file: File) => {
    setSelectedFile(file);
    setProcessing(true);
    setViewMode('loading');
    setDetectionStage('acroform');

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('useAI', useAILabeling.toString());

      // Tier 1 runs two AcroForm parsers in parallel and merges their results:
      //   - server-side pdf-lib (handles AI label generation when enabled)
      //   - client-side pdf.js getAnnotations() — the same path PDF viewers
      //     like Chrome use; tends to catch widgets pdf-lib misses
      // Either failing alone is fine — we just lose that side's coverage.
      const [serverResult, clientFields] = await Promise.all([
        fetch('/api/detect-fields', { method: 'POST', body: formData })
          .then(async (r) => {
            if (!r.ok) throw new Error(`detect-fields ${r.status}`);
            return (await r.json()) as { fields: PDFField[] };
          })
          .catch((e) => {
            console.warn('Server-side AcroForm detection failed:', e);
            return { fields: [] as PDFField[] };
          }),
        detectAnnotationFields(file).catch((e) => {
          console.warn('Client-side annotation detection failed:', e);
          return [] as PDFField[];
        }),
      ]);

      const serverFields = serverResult.fields || [];
      console.log(
        `Tier 1: pdf-lib found ${serverFields.length}, pdf.js found ${clientFields.length}`
      );

      // Union by field name. Start with client (reliable position from pdf.js),
      // overlay with server fields (which may carry AI-generated labels and
      // richer metadata like options/required/defaultValue).
      const fieldMap = new Map<string, PDFField>();
      for (const f of clientFields) fieldMap.set(f.name, f);
      for (const f of serverFields) {
        const existing = fieldMap.get(f.name);
        if (!existing) {
          fieldMap.set(f.name, f);
        } else {
          fieldMap.set(f.name, {
            ...existing,
            type: f.type,
            label: f.label || existing.label,
            // Position: prefer whichever side actually has one
            position: existing.position || f.position,
            page: existing.position ? existing.page : f.page,
            defaultValue: f.defaultValue ?? existing.defaultValue,
            options: f.options || existing.options,
            required: f.required ?? existing.required,
          });
        }
      }
      const tier1Fields = Array.from(fieldMap.values());

      setFormValues({});

      // Tier 1: AcroForm widgets
      if (tier1Fields.length > 0) {
        setFields(tier1Fields);
        setViewMode('form');
        return;
      }

      // Tier 2: vector-rectangle scan
      console.log('No AcroForm fields found, running visual rectangle detection…');
      setDetectionStage('visual');
      let visualFields: PDFField[] = [];
      try {
        const visualResult = await detectVisualFields(file);
        visualFields = visualResult.fields;
        console.log(`Visual detection found ${visualFields.length} candidate boxes`);
      } catch (visualError) {
        console.error('Visual detection failed:', visualError);
      }

      if (visualFields.length > 0) {
        await materializeInferredFields(file, visualFields);
        return;
      }

      // Tier 3: AI vision
      console.log('No vector boxes found, falling back to AI vision detection…');
      setDetectionStage('ai-vision');
      let aiFields: PDFField[] = [];
      let aiError: string | undefined;
      try {
        const aiResult = await detectAIVisionFields(file);
        aiFields = aiResult.fields;
        aiError = aiResult.error;
      } catch (visionError) {
        console.error('AI vision detection failed:', visionError);
      }

      if (aiFields.length > 0) {
        await materializeInferredFields(file, aiFields);
        return;
      }

      // All tiers exhausted
      setViewMode('upload');
      const message = aiError
        ? `No form fields detected. AI vision: ${aiError}\n\nWould you like to create fields manually?`
        : 'No form fields detected. Would you like to create fields manually?';
      const shouldCreateFields = confirm(message);
      if (shouldCreateFields) setShowFieldCreator(true);
    } catch (error) {
      console.error('Error detecting fields:', error);
      alert('Failed to detect fields in PDF');
      setViewMode('upload');
    } finally {
      setProcessing(false);
      setDetectionStage(null);
    }
  };

  const handleFormChange = (fieldName: string, value: any) => {
    setFormValues((prev) => ({ ...prev, [fieldName]: value }));
    setAutoSavedAt(new Date());
  };

  const handleLabelChange = (fieldName: string, newLabel: string) => {
    const updatedFields = fields.map((field) =>
      field.name === fieldName ? { ...field, label: newLabel } : field
    );
    setFields(updatedFields);

    if (currentDocument) {
      updateDocument(currentDocument.id, { fieldDefinitions: updatedFields }).catch((error) => {
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
        const response = await fetch(doc.originalPdfUrl, { mode: 'cors', credentials: 'omit' });
        if (response.ok) {
          const blob = await response.blob();
          file = new File([blob], doc.name, { type: 'application/pdf' });
          setSelectedFile(file);
        }
      }

      const fieldsHavePositions = doc.fieldDefinitions.some((f) => f.position);

      if (!fieldsHavePositions && file) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('useAI', 'false');
        const response = await fetch('/api/detect-fields', { method: 'POST', body: formData });

        if (response.ok) {
          const data = await response.json();
          const detectedFields = data.fields;
          const mergedFields = doc.fieldDefinitions.map((savedField) => {
            const detectedField = detectedFields.find((f: PDFField) => f.name === savedField.name);
            if (detectedField && detectedField.position) {
              return { ...savedField, position: detectedField.position, page: detectedField.page };
            }
            return savedField;
          });
          setFields(mergedFields);
          if (user) {
            updateDocument(doc.id, { fieldDefinitions: mergedFields }).catch((error) => {
              console.error('Error updating document with positions:', error);
            });
          }
        } else {
          setFields(doc.fieldDefinitions);
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
    const field = fields.find((f) => f.name === fieldName);
    if (field && field.position) {
      setHighlightFieldName(fieldName);
      setShowPDFEditor(true);
    }
  };

  // Set the active field whenever the user focuses an input or clicks a row's
  // eye icon — drives the highlight + auto-page-jump in PDFPreview.
  const handleFieldFocus = (fieldName: string) => {
    setActiveFieldName(fieldName);
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

  // ────────────────────────────────────────────────────────
  // Auth gates
  // ────────────────────────────────────────────────────────
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-paper">
        <div className="text-center">
          <div className="animate-spin rounded-full h-9 w-9 border-2 border-accent border-t-transparent mx-auto mb-3" />
          <p className="text-ink-soft text-[14px]">Initializing…</p>
        </div>
      </div>
    );
  }
  if (!user) return null;

  // ────────────────────────────────────────────────────────
  // Computed bits used in form view
  // ────────────────────────────────────────────────────────
  const filledFieldCount = fields.filter((f) => {
    const v = formValues[f.name];
    return v !== undefined && v !== null && v !== '' && v !== false;
  }).length;
  const totalFields = fields.length;
  const filename = currentDocument?.name || selectedFile?.name || 'Untitled.pdf';
  const activeField = activeFieldName ? fields.find((f) => f.name === activeFieldName) ?? null : null;

  // ────────────────────────────────────────────────────────
  // Render
  // ────────────────────────────────────────────────────────
  // Form view locks the page to viewport height so each pane scrolls
  // independently; other views allow normal page scroll.
  const isFormView = viewMode === 'form';

  return (
    <div className={`bg-paper text-ink ${isFormView ? 'h-screen overflow-hidden' : 'min-h-screen'}`}>
      <Header onShowTutorial={() => setShowOnboarding(true)} />

      {/* Dashboard / list view */}
      {viewMode === 'list' && (
        <main className="max-w-[1200px] mx-auto px-8 py-12">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="flex items-end justify-between mb-8 gap-4 flex-wrap">
              <div>
                <div className="eyebrow mb-2">Your documents</div>
                <h2 className="font-serif text-[34px] text-ink leading-tight">
                  {documents.length} {documents.length === 1 ? 'document' : 'documents'}
                </h2>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={handleNewDocument} className="btn btn-outline">
                  <ArrowUp className="co-ico co-ico-import w-3.5 h-3.5" />
                  Import
                </button>
                <button onClick={handleNewDocument} className="btn btn-dark">
                  <Plus className="co-ico co-ico-plus w-3.5 h-3.5" />
                  New document
                </button>
              </div>
            </div>
            <DocumentList
              documents={documents}
              onSelect={handleDocumentSelect}
              onDelete={handleDeleteDocument}
              loading={loadingDocuments}
            />
          </motion.div>
        </main>
      )}

      {/* Upload / first-run view */}
      {viewMode === 'upload' && (
        <main className="max-w-[640px] mx-auto px-8 py-16">
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            <div className="eyebrow mb-3 co-enter" style={{ color: 'var(--accent)' }}>
              Get started
            </div>
            <h1
              className="font-serif text-[44px] leading-[1.05] text-ink mb-3 co-enter"
              style={{ animationDelay: '0.05s' }}
            >
              Any PDF, filled in{' '}
              <em className="font-serif italic" style={{ color: 'var(--accent)' }}>
                minutes
              </em>
              .
            </h1>
            <p
              className="text-ink-soft text-[15px] leading-relaxed mb-8 max-w-[500px] co-enter"
              style={{ animationDelay: '0.1s' }}
            >
              Drop a PDF. Counsel detects the fields (or lets you draw your own), then gives you a clean form. Fill once, download the finished document.
            </p>

            <PDFUploader
              onFileSelect={handleFileSelect}
              selectedFile={selectedFile}
              onRemove={() => {
                setSelectedFile(null);
                setViewMode('list');
              }}
            />

            {/* AI Labeling toggle */}
            <label className="flex items-start gap-3 mt-5 cursor-pointer surface px-4 py-3.5">
              <input
                type="checkbox"
                checked={useAILabeling}
                onChange={(e) => setUseAILabeling(e.target.checked)}
                className="checkbox mt-0.5"
              />
              <div className="flex-1">
                <div className="flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-accent" />
                  <span className="text-[13.5px] font-medium text-ink">
                    Use AI to label fields
                  </span>
                </div>
                <p className="text-[12.5px] text-ink-faint mt-1">
                  Reads context around each field and names them in plain language. Adds a few seconds.
                </p>
              </div>
            </label>

            {/* Create-fields prompt when no fields detected */}
            {selectedFile && fields.length === 0 && !processing && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-5 surface p-4 flex items-center justify-between gap-4 flex-wrap"
              >
                <div className="flex-1 min-w-0">
                  <h3 className="text-[14px] font-medium text-ink mb-0.5">No form fields detected</h3>
                  <p className="text-[12.5px] text-ink-faint">
                    Create them by dragging field types onto the document.
                  </p>
                </div>
                <button onClick={() => setShowFieldCreator(true)} className="btn btn-primary btn-sm">
                  <PenLine className="w-3.5 h-3.5" />
                  Create fields
                </button>
              </motion.div>
            )}

            {/* Steps */}
            <div className="flex items-center gap-6 mt-10 flex-wrap">
              {(['Upload', 'Detect', 'Fill', 'Download'] as const).map((label, i) => (
                <div key={label} className="step" data-active={i === 0}>
                  <span className="step-num">{i + 1}</span>
                  {label}
                </div>
              ))}
            </div>
          </motion.div>
        </main>
      )}

      {/* Loading view */}
      {viewMode === 'loading' && (
        <main className="max-w-[1200px] mx-auto px-8 flex items-center justify-center min-h-[60vh]">
          <div className="text-center max-w-md">
            <Loader2 className="w-9 h-9 text-accent animate-spin mx-auto mb-4" />
            <p className="font-serif text-[20px] text-ink mb-1">
              {detectionStage === 'visual'
                ? 'Scanning visual boxes…'
                : detectionStage === 'ai-vision'
                ? 'Asking AI to find fields…'
                : useAILabeling
                ? 'Detecting fields & generating labels…'
                : 'Detecting form fields…'}
            </p>
            <p className="text-[13px] text-ink-faint mb-5">
              {detectionStage === 'ai-vision'
                ? 'This may take 10–20 seconds'
                : 'Falling back through detection tiers'}
            </p>

            {/* Tier indicator */}
            <div className="flex items-center justify-center gap-1.5">
              {(['acroform', 'visual', 'ai-vision'] as const).map((stage) => {
                const labels = {
                  acroform: '1 · AcroForm',
                  visual: '2 · Vector',
                  'ai-vision': '3 · AI vision',
                };
                const stages = ['acroform', 'visual', 'ai-vision'] as const;
                const currentIdx = detectionStage ? stages.indexOf(detectionStage) : 0;
                const myIdx = stages.indexOf(stage);
                const isCurrent = stage === detectionStage;
                const isPast = myIdx < currentIdx;
                return (
                  <span
                    key={stage}
                    // Currently-running tier breathes a soft green ring so
                    // it's obvious which detector is firing right now.
                    className={`text-[11.5px] px-2.5 py-1 rounded-full border transition-colors ${
                      isCurrent
                        ? 'bg-accent text-paper-card border-accent co-pill-breath'
                        : isPast
                        ? 'bg-accent-tint text-accent border-accent-line'
                        : 'bg-paper-elev text-ink-faint border-rule'
                    }`}
                  >
                    {labels[stage]}
                  </span>
                );
              })}
            </div>
          </div>
        </main>
      )}

      {/* Form / fill view — split pane with independent panel scroll */}
      {viewMode === 'form' && (
        <motion.main
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="grid grid-cols-1 lg:grid-cols-[minmax(420px,580px)_1fr] gap-0 max-w-[1600px] mx-auto lg:h-[calc(100vh-56px)] lg:overflow-hidden"
        >
          {/* LEFT: form (header + scrolling body + footer) */}
          <section className="border-r border-rule flex flex-col lg:overflow-hidden">
            {/* Form header — fixed */}
            <div className="px-7 pt-6 pb-5 hairline shrink-0 bg-paper">
              <button
                onClick={() => {
                  setActiveFieldName(null);
                  setViewMode('list');
                }}
                className="co-back text-[12.5px] text-ink-faint hover:text-ink flex items-center gap-1 mb-3 transition-colors"
              >
                <ArrowLeft className="co-ico co-ico-back w-3 h-3" />
                Documents
              </button>
              <h1 className="font-serif text-[22px] text-ink leading-tight mb-3">{filename}</h1>
              <div className="flex items-center gap-2 text-[12.5px] text-ink-faint mb-2">
                <span>{totalFields} fields</span>
                <span>·</span>
                <span>
                  {autoSavedAt
                    ? `last saved ${formatJustNow(autoSavedAt)}`
                    : 'not saved yet'}
                </span>
              </div>
              <div className="flex items-center gap-3">
                {/* Shimmering progress fill while filling, solid green once complete */}
                <div className="progress flex-1">
                  <span
                    className={
                      filledFieldCount > 0 && filledFieldCount < totalFields ? 'co-shim' : ''
                    }
                    style={{ width: `${totalFields ? (filledFieldCount / totalFields) * 100 : 0}%` }}
                  />
                </div>
                <span className="font-mono text-[11.5px] text-ink-faint tabular-nums">
                  {filledFieldCount}/{totalFields}
                </span>
              </div>
            </div>

            {/* Form body — independent scroll */}
            <div className="flex-1 lg:overflow-y-auto px-7 py-6">
              <FormFieldRenderer
                fields={fields}
                values={formValues}
                onChange={handleFormChange}
                onLabelChange={handleLabelChange}
                onFieldFocus={handleFieldFocus}
                activeFieldName={activeFieldName}
                editableLabels={true}
              />
            </div>

            {/* Form footer — fixed */}
            <div className="hairline-t px-7 py-4 flex items-center justify-between gap-3 bg-paper-card shrink-0">
              <div className="flex items-center gap-2 text-[12.5px] text-ink-faint font-mono">
                {autoSavedAt ? (
                  <>
                    <span className="co-ico-pulse w-1.5 h-1.5 rounded-full bg-accent" />
                    auto-saved
                  </>
                ) : (
                  <>
                    <span className="w-1.5 h-1.5 rounded-full bg-ink-muted" />
                    not yet auto-saved
                  </>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowPDFEditor(true)}
                  className="btn btn-ghost btn-sm"
                  title="Edit field labels visually"
                >
                  <Eye className="co-ico co-ico-wiggle w-3.5 h-3.5" />
                  Edit labels
                </button>
                {selectedFile && (
                  <button
                    onClick={() => setShowFieldCreator(true)}
                    className="btn btn-ghost btn-sm"
                    title="Add or edit fields"
                  >
                    <PenLine className="co-ico co-ico-pencil w-3.5 h-3.5" />
                    Add fields
                  </button>
                )}
                {!currentDocument && (
                  <button onClick={handleSaveDocument} disabled={processing} className="btn btn-outline btn-sm">
                    <Save className="co-ico co-ico-bounce w-3.5 h-3.5" />
                    Save
                  </button>
                )}
                {/* Generate PDF — the climax of every session. Custom SVG
                    structured into <g class="dl-arrow"> + <line class="dl-line">
                    so the spec's co-dl-arrow / co-dl-line keyframes can target
                    the parts independently: arrow falls past the baseline and
                    fades, line widens and pulses, arrow re-enters from above.
                    Lucide's <Download> is a single composed path with no
                    sub-groups, so it can't carry this animation. */}
                <button
                  onClick={handleFillPDF}
                  disabled={processing || fields.length === 0}
                  className="btn btn-primary btn-sm"
                >
                  {processing ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <svg
                      className="co-dl w-3.5 h-3.5"
                      viewBox="0 0 14 14"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <g className="dl-arrow">
                        <path d="M7 1.5 L7 9.5" />
                        <path d="M3.5 6.5 L7 10 L10.5 6.5" />
                      </g>
                      <line className="dl-line" x1="2.5" y1="12.5" x2="11.5" y2="12.5" />
                    </svg>
                  )}
                  Download PDF
                </button>
              </div>
            </div>
          </section>

          {/* RIGHT: PDF preview — fixed in viewport, scrolls internally */}
          <section className="bg-paper-card hidden lg:flex flex-col lg:overflow-hidden">
            <PDFPreview pdfFile={selectedFile} activeField={activeField} />
          </section>
        </motion.main>
      )}

      {/* Onboarding */}
      <AnimatePresence>
        {showOnboarding && <OnboardingSlideshow onComplete={handleOnboardingComplete} />}
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
              updateDocument(currentDocument.id, { fieldDefinitions: updatedFields }).catch((error) => {
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

function formatJustNow(d: Date): string {
  const diff = Date.now() - d.getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 5) return 'just now';
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}
