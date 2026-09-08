import type { JSONContent } from "@tiptap/core";
import type { Attachment, Note } from "@/types/note";
import type { Database, Json } from "@/types/database";

type NoteRow = Database["public"]["Tables"]["notes"]["Row"];
type AttachmentRow = Database["public"]["Tables"]["attachments"]["Row"];

export function cn(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export function formatRelativeTime(value: string) {
  const then = new Date(value).getTime();
  const deltaSeconds = Math.max(0, Math.floor((Date.now() - then) / 1000));

  if (deltaSeconds < 45) return "NOW";
  if (deltaSeconds < 3600) return `${Math.floor(deltaSeconds / 60)}M AGO`;
  if (deltaSeconds < 86400) return `${Math.floor(deltaSeconds / 3600)}H AGO`;
  if (deltaSeconds < 604800) return `${Math.floor(deltaSeconds / 86400)}D AGO`;

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  })
    .format(new Date(value))
    .toUpperCase();
}

export function formatBytes(bytes: number) {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const exponent = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  );
  const amount = bytes / 1024 ** exponent;
  return `${amount >= 10 || exponent === 0 ? amount.toFixed(0) : amount.toFixed(1)} ${units[exponent]}`;
}

export function isMac() {
  if (typeof navigator === "undefined") return true;
  return /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
}

export function shortcutLabel(keys: string) {
  if (!isMac()) return keys.replace("⌘", "Ctrl+").replace("⇧", "Shift+");
  return keys;
}

export function getNoteDisplayTitle(note: Pick<Note, "title">) {
  return note.title.trim() || "Untitled";
}

export function getNotePreview(note: Pick<Note, "plainTextContent">) {
  return note.plainTextContent.trim().replace(/\s+/g, " ") || "Start writing…";
}

export function mapAttachment(row: AttachmentRow): Attachment {
  return {
    id: row.id,
    noteId: row.note_id,
    userId: row.user_id,
    type: row.type,
    filename: row.filename,
    storagePath: row.storage_path,
    mimeType: row.mime_type,
    size: row.size,
    createdAt: row.created_at,
  };
}

export function mapNote(
  row: NoteRow,
  attachments: AttachmentRow[] = [],
): Note {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    emoji: row.emoji || "🐶",
    content: row.content_json as JSONContent,
    plainTextContent: row.plain_text_content,
    isPinned: row.is_pinned,
    isArchived: row.is_archived,
    isDeleted: row.is_deleted,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
    attachments: attachments.map(mapAttachment),
    syncState: "idle",
  };
}

export function noteToRow(note: Note) {
  return {
    id: note.id,
    user_id: note.userId,
    title: note.title,
    emoji: note.emoji ?? "🐶",
    content_json: note.content as Json,
    plain_text_content: note.plainTextContent,
    is_pinned: note.isPinned,
    is_archived: note.isArchived,
    is_deleted: note.isDeleted,
    created_at: note.createdAt,
    updated_at: note.updatedAt,
    deleted_at: note.deletedAt,
  };
}

export function safeFilename(filename: string) {
  const extension = filename.includes(".") ? `.${filename.split(".").pop()}` : "";
  const basename = filename
    .replace(extension, "")
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9-_]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return `${basename || "file"}${extension.toLowerCase()}`;
}

export function plainTextFromDocument(node: JSONContent | undefined): string {
  if (!node) return "";
  const ownText = typeof node.text === "string" ? node.text : "";
  const children = node.content?.map(plainTextFromDocument).join(" ") ?? "";
  return `${ownText}${children ? ` ${children}` : ""}`.trim().replace(/\s+/g, " ");
}
