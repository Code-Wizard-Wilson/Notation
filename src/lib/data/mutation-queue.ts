"use client";

import { MUTATION_QUEUE_KEY } from "@/lib/constants";
import type { Note } from "@/types/note";
import { createClient } from "@/lib/supabase/client";
import { noteToRow } from "@/lib/utils";

type QueuedMutation =
  | { key: string; type: "upsert-note"; payload: Note; queuedAt: string }
  | { key: string; type: "delete-note"; payload: { id: string }; queuedAt: string };

function readQueue(): QueuedMutation[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(window.localStorage.getItem(MUTATION_QUEUE_KEY) ?? "[]") as QueuedMutation[];
  } catch {
    return [];
  }
}

function writeQueue(queue: QueuedMutation[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(MUTATION_QUEUE_KEY, JSON.stringify(queue));
}

export function queueNoteUpsert(note: Note) {
  const queue = readQueue().filter((item) => item.key !== `note:${note.id}`);
  queue.push({
    key: `note:${note.id}`,
    type: "upsert-note",
    payload: { ...note, syncState: "idle" },
    queuedAt: new Date().toISOString(),
  });
  writeQueue(queue);
}

export function queueNoteDelete(id: string) {
  const queue = readQueue().filter((item) => item.key !== `note:${id}`);
  queue.push({
    key: `note:${id}`,
    type: "delete-note",
    payload: { id },
    queuedAt: new Date().toISOString(),
  });
  writeQueue(queue);
}

export async function flushMutationQueue() {
  if (typeof window === "undefined" || !navigator.onLine) return 0;

  const queue = readQueue();
  if (!queue.length) return 0;

  const supabase = createClient();
  const remaining: QueuedMutation[] = [];
  let completed = 0;

  for (const mutation of queue) {
    try {
      if (mutation.type === "upsert-note") {
        const { error } = await supabase
          .from("notes")
          .upsert(noteToRow(mutation.payload), { onConflict: "id" });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("notes")
          .delete()
          .eq("id", mutation.payload.id);
        if (error) throw error;
      }
      completed += 1;
    } catch {
      remaining.push(mutation);
    }
  }

  writeQueue(remaining);
  return completed;
}
