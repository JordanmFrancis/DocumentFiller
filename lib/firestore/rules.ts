// lib/firestore/rules.ts
//
// CRUD for the rules and chatHistory fields embedded in PDFDocument records.
// Mirrors the existing pattern in lib/firestore/documents.ts (uses updateDoc
// with optimistic local state and revert-on-failure handled at the caller).

import { doc, updateDoc, Timestamp } from 'firebase/firestore';
import { db } from '../firebase/config';
import { Rule, ChatMessage } from '@/types/rule';

const DOCUMENTS_COLLECTION = 'documents';
const MAX_CHAT_TURNS = 50;

export async function saveRules(documentId: string, rules: Rule[]): Promise<void> {
  const ref = doc(db, DOCUMENTS_COLLECTION, documentId);
  await updateDoc(ref, {
    rules,
    updatedAt: Timestamp.now(),
  });
}

export async function appendChatMessage(
  documentId: string,
  history: ChatMessage[],
  message: ChatMessage
): Promise<ChatMessage[]> {
  const next = [...history, message].slice(-MAX_CHAT_TURNS);
  const ref = doc(db, DOCUMENTS_COLLECTION, documentId);
  await updateDoc(ref, {
    chatHistory: next,
    updatedAt: Timestamp.now(),
  });
  return next;
}

export function newRuleId(): string {
  // 12-char base36 — collision-free for realistic per-doc rule counts.
  return Math.random().toString(36).slice(2, 14);
}
