'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronRight, ChevronLeft, Upload, Sparkles, FileText, Edit, Eye, Save, Download, LogIn, Search } from 'lucide-react';

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

export default function OnboardingSlideshow({ onComplete }: OnboardingSlideshowProps) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [direction, setDirection] = useState(0);

  const slides: Slide[] = [
    {
      id: 0,
      title: 'Welcome to Document Filler',
      description: 'Automatically fill PDF forms with ease. Upload, detect fields, and generate filled documents in seconds.',
      icon: <FileText className="w-16 h-16 text-primary" />,
      content: (
        <div className="space-y-6">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="bg-gradient-to-br from-primary/20 to-primary/5 rounded-2xl p-8 border border-primary/20"
          >
            <div className="text-center space-y-4">
              <div className="text-6xl mb-4">📄</div>
              <h3 className="text-2xl font-bold text-white">Smart PDF Processing</h3>
              <p className="text-gray-400">Detect form fields automatically and create clean, organized forms</p>
            </div>
          </motion.div>
        </div>
      ),
    },
    {
      id: 1,
      title: 'Secure Authentication',
      description: 'Sign in with Google, Apple, or Email. Your documents are private and secure.',
      icon: <LogIn className="w-16 h-16 text-primary" />,
      content: (
        <div className="space-y-4">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="bg-gray-800 rounded-xl p-4 border border-gray-700 overflow-hidden"
          >
            <div className="relative w-full aspect-[4/3] rounded-lg overflow-hidden bg-gray-900">
              <img
                src="/images/onboarding/login.png"
                alt="Login screen showing Google, Apple, and Email authentication options"
                className="w-full h-full object-contain"
                onError={(e) => {
                  const img = e.currentTarget;
                  img.style.display = 'none';
                  const fallback = img.nextElementSibling as HTMLElement;
                  if (fallback) {
                    fallback.style.display = 'flex';
                  }
                }}
                onLoad={(e) => {
                  const img = e.currentTarget;
                  const fallback = img.nextElementSibling as HTMLElement;
                  if (fallback) {
                    fallback.style.display = 'none';
                  }
                }}
              />
              <div className="flex items-center justify-center h-full text-gray-500 bg-gray-800/50">
                <div className="text-center">
                  <LogIn className="w-16 h-16 mx-auto mb-4 text-gray-600" />
                  <p className="text-sm">Login screenshot</p>
                  <p className="text-xs text-gray-600 mt-2">Add login.png to public/images/onboarding/</p>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      ),
    },
    {
      id: 2,
      title: 'Upload Your PDF',
      description: 'Drag and drop or select your PDF document. The app will automatically detect all form fields.',
      icon: <Upload className="w-16 h-16 text-primary" />,
      content: (
        <div className="space-y-4">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="bg-gray-800 rounded-xl p-4 border border-gray-700 overflow-hidden"
          >
            <div className="relative w-full aspect-[4/3] rounded-lg overflow-hidden bg-gray-900">
              <img
                src="/images/onboarding/upload.png"
                alt="PDF upload interface with drag and drop area and AI labeling option"
                className="w-full h-full object-contain"
                onError={(e) => {
                  const img = e.currentTarget;
                  img.style.display = 'none';
                  const fallback = img.nextElementSibling as HTMLElement;
                  if (fallback) {
                    fallback.style.display = 'flex';
                  }
                }}
                onLoad={(e) => {
                  const img = e.currentTarget;
                  const fallback = img.nextElementSibling as HTMLElement;
                  if (fallback) {
                    fallback.style.display = 'none';
                  }
                }}
              />
              <div className="flex items-center justify-center h-full text-gray-500 bg-gray-800/50">
                <div className="text-center">
                  <Upload className="w-16 h-16 mx-auto mb-4 text-gray-600" />
                  <p className="text-sm">Upload screenshot</p>
                  <p className="text-xs text-gray-600 mt-2">Add upload.png to public/images/onboarding/</p>
                </div>
              </div>
            </div>
          </motion.div>
          <motion.div
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="bg-primary/10 rounded-lg p-4 border border-primary/30"
          >
            <div className="flex items-center gap-2 text-primary text-sm">
              <Sparkles className="w-4 h-4" />
              <span>Enable AI labeling for intelligent field names</span>
            </div>
          </motion.div>
        </div>
      ),
    },
    {
      id: 3,
      title: 'AI-Powered Label Generation',
      description: 'Optional: Let AI analyze your PDF and generate intelligent, user-friendly field labels automatically.',
      icon: <Sparkles className="w-16 h-16 text-primary" />,
      content: (
        <div className="space-y-4">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="bg-gradient-to-br from-purple-500/20 to-blue-500/20 rounded-xl p-6 border border-purple-500/30"
          >
            <div className="flex items-center gap-4 mb-4">
              <motion.div
                animate={{ rotate: [0, 360] }}
                transition={{ repeat: Infinity, duration: 3, ease: 'linear' }}
              >
                <Sparkles className="w-12 h-12 text-purple-400" />
              </motion.div>
              <div className="flex-1">
                <div className="h-4 bg-purple-500/30 rounded w-full mb-2"></div>
                <div className="h-3 bg-purple-500/20 rounded w-3/4"></div>
              </div>
            </div>
            <div className="space-y-2">
              <div className="h-3 bg-purple-500/20 rounded w-full"></div>
              <div className="h-3 bg-purple-500/20 rounded w-5/6"></div>
              <div className="h-3 bg-purple-500/20 rounded w-4/6"></div>
            </div>
          </motion.div>
          <motion.div
            initial={{ x: -20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="bg-gray-800 rounded-lg p-4 border border-gray-700"
          >
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <div className="w-2 h-2 rounded-full bg-green-500"></div>
              <span>AI analyzing document context...</span>
            </div>
          </motion.div>
        </div>
      ),
    },
    {
      id: 4,
      title: 'Organized Form Fields',
      description: 'All detected fields are sorted by document order. Fill them out in a clean, organized interface.',
      icon: <FileText className="w-16 h-16 text-primary" />,
      content: (
        <div className="space-y-4">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="bg-gray-800 rounded-xl p-4 border border-gray-700 overflow-hidden"
          >
            <div className="relative w-full aspect-[4/3] rounded-lg overflow-hidden bg-gray-900">
              <img
                src="/images/onboarding/form-fields.png"
                alt="Form interface showing organized fields with labels and input boxes"
                className="w-full h-full object-contain"
                onError={(e) => {
                  const img = e.currentTarget;
                  img.style.display = 'none';
                  const fallback = img.nextElementSibling as HTMLElement;
                  if (fallback) {
                    fallback.style.display = 'flex';
                  }
                }}
                onLoad={(e) => {
                  const img = e.currentTarget;
                  const fallback = img.nextElementSibling as HTMLElement;
                  if (fallback) {
                    fallback.style.display = 'none';
                  }
                }}
              />
              <div className="flex items-center justify-center h-full text-gray-500 bg-gray-800/50">
                <div className="text-center">
                  <FileText className="w-16 h-16 mx-auto mb-4 text-gray-600" />
                  <p className="text-sm">Form fields screenshot</p>
                  <p className="text-xs text-gray-600 mt-2">Add form-fields.png to public/images/onboarding/</p>
                </div>
              </div>
            </div>
          </motion.div>
          <motion.div
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="bg-primary/10 rounded-lg p-4 border border-primary/30"
          >
            <div className="flex items-center gap-2 text-primary text-sm">
              <div className="w-2 h-2 rounded-full bg-primary animate-pulse"></div>
              <span>172 fields detected and sorted by document order</span>
            </div>
          </motion.div>
        </div>
      ),
    },
    {
      id: 5,
      title: 'Edit Field Labels',
      description: 'Click "Edit Labels" to view your PDF and customize field names. Click directly on fields to edit them.',
      icon: <Edit className="w-16 h-16 text-primary" />,
      content: (
        <div className="space-y-4">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="bg-gray-800 rounded-xl p-4 border border-gray-700 overflow-hidden"
          >
            <div className="relative w-full aspect-[4/3] rounded-lg overflow-hidden bg-gray-900">
              <img
                src="/images/onboarding/pdf-editor.png"
                alt="PDF viewer with field overlays showing editable labels"
                className="w-full h-full object-contain"
                onError={(e) => {
                  const img = e.currentTarget;
                  img.style.display = 'none';
                  const fallback = img.nextElementSibling as HTMLElement;
                  if (fallback) {
                    fallback.style.display = 'flex';
                  }
                }}
                onLoad={(e) => {
                  const img = e.currentTarget;
                  const fallback = img.nextElementSibling as HTMLElement;
                  if (fallback) {
                    fallback.style.display = 'none';
                  }
                }}
              />
              <div className="flex items-center justify-center h-full text-gray-500 bg-gray-800/50">
                <div className="text-center">
                  <Edit className="w-16 h-16 mx-auto mb-4 text-gray-600" />
                  <p className="text-sm">PDF editor screenshot</p>
                  <p className="text-xs text-gray-600 mt-2">Add pdf-editor.png to public/images/onboarding/</p>
                </div>
              </div>
            </div>
          </motion.div>
          <motion.div
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="bg-primary/10 rounded-lg p-4 border border-primary/30"
          >
            <div className="flex items-center gap-2 text-primary text-sm">
              <Edit className="w-4 h-4" />
              <span>Click directly on fields in the PDF to edit their labels</span>
            </div>
          </motion.div>
        </div>
      ),
    },
    {
      id: 6,
      title: 'Find Fields in PDF',
      description: 'Click the eye icon next to any field to instantly locate it in the PDF viewer with automatic highlighting.',
      icon: <Eye className="w-16 h-16 text-primary" />,
      content: (
        <div className="space-y-4">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="bg-gray-800 rounded-xl p-4 border border-gray-700 overflow-hidden"
          >
            <div className="relative w-full aspect-[4/3] rounded-lg overflow-hidden bg-gray-900">
              <img
                src="/images/onboarding/field-highlight.png"
                alt="Form field with eye icon showing the highlight feature"
                className="w-full h-full object-contain"
                onError={(e) => {
                  const img = e.currentTarget;
                  img.style.display = 'none';
                  const fallback = img.nextElementSibling as HTMLElement;
                  if (fallback) {
                    fallback.style.display = 'flex';
                  }
                }}
                onLoad={(e) => {
                  const img = e.currentTarget;
                  const fallback = img.nextElementSibling as HTMLElement;
                  if (fallback) {
                    fallback.style.display = 'none';
                  }
                }}
              />
              <div className="flex items-center justify-center h-full text-gray-500 bg-gray-800/50">
                <div className="text-center">
                  <Eye className="w-16 h-16 mx-auto mb-4 text-gray-600" />
                  <p className="text-sm">Field highlight screenshot</p>
                  <p className="text-xs text-gray-600 mt-2">Add field-highlight.png to public/images/onboarding/</p>
                </div>
              </div>
            </div>
          </motion.div>
          <motion.div
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="bg-green-500/10 rounded-lg p-4 border border-green-500/30"
          >
            <div className="flex items-center gap-2 text-green-400 text-sm">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
              <span>Field automatically highlighted and scrolled into view in PDF</span>
            </div>
          </motion.div>
        </div>
      ),
    },
    {
      id: 7,
      title: 'Save & Reuse Documents',
      description: 'Save your PDFs with custom field labels. Access them anytime to fill out multiple times.',
      icon: <Save className="w-16 h-16 text-primary" />,
      content: (
        <div className="space-y-4">
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="bg-gray-800 rounded-xl p-6 border border-gray-700"
          >
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <motion.div
                  key={i}
                  initial={{ x: -20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: 0.1 * i }}
                  className="flex items-center gap-4 p-3 bg-gray-700/50 rounded-lg hover:bg-gray-700 transition-colors"
                >
                  <FileText className="w-8 h-8 text-gray-400" />
                  <div className="flex-1">
                    <div className="h-3 bg-gray-600 rounded w-40 mb-2"></div>
                    <div className="h-2 bg-gray-600 rounded w-24"></div>
                  </div>
                  <div className="text-xs text-gray-500">172 fields</div>
                </motion.div>
              ))}
            </div>
          </motion.div>
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="bg-primary/10 rounded-lg p-4 border border-primary/30"
          >
            <div className="flex items-center gap-2 text-primary text-sm">
              <Save className="w-4 h-4" />
              <span>Your documents are saved securely in the cloud</span>
            </div>
          </motion.div>
        </div>
      ),
    },
    {
      id: 8,
      title: 'Generate Filled PDF',
      description: 'Once you\'ve filled out the form, generate a completed PDF with all your data filled in.',
      icon: <Download className="w-16 h-16 text-primary" />,
      content: (
        <div className="space-y-4">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="bg-gray-800 rounded-xl p-6 border border-gray-700"
          >
            <div className="space-y-4">
              <div className="bg-white rounded p-4">
                <div className="space-y-2">
                  <div className="h-2 bg-gray-300 rounded w-full"></div>
                  <div className="h-2 bg-gray-300 rounded w-3/4"></div>
                  <div className="h-8 bg-gray-200 rounded mt-4 border border-gray-300">
                    <div className="h-full bg-blue-500/20 flex items-center px-3">
                      <span className="text-sm text-gray-700">Filled Value</span>
                    </div>
                  </div>
                </div>
              </div>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="w-full bg-primary hover:bg-primary-hover text-white py-3 rounded-lg flex items-center justify-center gap-2 font-medium"
              >
                <Download className="w-5 h-5" />
                Generate PDF
              </motion.button>
            </div>
          </motion.div>
          <motion.div
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="bg-green-500/10 rounded-lg p-4 border border-green-500/30"
          >
            <div className="flex items-center gap-2 text-green-400 text-sm">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
              <span>PDF generated and ready to download</span>
            </div>
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
      x: direction > 0 ? 300 : -300,
      opacity: 0,
    }),
    center: {
      x: 0,
      opacity: 1,
    },
    exit: (direction: number) => ({
      x: direction < 0 ? 300 : -300,
      opacity: 0,
    }),
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4"
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-gray-900 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col border border-gray-800"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-800">
          <div className="flex items-center gap-3">
            {slides[currentSlide].icon}
            <div>
              <h2 className="text-2xl font-bold text-white">{slides[currentSlide].title}</h2>
              <p className="text-sm text-gray-400 mt-1">{slides[currentSlide].description}</p>
            </div>
          </div>
          <button
            onClick={onComplete}
            className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-400 hover:text-white" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden p-8">
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={currentSlide}
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.3 }}
              className="h-full"
            >
              {slides[currentSlide].content}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-800">
          {/* Progress dots */}
          <div className="flex items-center justify-center gap-2 mb-6">
            {slides.map((_, index) => (
              <button
                key={index}
                onClick={() => goToSlide(index)}
                className={`h-2 rounded-full transition-all ${
                  index === currentSlide
                    ? 'w-8 bg-primary'
                    : 'w-2 bg-gray-700 hover:bg-gray-600'
                }`}
              />
            ))}
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between">
            <button
              onClick={prevSlide}
              disabled={currentSlide === 0}
              className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-5 h-5" />
              Previous
            </button>

            <button
              onClick={onComplete}
              className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
            >
              Skip
            </button>

            <button
              onClick={nextSlide}
              className="flex items-center gap-2 px-6 py-2 bg-primary hover:bg-primary-hover text-white rounded-lg transition-colors font-medium"
            >
              {currentSlide === slides.length - 1 ? 'Get Started' : 'Next'}
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
