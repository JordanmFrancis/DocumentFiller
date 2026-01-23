'use client';

import { motion } from 'framer-motion';
import { FileText, Plus } from 'lucide-react';

interface SidebarProps {
  onNewDocument: () => void;
}

export default function Sidebar({ onNewDocument }: SidebarProps) {
  return (
    <aside className="w-64 bg-gray-900/50 border-r border-gray-800 p-6">
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={onNewDocument}
        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-primary hover:bg-primary-hover text-white rounded-lg font-medium transition-colors mb-6"
      >
        <Plus className="w-5 h-5" />
        New Document
      </motion.button>

      <div className="space-y-2">
        <div className="flex items-center gap-3 px-3 py-2 text-gray-400 text-sm font-medium">
          <FileText className="w-4 h-4" />
          Documents
        </div>
      </div>
    </aside>
  );
}
