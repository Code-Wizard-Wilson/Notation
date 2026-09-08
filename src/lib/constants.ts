import type { JSONContent } from "@tiptap/core";

export const APP_NAME = "Notation";
export const LOCAL_USER_ID = "00000000-0000-4000-8000-000000000001";
export const LOCAL_NOTES_KEY = "notation.local-notes.v1";
export const MUTATION_QUEUE_KEY = "notation.pending-mutations.v1";
export const SIDEBAR_KEY = "notation.sidebar-collapsed";
export const SETTINGS_KEY = "notation.settings.v1";

export const EMPTY_DOCUMENT: JSONContent = {
  type: "doc",
  content: [{ type: "paragraph" }],
};

export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

export const ACCEPTED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
] as const;
