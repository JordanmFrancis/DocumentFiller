'use client';

import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { PDFDocument } from '@/types/pdf';
import { FileText, Trash2, Grid3x3, List as ListIcon } from 'lucide-react';

interface DocumentListProps {
  documents: PDFDocument[];
  onSelect: (document: PDFDocument) => void;
  onDelete: (documentId: string) => void;
  loading?: boolean;
}

type FilterId = 'all' | 'ready' | 'in-progress' | 'draft';
type ViewMode = 'grid' | 'list';

// Crude heuristic until per-doc state is tracked. Documents with no fields
// → draft. Once fields are detected → in-progress until the user has filled
// at least 1 (we don't track that yet, so we treat them all as ready).
function classifyDoc(doc: PDFDocument): { state: FilterId; progress: number; tone: 'ok' | 'warning' | 'muted' } {
  const fieldCount = doc.fieldDefinitions.length;
  if (fieldCount === 0) return { state: 'draft', progress: 0, tone: 'muted' };
  // Pretend we have progress; right now we always show "ready" once fields exist.
  return { state: 'ready', progress: 1, tone: 'ok' };
}

function formatRelativeTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '';
  const diffMs = Date.now() - d.getTime();
  const minutes = Math.floor(diffMs / 60_000);
  const hours = Math.floor(diffMs / 3_600_000);
  const days = Math.floor(diffMs / 86_400_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

const FILTERS: { id: FilterId; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'ready', label: 'Ready' },
  { id: 'in-progress', label: 'In progress' },
  { id: 'draft', label: 'Draft' },
];

export default function DocumentList({
  documents,
  onSelect,
  onDelete,
  loading,
}: DocumentListProps) {
  const [filter, setFilter] = useState<FilterId>('all');
  const [view, setView] = useState<ViewMode>('grid');

  const filtered = useMemo(() => {
    if (filter === 'all') return documents;
    return documents.filter((d) => classifyDoc(d).state === filter);
  }, [documents, filter]);

  if (loading) {
    return (
      <div>
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-1">
            {FILTERS.map((f) => (
              <span key={f.id} className="tab-pill" data-active={f.id === 'all'}>
                {f.label}
              </span>
            ))}
          </div>
          <div className="h-7 w-16 surface" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="surface-elev h-[124px] animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Filter row */}
      <div className="flex items-center justify-between mb-5 gap-4 flex-wrap">
        <div className="flex items-center gap-1 flex-wrap">
          {FILTERS.map((f) => {
            const count =
              f.id === 'all'
                ? documents.length
                : documents.filter((d) => classifyDoc(d).state === f.id).length;
            return (
              <button
                key={f.id}
                className="tab-pill"
                data-active={filter === f.id}
                onClick={() => setFilter(f.id)}
              >
                {f.label}
                {count > 0 && (
                  <span className="text-ink-faint text-[11.5px] ml-1">{count}</span>
                )}
              </button>
            );
          })}
        </div>

        {/* View toggle */}
        <div className="surface flex p-0.5">
          <button
            className={`px-2 py-1 rounded-md transition-colors ${
              view === 'grid' ? 'bg-paper-edge text-ink' : 'text-ink-faint hover:text-ink'
            }`}
            onClick={() => setView('grid')}
            title="Grid view"
          >
            <Grid3x3 className="w-4 h-4" />
          </button>
          <button
            className={`px-2 py-1 rounded-md transition-colors ${
              view === 'list' ? 'bg-paper-edge text-ink' : 'text-ink-faint hover:text-ink'
            }`}
            onClick={() => setView('list')}
            title="List view"
          >
            <ListIcon className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Empty state */}
      {filtered.length === 0 && (
        <div className="surface py-16 text-center">
          <FileText className="w-10 h-10 text-ink-muted mx-auto mb-3" strokeWidth={1.4} />
          <p className="font-serif text-xl text-ink mb-1">
            {filter === 'all' ? 'No documents yet' : `No ${filter.replace('-', ' ')} documents`}
          </p>
          <p className="text-ink-faint text-sm">
            {filter === 'all'
              ? 'Upload your first PDF to get started.'
              : 'Try a different filter.'}
          </p>
        </div>
      )}

      {/* Grid view */}
      {filtered.length > 0 && view === 'grid' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((doc, index) => {
            const { progress, tone } = classifyDoc(doc);
            const fieldCount = doc.fieldDefinitions.length;
            const filledCount = Math.round(fieldCount * progress);
            return (
              <motion.div
                key={doc.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.025 }}
                className="doc-card group"
                onClick={() => onSelect(doc)}
              >
                <div className="flex items-start gap-3 mb-3">
                  <FileText className="w-5 h-5 text-ink-soft mt-0.5 shrink-0" strokeWidth={1.5} />
                  <h3 className="font-medium text-[14.5px] text-ink line-clamp-2 leading-tight flex-1">
                    {doc.name}
                  </h3>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(doc.id);
                    }}
                    className="p-1 rounded text-ink-muted hover:text-danger hover:bg-danger-tint opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Delete"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="text-[12.5px] text-ink-faint mb-2.5 flex items-center gap-2">
                  <span>
                    {filledCount}/{fieldCount} fields
                  </span>
                  <span className="text-ink-muted">·</span>
                  <span>{formatRelativeTime(doc.updatedAt)}</span>
                </div>
                <div className="progress" data-tone={tone === 'warning' ? 'warning' : tone === 'muted' ? 'muted' : undefined}>
                  <span style={{ width: `${Math.max(2, progress * 100)}%` }} />
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* List view */}
      {filtered.length > 0 && view === 'list' && (
        <div className="surface-elev overflow-hidden divide-y divide-rule">
          {filtered.map((doc, index) => {
            const { progress } = classifyDoc(doc);
            const fieldCount = doc.fieldDefinitions.length;
            const filledCount = Math.round(fieldCount * progress);
            return (
              <motion.div
                key={doc.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: index * 0.02 }}
                className="flex items-center gap-4 px-5 py-3.5 hover:bg-paper-edge cursor-pointer transition-colors group"
                onClick={() => onSelect(doc)}
              >
                <FileText className="w-5 h-5 text-ink-soft shrink-0" strokeWidth={1.5} />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-[14.5px] text-ink truncate">{doc.name}</div>
                  <div className="text-[12.5px] text-ink-faint">
                    {filledCount}/{fieldCount} fields · {formatRelativeTime(doc.updatedAt)}
                  </div>
                </div>
                <div className="w-32 shrink-0">
                  <div className="progress">
                    <span style={{ width: `${Math.max(2, progress * 100)}%` }} />
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(doc.id);
                  }}
                  className="p-1.5 rounded text-ink-muted hover:text-danger hover:bg-danger-tint opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Delete"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
