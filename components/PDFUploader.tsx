'use client';

import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { motion } from 'framer-motion';
import { Upload, FileText, X } from 'lucide-react';

interface PDFUploaderProps {
  onFileSelect: (file: File) => void;
  selectedFile?: File | null;
  onRemove?: () => void;
}

export default function PDFUploader({ onFileSelect, selectedFile, onRemove }: PDFUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      if (file && file.type === 'application/pdf') {
        onFileSelect(file);
      }
    },
    [onFileSelect]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
    },
    maxFiles: 1,
    onDragEnter: () => setIsDragging(true),
    onDragLeave: () => setIsDragging(false),
  });

  if (selectedFile) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        className="card-paper p-5 relative"
      >
        <div className="tape" style={{ top: '-10px', left: '50%', marginLeft: '-35px' }} />
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-md border-[1.5px] border-ink bg-accent-yellow flex items-center justify-center shadow-rough rotate-tiny-l">
            <FileText className="w-6 h-6 text-ink" strokeWidth={2} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-marker text-lg text-ink truncate">{selectedFile.name}</p>
            <p className="font-cursive text-base text-ink-soft">
              {(selectedFile.size / 1024 / 1024).toFixed(2)} MB &middot; ready
            </p>
          </div>
          {onRemove && (
            <button
              onClick={onRemove}
              className="btn-rough"
              title="Remove file"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </motion.div>
    );
  }

  const rootProps = getRootProps();
  const {
    onAnimationStart,
    onAnimationEnd,
    onDragStart,
    onDrag,
    onDragEnd,
    ...motionProps
  } = rootProps;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      {...motionProps}
      className={`relative p-12 cursor-pointer transition-all duration-200 rough bg-white ${
        isDragActive || isDragging
          ? 'shadow-rough-xl -translate-x-1 -translate-y-1 bg-accent-yellow/30'
          : 'hover:shadow-rough-lg hover:-translate-x-0.5 hover:-translate-y-0.5'
      }`}
      style={{
        backgroundImage: `repeating-linear-gradient(135deg, rgba(0,0,0,.04) 0 4px, transparent 4px 14px)`,
      }}
    >
      <input {...getInputProps()} />
      <div className="text-center">
        <motion.div
          animate={isDragActive ? { scale: 1.15, rotate: -8 } : { scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 300 }}
          className="inline-block mb-4"
        >
          <div className="w-20 h-20 mx-auto rounded-full border-[1.5px] border-ink bg-accent-yellow flex items-center justify-center shadow-rough">
            <Upload className="w-10 h-10 text-ink" strokeWidth={2} />
          </div>
        </motion.div>
        <p className="font-marker text-2xl text-ink mb-2">
          {isDragActive ? 'drop it here!' : 'Drag & drop a PDF'}
        </p>
        <p className="font-cursive text-lg text-ink-soft mb-1">
          or click to browse your files
        </p>
        <p className="font-typewriter text-[10px] text-ink-faint uppercase tracking-widest mt-3">
          [ PDF files only ]
        </p>
      </div>
    </motion.div>
  );
}
