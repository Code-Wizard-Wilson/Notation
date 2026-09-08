import type { JSONContent } from "@tiptap/core";

export type Attachment = {
  id: string;
  noteId: string;
  userId: string;
  type: "image" | "file";
  filename: string;
  storagePath: string;
  mimeType: string;
  size: number;
  createdAt: string;
  url?: string;
  uploadProgress?: number;
};

export type Note = {
  id: string;
  userId: string;
  title: string;
  emoji?: string;
  content: JSONContent;
  plainTextContent: string;
  isPinned: boolean;
  isArchived: boolean;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  attachments: Attachment[];
  syncState?: "idle" | "saving" | "saved" | "error";
};

export type NotesView = "all" | "pinned" | "archive" | "trash";

export type WorkspaceUser = {
  id: string;
  email: string;
  isLocal?: boolean;
};

export type ToastMessage = {
  id: string;
  title: string;
  actionLabel?: string;
  onAction?: () => void;
  tone?: "neutral" | "error";
};
