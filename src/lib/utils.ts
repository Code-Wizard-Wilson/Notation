import type { JSONContent } from "@tiptap/core";
import type { Note } from "@/types/note";

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

export function plainTextFromDocument(node: JSONContent | undefined): string {
  if (!node) return "";
  const ownText = typeof node.text === "string" ? node.text : "";
  const children = node.content?.map(plainTextFromDocument).join(" ") ?? "";
  return `${ownText}${children ? ` ${children}` : ""}`.trim().replace(/\s+/g, " ");
}
