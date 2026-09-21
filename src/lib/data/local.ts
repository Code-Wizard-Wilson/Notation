"use client";

import { LOCAL_NOTES_KEY } from "@/lib/constants";
import type { Note, NoteFolder } from "@/types/note";

const DB_NAME = "notation-local";
const DB_VERSION = 1;
const STORE_NAME = "workspace";
const NOTES_RECORD = "notes";
const FOLDERS_RECORD = "folders";
const PC_BACKUP_URL = "http://127.0.0.1:4317/workspace";

type PcWorkspaceBackup = {
  version: 1;
  savedAt: string;
  notes: Note[];
  folders: NoteFolder[];
};

let pcWorkspaceRead: Promise<PcWorkspaceBackup | null> | null = null;

function isLocalNotationHost() {
  if (typeof window === "undefined") return false;
  return window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
}

function openDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error ?? new Error("Could not open local storage."));
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
  });
}

function readIndexedRecord<T>(key: string) {
  return new Promise<T | null>(async (resolve, reject) => {
    try {
      const db = await openDatabase();
      const transaction = db.transaction(STORE_NAME, "readonly");
      const request = transaction.objectStore(STORE_NAME).get(key);
      request.onerror = () => reject(request.error ?? new Error("Could not read local workspace data."));
      request.onsuccess = () => resolve((request.result as T | undefined) ?? null);
      transaction.oncomplete = () => db.close();
    } catch (error) {
      reject(error);
    }
  });
}

async function writeIndexedRecord<T>(key: string, value: T) {
  const db = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).put(value, key);
    transaction.onerror = () => reject(transaction.error ?? new Error("Could not save local workspace data."));
    transaction.oncomplete = () => resolve();
  });
  db.close();
}

async function fetchPcWorkspace() {
  if (!isLocalNotationHost()) return null;

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 900);
  try {
    const response = await fetch(PC_BACKUP_URL, {
      cache: "no-store",
      signal: controller.signal,
    });
    if (!response.ok) return null;
    const payload = (await response.json()) as Partial<PcWorkspaceBackup>;
    if (!Array.isArray(payload.notes) || !Array.isArray(payload.folders)) return null;
    return {
      version: 1,
      savedAt: typeof payload.savedAt === "string" ? payload.savedAt : new Date(0).toISOString(),
      notes: payload.notes as Note[],
      folders: payload.folders as NoteFolder[],
    } satisfies PcWorkspaceBackup;
  } catch {
    return null;
  } finally {
    window.clearTimeout(timeout);
  }
}

function readPcWorkspace() {
  if (!pcWorkspaceRead) pcWorkspaceRead = fetchPcWorkspace();
  return pcWorkspaceRead;
}

function writePcWorkspace(update: { notes?: Note[]; folders?: NoteFolder[] }) {
  if (!isLocalNotationHost()) return;

  void fetch(PC_BACKUP_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(update),
  }).catch(() => {
    // IndexedDB remains the immediate fallback if the local backup process is unavailable.
  });
}

export async function readLocalNotes(fallback: Note[]) {
  if (typeof window === "undefined" || !window.indexedDB) return fallback;

  try {
    const pcWorkspace = await readPcWorkspace();
    if (pcWorkspace?.notes.length) {
      await writeIndexedRecord(NOTES_RECORD, pcWorkspace.notes);
      return pcWorkspace.notes;
    }

    const indexed = await readIndexedRecord<Note[]>(NOTES_RECORD);
    if (indexed?.length) {
      writePcWorkspace({ notes: indexed });
      return indexed;
    }

    // One-time migration for people who already used the local preview build.
    const legacy = window.localStorage.getItem(LOCAL_NOTES_KEY);
    if (legacy) {
      const parsed = JSON.parse(legacy) as Note[];
      await writeIndexedRecord(NOTES_RECORD, parsed);
      writePcWorkspace({ notes: parsed });
      window.localStorage.removeItem(LOCAL_NOTES_KEY);
      return parsed;
    }

    await writeIndexedRecord(NOTES_RECORD, fallback);
    writePcWorkspace({ notes: fallback });
    return fallback;
  } catch {
    try {
      const legacy = window.localStorage.getItem(LOCAL_NOTES_KEY);
      const parsed = legacy ? (JSON.parse(legacy) as Note[]) : fallback;
      writePcWorkspace({ notes: parsed });
      return parsed;
    } catch {
      return fallback;
    }
  }
}

export async function readLocalFolders() {
  if (typeof window === "undefined" || !window.indexedDB) return [] as NoteFolder[];

  try {
    const pcWorkspace = await readPcWorkspace();
    if (pcWorkspace) {
      await writeIndexedRecord(FOLDERS_RECORD, pcWorkspace.folders);
      return pcWorkspace.folders;
    }

    const indexed = (await readIndexedRecord<NoteFolder[]>(FOLDERS_RECORD)) ?? [];
    writePcWorkspace({ folders: indexed });
    return indexed;
  } catch {
    return [];
  }
}

export function writeLocalNotes(notes: Note[]) {
  if (typeof window === "undefined") return;

  writePcWorkspace({ notes });

  if (window.indexedDB) {
    void writeIndexedRecord(NOTES_RECORD, notes).catch(() => {
      // Last-resort compatibility fallback. IndexedDB is the primary browser store.
      try {
        window.localStorage.setItem(LOCAL_NOTES_KEY, JSON.stringify(notes));
      } catch {}
    });
    return;
  }

  try {
    window.localStorage.setItem(LOCAL_NOTES_KEY, JSON.stringify(notes));
  } catch {}
}

export function writeLocalFolders(folders: NoteFolder[]) {
  if (typeof window === "undefined") return;

  writePcWorkspace({ folders });

  if (!window.indexedDB) return;
  void writeIndexedRecord(FOLDERS_RECORD, folders).catch(() => {});
}

export function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read the file."));
    reader.readAsDataURL(file);
  });
}
