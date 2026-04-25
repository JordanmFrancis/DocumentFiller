'use client';

import { motion } from 'framer-motion';
import { FileText, Plus, Folder, Pencil } from 'lucide-react';

interface SidebarProps {
  onNewDocument: () => void;
}

export default function Sidebar({ onNewDocument }: SidebarProps) {
  return (
    <aside className="w-64 shrink-0 border-r-2 border-ink bg-paper/50 p-6 min-h-[calc(100vh-4rem)] relative">
      {/* Tape accent */}
      <div className="tape" style={{ top: '-12px', left: '50%', marginLeft: '-35px' }} />

      <motion.button
        whileHover={{ scale: 1.02, rotate: -1 }}
        whileTap={{ scale: 0.97 }}
        onClick={onNewDocument}
        className="btn-rough primary w-full justify-center text-base py-3 mb-8 mt-2"
      >
        <Plus className="w-5 h-5" />
        New Document
      </motion.button>

      <div className="space-y-3">
        <div className="flex items-center gap-2 text-ink-soft">
          <Folder className="w-4 h-4" />
          <span className="font-marker text-sm uppercase tracking-wide squig">
            My Documents
          </span>
        </div>
        <p className="font-cursive text-base text-ink-soft pl-6 italic">
          your filing cabinet —<br />
          everything you've uploaded
        </p>
      </div>

      {/* Hint card at bottom */}
      <div className="absolute bottom-6 left-6 right-6">
        <div className="sticky-note">
          <div className="flex items-start gap-2">
            <Pencil className="w-4 h-4 mt-0.5 shrink-0" />
            <span className="text-sm leading-tight">
              Tip: drag any PDF onto the upload zone to begin.
            </span>
          </div>
        </div>
      </div>
    </aside>
  );
}
