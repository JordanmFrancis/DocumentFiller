'use client';

import { motion } from 'framer-motion';
import { PDFDocument } from '@/types/pdf';
import { FileText, Trash2 } from 'lucide-react';

interface DocumentListProps {
  documents: PDFDocument[];
  onSelect: (document: PDFDocument) => void;
  onDelete: (documentId: string) => void;
  loading?: boolean;
}

// Slight rotation per card so they look casually dropped on the desk
const ROTATIONS = ['-1.5deg', '0.8deg', '-0.5deg', '1.2deg', '-1deg', '0.6deg'];

export default function DocumentList({
  documents,
  onSelect,
  onDelete,
  loading,
}: DocumentListProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-44 rough animate-pulse bg-white/60"
            style={{ transform: `rotate(${ROTATIONS[i % ROTATIONS.length]})` }}
          />
        ))}
      </div>
    );
  }

  if (documents.length === 0) {
    return (
      <div className="relative max-w-xl mx-auto py-16 text-center">
        <div className="rough bg-white p-10 inline-block rotate-tiny-l">
          <FileText className="w-12 h-12 text-ink-soft mx-auto mb-4" strokeWidth={1.5} />
          <p className="font-marker text-2xl text-ink mb-2">No documents yet</p>
          <p className="font-cursive text-lg text-ink-soft">
            upload your first PDF to get started
          </p>
        </div>
        <div className="sticky-note absolute -right-8 top-4 hidden md:block w-48 rotate-small-r">
          <span className="text-base">
            ↖ click "New Document" up there to begin!
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 pt-4">
      {documents.map((doc, index) => {
        const rotation = ROTATIONS[index % ROTATIONS.length];
        return (
          <motion.div
            key={doc.id}
            initial={{ opacity: 0, y: 20, rotate: 0 }}
            animate={{ opacity: 1, y: 0, rotate: rotation }}
            transition={{ delay: index * 0.05 }}
            whileHover={{ y: -6, rotate: 0, scale: 1.02 }}
            className="card-paper p-5 cursor-pointer relative"
            onClick={() => onSelect(doc)}
            style={{ transformOrigin: 'center top' }}
          >
            {/* Tape accent on every other card */}
            {index % 2 === 0 && (
              <div
                className="tape"
                style={{ top: '-10px', left: '20px' }}
              />
            )}
            {index % 3 === 0 && (
              <div
                className="tape tape-blue"
                style={{ top: '-10px', right: '24px', transform: 'rotate(5deg)' }}
              />
            )}

            <div className="flex items-start justify-between mb-4">
              <div className="w-10 h-10 rounded-md border-[1.5px] border-ink bg-accent-yellow flex items-center justify-center shadow-rough">
                <FileText className="w-5 h-5 text-ink" strokeWidth={2} />
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(doc.id);
                }}
                className="p-1.5 hover:bg-accent-coral/30 rounded-md border-[1.5px] border-transparent hover:border-ink transition-colors"
                title="Delete document"
              >
                <Trash2 className="w-4 h-4 text-ink-soft hover:text-ink" />
              </button>
            </div>

            <h3 className="font-marker text-lg text-ink mb-2 line-clamp-2 leading-tight">
              {doc.name}
            </h3>

            <div className="flex items-center justify-between mt-3 pt-3 border-t border-dashed border-ink/30">
              <span className="font-cursive text-base text-ink-soft">
                {doc.fieldDefinitions.length} field
                {doc.fieldDefinitions.length !== 1 ? 's' : ''}
              </span>
              <span className="font-typewriter text-[10px] text-ink-faint uppercase">
                {new Date(doc.updatedAt).toLocaleDateString()}
              </span>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
