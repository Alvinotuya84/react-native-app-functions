import { useSyncExternalStore } from 'react';
import { createMMKV } from 'react-native-mmkv';

export type Note = {
  id: string;
  title: string;
  body: string;
  tags: string[];
  createdAt: string; // ISO-8601 instant
  updatedAt: string;
  /** Set when the last change came from an AppFunction call (an assistant). */
  viaAssistant?: boolean;
};

const storage = createMMKV({ id: 'notes' });
const KEY = 'notes.v1';

let notes: Note[] = load();
const listeners = new Set<() => void>();

function load(): Note[] {
  const raw = storage.getString(KEY);
  if (!raw) return seed();
  try {
    return JSON.parse(raw) as Note[];
  } catch {
    return seed();
  }
}

function seed(): Note[] {
  const now = Date.now();
  const at = (minutesAgo: number) =>
    new Date(now - minutesAgo * 60_000).toISOString();
  // Demo content: a React Native engineer's to-dos.
  return [

  ];
}

function commit(next: Note[]) {
  notes = next;
  storage.set(KEY, JSON.stringify(notes));
  listeners.forEach((l) => l());
}

function newId(): string {
  return `n_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

function byUpdatedDesc(a: Note, b: Note) {
  return b.updatedAt.localeCompare(a.updatedAt);
}

export function getNotes(): Note[] {
  return notes;
}

export function createNote(input: {
  title: string;
  body: string;
  tags?: string[] | null;
  viaAssistant?: boolean;
}): Note {
  const now = new Date().toISOString();
  const note: Note = {
    id: newId(),
    title: input.title.trim(),
    body: input.body.trim(),
    tags: normalizeTags(input.tags ?? []),
    createdAt: now,
    updatedAt: now,
    viaAssistant: input.viaAssistant,
  };
  commit([note, ...notes]);
  return note;
}

export function appendToNote(
  id: string,
  text: string,
  viaAssistant?: boolean
): Note | undefined {
  const existing = notes.find((n) => n.id === id);
  if (!existing) return undefined;
  const updated: Note = {
    ...existing,
    body: existing.body ? `${existing.body}\n${text.trim()}` : text.trim(),
    updatedAt: new Date().toISOString(),
    viaAssistant,
  };
  commit([updated, ...notes.filter((n) => n.id !== id)]);
  return updated;
}

export function listRecentNotes(limit: number): Note[] {
  return [...notes].sort(byUpdatedDesc).slice(0, limit);
}

/** Scores notes by how many query words appear in title, body or tags. */
export function searchNotes(query: string): Note[] {
  const words = query
    .toLowerCase()
    .split(/[^\p{L}\p{N}-]+/u)
    .filter((w) => w.length > 1 || /\d/.test(w));
  if (words.length === 0) return [];
  return notes
    .map((n) => {
      const hay = `${n.title} ${n.body} ${n.tags.join(' ')}`.toLowerCase();
      const score = words.filter((w) => hay.includes(w)).length;
      return { n, score };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score || byUpdatedDesc(a.n, b.n))
    .map((r) => r.n);
}

function normalizeTags(tags: string[]): string[] {
  return [
    ...new Set(
      tags.map((t) => t.trim().toLowerCase().replace(/^#/, '')).filter(Boolean)
    ),
  ];
}

export function useNotes(): Note[] {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => notes
  );
}

/** Strips app-only fields before returning a note to an agent. */
export function toAgentNote({ viaAssistant: _, ...note }: Note) {
  return note;
}
