"use client";

import { LOCAL_NOTES_KEY } from "@/lib/constants";
import type { Note } from "@/types/note";

export function readLocalNotes(fallback: Note[]) {
  if (typeof window === "undefined") return fallback;

  try {
    const value = window.localStorage.getItem(LOCAL_NOTES_KEY);
    if (!value) {
      writeLocalNotes(fallback);
      return fallback;
    }
    return JSON.parse(value) as Note[];
  } catch {
    return fallback;
  }
}

export function writeLocalNotes(notes: Note[]) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(LOCAL_NOTES_KEY, JSON.stringify(notes));
  } catch {
    // Local preview storage can be exhausted by large embedded files.
  }
}

export function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read the file."));
    reader.readAsDataURL(file);
  });
}
