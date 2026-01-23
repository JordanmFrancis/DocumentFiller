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
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative p-6 bg-gray-800/50 backdrop-blur-xl rounded-xl border border-gray-700/50"
      >
        <div className="flex items-center gap-4">
          <div className="p-3 bg-primary/20 rounded-lg">
            <FileText className="w-6 h-6 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white font-medium truncate">{selectedFile.name}</p>
            <p className="text-gray-400 text-sm">
              {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
            </p>
          </div>
          {onRemove && (
            <button
              onClick={onRemove}
              className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-400 hover:text-white" />
            </button>
          )}
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      {...getRootProps()}
      className={`
        relative p-12 border-2 border-dashed rounded-xl cursor-pointer
        transition-all duration-300
        ${
          isDragActive || isDragging
            ? 'border-primary bg-primary/10 scale-105'
            : 'border-gray-700 bg-gray-800/30 hover:border-gray-600 hover:bg-gray-800/50'
        }
      `}
    >
      <input {...getInputProps()} />
      <div className="text-center">
        <motion.div
          animate={isDragActive ? { scale: 1.1, rotate: 5 } : { scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 300 }}
          className="inline-block mb-4"
        >
          <Upload className="w-12 h-12 text-gray-400 mx-auto" />
        </motion.div>
        <p className="text-white font-medium mb-2">
          {isDragActive ? 'Drop your PDF here' : 'Drag & drop a PDF file'}
        </p>
        <p className="text-gray-400 text-sm">or click to browse</p>
        <p className="text-gray-500 text-xs mt-2">PDF files only</p>
      </div>
    </motion.div>
  );
}
