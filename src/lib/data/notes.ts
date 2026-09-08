"use client";

import { createClient } from "@/lib/supabase/client";
import { fileToDataUrl } from "@/lib/data/local";
import { MAX_UPLOAD_BYTES } from "@/lib/constants";
import { mapAttachment, noteToRow, safeFilename } from "@/lib/utils";
import type { Attachment, Note } from "@/types/note";

function internalNoteTargets(note: Note) {
  const targets = new Set<string>();

  function visit(value: unknown) {
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }

    const node = value as Record<string, unknown>;
    if (Array.isArray(node.marks)) {
      for (const mark of node.marks) {
        if (!mark || typeof mark !== "object") continue;
        const href = (mark as { attrs?: { href?: unknown } }).attrs?.href;
        if (typeof href === "string" && href.startsWith("note:")) {
          targets.add(href.slice(5));
        }
      }
    }
    Object.values(node).forEach(visit);
  }

  visit(note.content);
  return [...targets].filter((id) => id && id !== note.id);
}

export async function persistNote(note: Note) {
  const supabase = createClient();
  const { error } = await supabase
    .from("notes")
    .upsert(noteToRow(note), { onConflict: "id" });
  if (error) throw error;

  const { error: clearLinksError } = await supabase
    .from("note_links")
    .delete()
    .eq("source_note_id", note.id);
  if (clearLinksError) throw clearLinksError;

  const targetIds = internalNoteTargets(note);
  if (targetIds.length) {
    const { error: linkError } = await supabase.from("note_links").insert(
      targetIds.map((targetNoteId) => ({
        user_id: note.userId,
        source_note_id: note.id,
        target_note_id: targetNoteId,
      })),
    );
    if (linkError) throw linkError;
  }
}

export async function permanentlyDeleteNote(note: Note) {
  const supabase = createClient();
  const paths = note.attachments
    .map((attachment) => attachment.storagePath)
    .filter((path) => !path.startsWith("local:"));

  if (paths.length) {
    const { error: storageError } = await supabase.storage
      .from("note-attachments")
      .remove(paths);
    if (storageError) throw storageError;
  }

  const { error } = await supabase.from("notes").delete().eq("id", note.id);
  if (error) throw error;
}

export async function uploadAttachment({
  note,
  file,
  localMode,
  onProgress,
}: {
  note: Note;
  file: File;
  localMode: boolean;
  onProgress?: (progress: number) => void;
}): Promise<Attachment> {
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error("Files must be smaller than 25 MB.");
  }

  const id = crypto.randomUUID();
  const isImage = file.type.startsWith("image/");
  const createdAt = new Date().toISOString();
  onProgress?.(12);

  if (localMode) {
    const url = await fileToDataUrl(file);
    onProgress?.(100);
    return {
      id,
      noteId: note.id,
      userId: note.userId,
      type: isImage ? "image" : "file",
      filename: file.name,
      storagePath: `local:${id}`,
      mimeType: file.type || "application/octet-stream",
      size: file.size,
      createdAt,
      url,
    };
  }

  const supabase = createClient();
  const storagePath = `${note.userId}/${note.id}/${id}-${safeFilename(file.name)}`;
  const { error: uploadError } = await supabase.storage
    .from("note-attachments")
    .upload(storagePath, file, {
      cacheControl: "3600",
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });
  if (uploadError) throw uploadError;
  onProgress?.(76);

  const { data, error: metadataError } = await supabase
    .from("attachments")
    .insert({
      id,
      note_id: note.id,
      user_id: note.userId,
      type: isImage ? "image" : "file",
      filename: file.name,
      storage_path: storagePath,
      mime_type: file.type || "application/octet-stream",
      size: file.size,
      created_at: createdAt,
    })
    .select()
    .single();

  if (metadataError) {
    await supabase.storage.from("note-attachments").remove([storagePath]);
    throw metadataError;
  }

  onProgress?.(100);
  return { ...mapAttachment(data), url: `/api/attachments/${id}` };
}

export async function deleteAttachment(attachment: Attachment, localMode: boolean) {
  if (localMode) return;
  const supabase = createClient();
  const { error: storageError } = await supabase.storage
    .from("note-attachments")
    .remove([attachment.storagePath]);
  if (storageError) throw storageError;

  const { error } = await supabase
    .from("attachments")
    .delete()
    .eq("id", attachment.id);
  if (error) throw error;
}
