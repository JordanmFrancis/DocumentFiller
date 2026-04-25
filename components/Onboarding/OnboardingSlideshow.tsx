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

// Helper: image-with-fallback that matches the paper aesthetic
function PaperImage({ src, alt, fallbackIcon, fallbackHint }: {
  src: string;
  alt: string;
  fallbackIcon: React.ReactNode;
  fallbackHint: string;
}) {
  return (
    <motion.div
      initial={{ scale: 0.96, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ delay: 0.2 }}
      className="rough p-3 bg-white relative"
    >
      <div className="tape" style={{ top: '-10px', left: '20px' }} />
      <div className="relative w-full aspect-[4/3] rounded overflow-hidden bg-paper-indexcard">
        <img
          src={src}
          alt={alt}
          className="w-full h-full object-contain"
          onError={(e) => {
            const img = e.currentTarget;
            img.style.display = 'none';
            const fallback = img.nextElementSibling as HTMLElement;
            if (fallback) fallback.style.display = 'flex';
          }}
          onLoad={(e) => {
            const img = e.currentTarget;
            const fallback = img.nextElementSibling as HTMLElement;
            if (fallback) fallback.style.display = 'none';
          }}
        />
        <div className="ph-img absolute inset-0 flex-col">
          <div className="text-ink mb-3">{fallbackIcon}</div>
          <p className="font-cursive text-base text-ink-soft">{fallbackHint}</p>
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
      title: 'Welcome to Document Filler',
      description: 'Upload, fill, download — like filling out a paper form, but on screen.',
      icon: <FileText className="w-12 h-12 text-ink" strokeWidth={1.5} />,
      content: (
        <div className="space-y-4">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.4 }}
            className="rough bg-paper-legalpad p-10 text-center relative"
          >
            <div className="tape tape-pink" style={{ top: '-12px', left: '50%', marginLeft: '-35px' }} />
            <div className="text-7xl mb-4">📄</div>
            <h3 className="font-marker text-2xl text-ink mb-2">Smart PDF Processing</h3>
            <p className="font-cursive text-lg text-ink-soft">
              detect form fields, fill them in, download the finished file
            </p>
          </motion.div>
        </div>
      ),
    },
    {
      id: 1,
      title: 'Secure Sign-in',
      description: 'Sign in with Google, Apple, or Email. Your documents are private.',
      icon: <LogIn className="w-12 h-12 text-ink" strokeWidth={1.5} />,
      content: (
        <PaperImage
          src="/images/onboarding/login.png"
          alt="Login screen"
          fallbackIcon={<LogIn className="w-12 h-12" />}
          fallbackHint="add login.png to public/images/onboarding/"
        />
      ),
    },
    {
      id: 2,
      title: 'Upload Your PDF',
      description: 'Drop a PDF — the app finds form fields automatically.',
      icon: <Upload className="w-12 h-12 text-ink" strokeWidth={1.5} />,
      content: (
        <div className="space-y-4">
          <PaperImage
            src="/images/onboarding/upload.png"
            alt="Upload screen"
            fallbackIcon={<Upload className="w-12 h-12" />}
            fallbackHint="add upload.png to public/images/onboarding/"
          />
          <motion.div
            initial={{ y: 8, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="rough-sm bg-accent-yellow/40 p-3 flex items-center gap-2"
          >
            <Sparkles className="w-4 h-4 text-ink" />
            <span className="font-marker text-sm text-ink">
              enable AI labeling for smart field names
            </span>
          </motion.div>
        </div>
      ),
    },
    {
      id: 3,
      title: 'AI-Powered Labels',
      description: 'Optional: let AI generate friendly field labels from PDF context.',
      icon: <Sparkles className="w-12 h-12 text-ink" strokeWidth={1.5} />,
      content: (
        <div className="space-y-4">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="rough bg-white p-6 relative"
          >
            <div className="flex items-center gap-4 mb-4">
              <motion.div
                animate={{ rotate: [0, 360] }}
                transition={{ repeat: Infinity, duration: 4, ease: 'linear' }}
              >
                <Sparkles className="w-10 h-10 text-ink" />
              </motion.div>
              <div className="flex-1 space-y-2">
                <div className="h-3 bg-accent-yellow/60 rounded-full w-full"></div>
                <div className="h-2.5 bg-accent-yellow/40 rounded-full w-3/4"></div>
              </div>
            </div>
            <div className="space-y-2">
              <div className="h-2 border-b border-dashed border-ink/30 w-full"></div>
              <div className="h-2 border-b border-dashed border-ink/30 w-5/6"></div>
              <div className="h-2 border-b border-dashed border-ink/30 w-4/6"></div>
            </div>
          </motion.div>
          <motion.div
            initial={{ x: -10, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="rough-sm p-3 bg-accent-mint/30 flex items-center gap-2"
          >
            <div className="w-2 h-2 rounded-full bg-accent-mint border border-ink animate-pulse"></div>
            <span className="font-marker text-sm text-ink">
              AI analyzing document context…
            </span>
          </motion.div>
        </div>
      ),
    },
    {
      id: 4,
      title: 'Organized Form Fields',
      description: 'All detected fields are sorted by document order. Fill them out neatly.',
      icon: <FileText className="w-12 h-12 text-ink" strokeWidth={1.5} />,
      content: (
        <div className="space-y-4">
          <PaperImage
            src="/images/onboarding/form-fields.png"
            alt="Form interface"
            fallbackIcon={<FileText className="w-12 h-12" />}
            fallbackHint="add form-fields.png to public/images/onboarding/"
          />
          <motion.div
            initial={{ y: 8, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="rough-sm p-3 bg-accent-yellow/30 flex items-center gap-2"
          >
            <div className="w-2 h-2 rounded-full bg-accent-mint border border-ink animate-pulse"></div>
            <span className="font-marker text-sm text-ink">
              fields sorted by document order
            </span>
          </motion.div>
        </div>
      ),
    },
    {
      id: 5,
      title: 'Edit Field Labels',
      description: 'Click any label to rename it, or open the PDF viewer to edit visually.',
      icon: <Edit className="w-12 h-12 text-ink" strokeWidth={1.5} />,
      content: (
        <div className="space-y-4">
          <PaperImage
            src="/images/onboarding/pdf-editor.png"
            alt="PDF editor with field overlays"
            fallbackIcon={<Edit className="w-12 h-12" />}
            fallbackHint="add pdf-editor.png to public/images/onboarding/"
          />
          <motion.div
            initial={{ y: 8, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="rough-sm p-3 bg-accent-yellow/30 flex items-center gap-2"
          >
            <Pencil className="w-4 h-4 text-ink" />
            <span className="font-marker text-sm text-ink">
              click directly on fields in the PDF to rename
            </span>
          </motion.div>
        </div>
      ),
    },
    {
      id: 6,
      title: 'Find Fields in PDF',
      description: 'Click the eye icon next to any field to jump to it in the PDF viewer.',
      icon: <Eye className="w-12 h-12 text-ink" strokeWidth={1.5} />,
      content: (
        <div className="space-y-4">
          <PaperImage
            src="/images/onboarding/field-highlight.png"
            alt="Highlighted field"
            fallbackIcon={<Eye className="w-12 h-12" />}
            fallbackHint="add field-highlight.png to public/images/onboarding/"
          />
          <motion.div
            initial={{ y: 8, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="rough-sm p-3 bg-accent-mint/30 flex items-center gap-2"
          >
            <div className="w-2 h-2 rounded-full bg-accent-mint border border-ink animate-pulse"></div>
            <span className="font-marker text-sm text-ink">
              field highlighted &amp; scrolled into view
            </span>
          </motion.div>
        </div>
      ),
    },
    {
      id: 7,
      title: 'Save & Reuse',
      description: 'Save PDFs with custom labels. Come back any time to fill them out again.',
      icon: <Save className="w-12 h-12 text-ink" strokeWidth={1.5} />,
      content: (
        <div className="space-y-4">
          <motion.div
            initial={{ y: 12, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="rough bg-white p-5 relative"
          >
            <div className="tape" style={{ top: '-10px', left: '24px' }} />
            <div className="space-y-2.5">
              {[1, 2, 3].map((i) => (
                <motion.div
                  key={i}
                  initial={{ x: -16, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: 0.1 * i }}
                  className="flex items-center gap-3 p-3 rough-sm bg-paper-legalpad"
                >
                  <FileText className="w-7 h-7 text-ink" strokeWidth={1.5} />
                  <div className="flex-1">
                    <div className="font-marker text-sm text-ink">document_{i}.pdf</div>
                    <div className="font-cursive text-xs text-ink-soft">edited yesterday</div>
                  </div>
                  <span className="font-typewriter text-[10px] text-ink-faint uppercase">
                    {172 - i * 12} fields
                  </span>
                </motion.div>
              ))}
            </div>
          </motion.div>
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="rough-sm p-3 bg-accent-yellow/30 flex items-center gap-2"
          >
            <Save className="w-4 h-4 text-ink" />
            <span className="font-marker text-sm text-ink">
              saved securely in the cloud
            </span>
          </motion.div>
        </div>
      ),
    },
    {
      id: 8,
      title: 'Generate Filled PDF',
      description: 'When you\'re ready, generate a completed PDF with all your data filled in.',
      icon: <Download className="w-12 h-12 text-ink" strokeWidth={1.5} />,
      content: (
        <div className="space-y-4">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="rough bg-white p-5 relative"
          >
            <div className="space-y-3 mb-4">
              <div className="bg-paper-legalpad rounded p-4">
                <div className="space-y-2">
                  <div className="h-2 border-b border-dashed border-ink/40 w-full"></div>
                  <div className="h-2 border-b border-dashed border-ink/40 w-3/4"></div>
                  <div className="rough-sm bg-accent-yellow/30 mt-3 px-3 py-2">
                    <span className="font-cursive text-base text-ink">filled value</span>
                  </div>
                </div>
              </div>
            </div>
            <motion.div
              whileHover={{ scale: 1.02 }}
              className="btn-rough primary w-full justify-center py-3"
            >
              <Download className="w-5 h-5" />
              Generate PDF
            </motion.div>
          </motion.div>
          <motion.div
            initial={{ y: 8, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="rough-sm p-3 bg-accent-mint/30 flex items-center gap-2"
          >
            <div className="w-2 h-2 rounded-full bg-accent-mint border border-ink animate-pulse"></div>
            <span className="font-marker text-sm text-ink">
              PDF generated and ready to download
            </span>
          </motion.div>
        </div>
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
    if (currentSlide > 0) {
      setCurrentSlide(currentSlide - 1);
    }
  };

  const goToSlide = (index: number) => {
    setDirection(index > currentSlide ? 1 : -1);
    setCurrentSlide(index);
  };

  const slideVariants = {
    enter: (direction: number) => ({
      x: direction > 0 ? 200 : -200,
      opacity: 0,
    }),
    center: { x: 0, opacity: 1 },
    exit: (direction: number) => ({
      x: direction < 0 ? 200 : -200,
      opacity: 0,
    }),
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-ink/70 backdrop-blur-sm flex items-center justify-center p-4"
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0, rotate: -1 }}
        animate={{ scale: 1, opacity: 1, rotate: 0 }}
        className="bg-paper border-2 border-ink rounded-lg shadow-rough-xl w-full max-w-3xl max-h-[92vh] flex flex-col relative"
      >
        {/* Tape on top */}
        <div className="tape" style={{ top: '-12px', left: '50%', marginLeft: '-35px', zIndex: 10 }} />

        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b-2 border-ink">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="w-12 h-12 rounded-md border-[1.5px] border-ink bg-accent-yellow flex items-center justify-center shadow-rough rotate-tiny-l shrink-0">
              {slides[currentSlide].icon}
            </div>
            <div className="min-w-0">
              <h2 className="font-marker text-xl text-ink leading-tight squig inline-block">
                {slides[currentSlide].title}
              </h2>
              <p className="font-cursive text-base text-ink-soft mt-1.5">
                {slides[currentSlide].description}
              </p>
            </div>
          </div>
          <button
            onClick={onComplete}
            className="btn-rough shrink-0 ml-4"
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
              transition={{ duration: 0.25 }}
            >
              {slides[currentSlide].content}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="p-5 border-t-2 border-ink bg-paper">
          {/* Progress dots */}
          <div className="flex items-center justify-center gap-1.5 mb-4">
            {slides.map((_, index) => (
              <button
                key={index}
                onClick={() => goToSlide(index)}
                className={`h-2.5 rounded-full transition-all border border-ink ${
                  index === currentSlide
                    ? 'w-8 bg-accent-yellow'
                    : 'w-2.5 bg-white hover:bg-accent-yellow/30'
                }`}
              />
            ))}
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between">
            <button
              onClick={prevSlide}
              disabled={currentSlide === 0}
              className="btn-rough"
            >
              <ChevronLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Previous</span>
            </button>

            <button
              onClick={onComplete}
              className="font-cursive text-base text-ink-soft hover:text-ink underline decoration-dashed underline-offset-4"
            >
              Skip
            </button>

            <button
              onClick={nextSlide}
              className="btn-rough primary"
            >
              {currentSlide === slides.length - 1 ? 'Get Started' : 'Next'}
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
