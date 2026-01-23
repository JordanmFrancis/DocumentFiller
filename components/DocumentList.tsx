'use client';

import { motion } from 'framer-motion';
import { PDFDocument } from '@/types/pdf';
import { FileText, Trash2, Edit } from 'lucide-react';

interface DocumentListProps {
  documents: PDFDocument[];
  onSelect: (document: PDFDocument) => void;
  onDelete: (documentId: string) => void;
  loading?: boolean;
}

export default function DocumentList({
  documents,
  onSelect,
  onDelete,
  loading,
}: DocumentListProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-32 bg-gray-800/50 rounded-xl animate-pulse"
          />
        ))}
      </div>
    );
  }

  if (documents.length === 0) {
    return (
      <div className="text-center py-12">
        <FileText className="w-12 h-12 text-gray-600 mx-auto mb-4" />
        <p className="text-gray-400">No documents yet</p>
        <p className="text-gray-500 text-sm mt-2">Upload your first PDF to get started</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {documents.map((doc, index) => (
        <motion.div
          key={doc.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.1 }}
          whileHover={{ scale: 1.02, y: -4 }}
          className="bg-gray-800/50 backdrop-blur-xl rounded-xl border border-gray-700/50 p-6 cursor-pointer hover:border-primary/50 transition-all"
          onClick={() => onSelect(doc)}
        >
          <div className="flex items-start justify-between mb-4">
            <div className="p-2 bg-primary/20 rounded-lg">
              <FileText className="w-5 h-5 text-primary" />
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(doc.id);
              }}
              className="p-2 hover:bg-red-500/20 rounded-lg transition-colors"
            >
              <Trash2 className="w-4 h-4 text-red-400" />
            </button>
          </div>
          <h3 className="text-white font-medium mb-2 line-clamp-2">{doc.name}</h3>
          <p className="text-gray-400 text-sm">
            {doc.fieldDefinitions.length} field{doc.fieldDefinitions.length !== 1 ? 's' : ''}
          </p>
          <p className="text-gray-500 text-xs mt-2">
            {new Date(doc.updatedAt).toLocaleDateString()}
          </p>
        </motion.div>
      ))}
    </div>
  );
}
