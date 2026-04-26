'use client';

import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { motion } from 'framer-motion';
import { ArrowUp, FileText, X } from 'lucide-react';

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
    accept: { 'application/pdf': ['.pdf'] },
    maxFiles: 1,
    onDragEnter: () => setIsDragging(true),
    onDragLeave: () => setIsDragging(false),
  });

  if (selectedFile) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        className="surface-elev p-4 flex items-center gap-3"
      >
        <div className="w-9 h-9 rounded-md bg-accent-tint flex items-center justify-center shrink-0">
          <FileText className="w-4.5 h-4.5 text-accent" strokeWidth={1.5} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-[14px] text-ink truncate">{selectedFile.name}</p>
          <p className="text-[12.5px] text-ink-faint">
            {(selectedFile.size / 1024 / 1024).toFixed(2)} MB · ready
          </p>
        </div>
        {onRemove && (
          <button onClick={onRemove} className="btn btn-ghost btn-sm" title="Remove file">
            <X className="w-4 h-4" />
          </button>
        )}
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
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      {...motionProps}
      className="dropzone"
      data-dragging={isDragActive || isDragging}
    >
      <input {...getInputProps()} />
      {/* Arrow tile — bounces on hover, sparkles twinkle around it */}
      <div className="co-sparkle inline-flex items-center justify-center w-12 h-12 rounded-full bg-paper-edge mb-3">
        <ArrowUp
          className="co-ico co-ico-bounce w-5 h-5 text-ink-soft"
          strokeWidth={1.6}
        />
      </div>
      <p className="text-[15px] text-ink mb-1">
        {isDragActive ? (
          'Drop it here'
        ) : (
          <>
            Drop a PDF here, or{' '}
            <span className="text-accent underline underline-offset-2 decoration-accent/40">
              browse files
            </span>
          </>
        )}
      </p>
      <p className="text-[12.5px] text-ink-faint">PDF only · up to 50 MB</p>
    </motion.div>
  );
}
