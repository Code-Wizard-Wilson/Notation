"use client";

import { fileToDataUrl } from "@/lib/data/local";
import { MAX_UPLOAD_BYTES } from "@/lib/constants";
import type { Attachment, Note } from "@/types/note";

export async function uploadAttachment({
  note,
  file,
  onProgress,
}: {
  note: Note;
  file: File;
  onProgress?: (progress: number) => void;
}): Promise<Attachment> {
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error("Files must be smaller than 25 MB.");
  }

  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  onProgress?.(12);
  const url = await fileToDataUrl(file);
  onProgress?.(100);

  return {
    id,
    noteId: note.id,
    userId: note.userId,
    type: file.type.startsWith("image/") ? "image" : "file",
    filename: file.name,
    storagePath: `local:${id}`,
    mimeType: file.type || "application/octet-stream",
    size: file.size,
    createdAt,
    url,
  };
}

export async function deleteAttachment(attachment: Attachment) {
  // Attachment bytes live inside the locally persisted note snapshot.
  void attachment;
}
