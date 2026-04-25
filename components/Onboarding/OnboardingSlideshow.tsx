'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  ChevronRight,
  ChevronLeft,
  Upload,
  Sparkles,
  FileText,
  Edit,
  Eye,
  Save,
  Download,
  LogIn,
  Pencil,
} from 'lucide-react';

interface Slide {
  id: number;
  title: string;
  description: string;
  icon: React.ReactNode;
  content: React.ReactNode;
}

interface OnboardingSlideshowProps {
  onComplete: () => void;
}

// Image with graceful fallback for missing onboarding screenshots.
function PreviewImage({
  src,
  alt,
  fallbackIcon,
  fallbackHint,
}: {
  src: string;
  alt: string;
  fallbackIcon: React.ReactNode;
  fallbackHint: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className="surface-elev p-2"
    >
      <div className="relative w-full aspect-[4/3] rounded-md overflow-hidden bg-paper-edge">
        <img
          src={src}
          alt={alt}
          className="w-full h-full object-contain"
          onError={(e) => {
            const img = e.currentTarget;
            img.style.display = 'none';
            const fb = img.nextElementSibling as HTMLElement;
            if (fb) fb.style.display = 'flex';
          }}
          onLoad={(e) => {
            const img = e.currentTarget;
            const fb = img.nextElementSibling as HTMLElement;
            if (fb) fb.style.display = 'none';
          }}
        />
        <div className="absolute inset-0 flex flex-col items-center justify-center text-ink-faint">
          <div className="mb-2.5">{fallbackIcon}</div>
          <p className="text-[12px]">{fallbackHint}</p>
        </div>
      </div>
    </motion.div>
  );
}

