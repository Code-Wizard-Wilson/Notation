"use client";

import { LOCAL_NOTES_KEY } from "@/lib/constants";
import type { Note, NoteFolder } from "@/types/note";

const DB_NAME = "notation-local";
const DB_VERSION = 1;
const STORE_NAME = "workspace";
const NOTES_RECORD = "notes";
const FOLDERS_RECORD = "folders";

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

export async function readLocalNotes(fallback: Note[]) {
  if (typeof window === "undefined" || !window.indexedDB) return fallback;

  try {
    const indexed = await readIndexedRecord<Note[]>(NOTES_RECORD);
    if (indexed?.length) return indexed;

    // One-time migration for people who already used the local preview build.
    const legacy = window.localStorage.getItem(LOCAL_NOTES_KEY);
    if (legacy) {
      const parsed = JSON.parse(legacy) as Note[];
      await writeIndexedRecord(NOTES_RECORD, parsed);
      window.localStorage.removeItem(LOCAL_NOTES_KEY);
      return parsed;
    }

    await writeIndexedRecord(NOTES_RECORD, fallback);
    return fallback;
  } catch {
    try {
      const legacy = window.localStorage.getItem(LOCAL_NOTES_KEY);
      return legacy ? (JSON.parse(legacy) as Note[]) : fallback;
    } catch {
      return fallback;
    }
  }
}

export async function readLocalFolders() {
  if (typeof window === "undefined" || !window.indexedDB) return [] as NoteFolder[];
  try {
    return (await readIndexedRecord<NoteFolder[]>(FOLDERS_RECORD)) ?? [];
  } catch {
    return [];
  }
}

export function writeLocalNotes(notes: Note[]) {
  if (typeof window === "undefined") return;

  if (window.indexedDB) {
    void writeIndexedRecord(NOTES_RECORD, notes).catch(() => {
      // Last-resort compatibility fallback. IndexedDB is the primary store.
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
  if (typeof window === "undefined" || !window.indexedDB) return;
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