export default function OnboardingSlideshow({ onComplete }: OnboardingSlideshowProps) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [direction, setDirection] = useState(0);

  const slides: Slide[] = [
    {
      id: 0,
      title: 'Any PDF, filled in minutes',
      description: 'Upload a PDF, get a clean form, download the finished document.',
      icon: <FileText className="w-5 h-5" strokeWidth={1.6} />,
      content: (
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          className="surface-elev py-12 px-6 text-center"
        >
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-accent-tint mb-4">
            <FileText className="w-6 h-6 text-accent" strokeWidth={1.5} />
          </div>
          <h3 className="font-serif text-[24px] text-ink mb-2 leading-tight">
            Upload &middot; Detect &middot; Fill &middot; Download
          </h3>
          <p className="text-ink-soft text-[14px] max-w-sm mx-auto">
            Counsel detects fields automatically — or lets you draw your own. Fill once, save the document, fill again later.
          </p>
        </motion.div>
      ),
    },
    {
      id: 1,
      title: 'Secure sign-in',
      description: 'Sign in with Google, Apple, or email. Your documents stay private.',
      icon: <LogIn className="w-5 h-5" strokeWidth={1.6} />,
      content: (
        <PreviewImage
          src="/images/onboarding/login.png"
          alt="Login screen"
          fallbackIcon={<LogIn className="w-10 h-10" strokeWidth={1.4} />}
          fallbackHint="Add login.png to public/images/onboarding/"
        />
      ),
    },
    {
      id: 2,
      title: 'Upload your PDF',
      description: 'Drop a PDF and Counsel detects the fields automatically.',
      icon: <Upload className="w-5 h-5" strokeWidth={1.6} />,
      content: (
        <div className="space-y-3">
          <PreviewImage
            src="/images/onboarding/upload.png"
            alt="Upload screen"
            fallbackIcon={<Upload className="w-10 h-10" strokeWidth={1.4} />}
            fallbackHint="Add upload.png to public/images/onboarding/"
          />
          <div className="surface px-4 py-3 flex items-center gap-2.5">
            <Sparkles className="w-4 h-4 text-accent shrink-0" />
            <span className="text-[13px] text-ink-soft">
              Enable AI labeling for friendly field names
            </span>
          </div>
        </div>
      ),
    },
    {
      id: 3,
      title: 'AI-generated labels',
      description: 'Optional: let AI read the PDF and write friendly labels for each field.',
      icon: <Sparkles className="w-5 h-5" strokeWidth={1.6} />,
      content: (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="surface-elev p-6"
        >
          <div className="flex items-center gap-4 mb-4">
            <motion.div
              animate={{ rotate: [0, 360] }}
              transition={{ repeat: Infinity, duration: 4, ease: 'linear' }}
              className="w-10 h-10 rounded-full bg-accent-tint flex items-center justify-center shrink-0"
            >
              <Sparkles className="w-5 h-5 text-accent" />
            </motion.div>
            <div className="flex-1 space-y-2">
              <div className="h-2.5 bg-accent/20 rounded-full w-full" />
              <div className="h-2 bg-accent/12 rounded-full w-3/4" />
            </div>
          </div>
          <div className="space-y-2 mb-4">
            <div className="h-1.5 border-b border-rule w-full" />
            <div className="h-1.5 border-b border-rule w-5/6" />
            <div className="h-1.5 border-b border-rule w-4/6" />
          </div>
          <div className="flex items-center gap-2 pt-2 hairline-t">
            <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
            <span className="text-[12.5px] text-ink-soft">Reading document context…</span>
          </div>
        </motion.div>
      ),
    },
    {
      id: 4,
      title: 'A clean form',
      description: 'All detected fields, sorted by document order, ready to fill.',
      icon: <FileText className="w-5 h-5" strokeWidth={1.6} />,
      content: (
        <PreviewImage
          src="/images/onboarding/form-fields.png"
          alt="Form interface"
          fallbackIcon={<FileText className="w-10 h-10" strokeWidth={1.4} />}
          fallbackHint="Add form-fields.png to public/images/onboarding/"
        />
      ),
    },
    {
      id: 5,
      title: 'Edit field labels',
      description: 'Click any label to rename, or use the PDF viewer to edit visually.',
      icon: <Edit className="w-5 h-5" strokeWidth={1.6} />,
      content: (
        <div className="space-y-3">
          <PreviewImage
            src="/images/onboarding/pdf-editor.png"
            alt="PDF editor"
            fallbackIcon={<Edit className="w-10 h-10" strokeWidth={1.4} />}
            fallbackHint="Add pdf-editor.png to public/images/onboarding/"
          />
          <div className="surface px-4 py-3 flex items-center gap-2.5">
            <Pencil className="w-4 h-4 text-ink-soft shrink-0" />
            <span className="text-[13px] text-ink-soft">
              Click directly on fields in the PDF to rename
            </span>
          </div>
        </div>
      ),
    },
    {
      id: 6,
      title: 'Find any field',
      description: 'Click the eye icon next to any field to jump to it in the PDF viewer.',
      icon: <Eye className="w-5 h-5" strokeWidth={1.6} />,
      content: (
        <PreviewImage
          src="/images/onboarding/field-highlight.png"
          alt="Field highlight"
          fallbackIcon={<Eye className="w-10 h-10" strokeWidth={1.4} />}
          fallbackHint="Add field-highlight.png to public/images/onboarding/"
        />
      ),
    },
    {
      id: 7,
      title: 'Save and reuse',
      description: 'Keep PDFs with custom labels. Come back any time to fill them again.',
      icon: <Save className="w-5 h-5" strokeWidth={1.6} />,
      content: (
        <div className="space-y-2.5">
          {[
            { name: 'Residential Purchase Agreement.pdf', meta: '24/27 fields · 2h ago', progress: 0.89 },
            { name: 'W-9 Request for Taxpayer ID.pdf', meta: '8/8 fields · today', progress: 1 },
            { name: 'Standard Lease Agreement.pdf', meta: '22/22 fields · yesterday', progress: 1 },
          ].map((doc, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.05 * i }}
              className="surface-elev p-3 flex items-center gap-3"
            >
              <FileText className="w-4 h-4 text-ink-soft shrink-0" strokeWidth={1.5} />
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-medium text-ink truncate">{doc.name}</div>
                <div className="text-[11.5px] text-ink-faint">{doc.meta}</div>
              </div>
              <div className="w-20 progress shrink-0">
                <span style={{ width: `${doc.progress * 100}%` }} />
              </div>
            </motion.div>
          ))}
        </div>
      ),
    },
    {
      id: 8,
      title: 'Download the filled PDF',
      description: 'Generate a finished PDF with all your data filled in.',
      icon: <Download className="w-5 h-5" strokeWidth={1.6} />,
      content: (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="surface-elev p-6 space-y-4"
        >
          <div className="bg-paper rounded-md p-4 space-y-2 ring-1 ring-rule">
            <div className="h-1.5 border-b border-rule w-full" />
            <div className="h-1.5 border-b border-rule w-3/4" />
            <div className="bg-accent-tint border border-accent-line rounded mt-3 px-3 py-1.5 text-[12.5px] text-accent">
              Filled value
            </div>
          </div>
          <button className="btn btn-primary w-full justify-center py-2.5">
            <Download className="w-4 h-4" />
            Download PDF
          </button>
        </motion.div>
      ),
    },
  ];

  const nextSlide = () => {
    setDirection(1);
    if (currentSlide < slides.length - 1) {
      setCurrentSlide(currentSlide + 1);
    } else {
      onComplete();
    }
  };

  const prevSlide = () => {
    setDirection(-1);
    if (currentSlide > 0) setCurrentSlide(currentSlide - 1);
  };

  const goToSlide = (index: number) => {
    setDirection(index > currentSlide ? 1 : -1);
    setCurrentSlide(index);
  };

  const slideVariants = {
    enter: (d: number) => ({ x: d > 0 ? 80 : -80, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (d: number) => ({ x: d < 0 ? 80 : -80, opacity: 0 }),
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-ink/55 backdrop-blur-sm flex items-center justify-center p-4"
    >
      <motion.div
        initial={{ scale: 0.97, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-paper-card border border-rule rounded-xl shadow-2xl w-full max-w-[640px] max-h-[92vh] flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-5 hairline">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div className="w-9 h-9 rounded-md bg-accent-tint text-accent flex items-center justify-center shrink-0 mt-0.5">
              {slides[currentSlide].icon}
            </div>
            <div className="min-w-0">
              <h2 className="font-serif text-[19px] text-ink leading-tight">
                {slides[currentSlide].title}
              </h2>
              <p className="text-ink-soft text-[13.5px] mt-1">
                {slides[currentSlide].description}
              </p>
            </div>
          </div>
          <button
            onClick={onComplete}
            className="btn btn-ghost btn-sm shrink-0 ml-3"
            title="Skip tutorial"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={currentSlide}
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.2 }}
            >
              {slides[currentSlide].content}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 hairline-t bg-paper-card">
          <div className="flex items-center justify-center gap-1.5 mb-4">
            {slides.map((_, index) => (
              <button
                key={index}
                onClick={() => goToSlide(index)}
                className={`h-1.5 rounded-full transition-all ${
                  index === currentSlide
                    ? 'w-6 bg-accent'
                    : 'w-1.5 bg-rule-strong hover:bg-ink-faint'
                }`}
              />
            ))}
          </div>

          <div className="flex items-center justify-between">
            <button
              onClick={prevSlide}
              disabled={currentSlide === 0}
              className="btn btn-ghost btn-sm"
            >
              <ChevronLeft className="w-4 h-4" />
              Previous
            </button>

            <button
              onClick={onComplete}
              className="text-[13px] text-ink-faint hover:text-ink transition-colors"
            >
              Skip
            </button>

            <button onClick={nextSlide} className="btn btn-primary btn-sm">
              {currentSlide === slides.length - 1 ? 'Get started' : 'Next'}
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
